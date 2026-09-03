import { useCallback, useEffect, useReducer, useRef } from 'react';

import {
  buildWorld,
  getAiTransport,
  isAiError,
  runAgent,
  runIntent,
  type AiChatMessage,
  type AiErrorCode,
  type Answer,
  type AnswerTarget,
  type OpenScreen,
  type ResolvedDraft,
} from '@/ai';
import { loadSettings, saveSetting } from '@/db';
import { reportError, swallow } from '@/utils/log';

/** One message in the conversation. */
export type Turn =
  | { id: string; role: 'user'; text: string; /** Attached photos (file URIs) for the bubble. */ imageUris?: string[] }
  | {
      id: string;
      role: 'assistant';
      /** The model's own answer (may be empty when only a draft / open follows). */
      text: string;
      /** Data cards from the read tools it used. */
      cards: Answer[];
      /** Writes awaiting the user's confirmation (an image can produce several). */
      drafts: ResolvedDraft[];
      /** A screen it opened. */
      open?: OpenScreen;
      /** Tappable follow-ups. */
      suggestions: string[];
      /** Choices the assistant asked the user to pick from. */
      options: string[];
      /** Which option the user tapped (kept so the list shows the choice). */
      picked?: string;
      /** Per-draft outcome, by index (survives restarts). */
      settled?: Record<number, { status: 'accepted' | 'rejected'; message?: string }>;
    }
  | { id: string; role: 'assistant'; error: AiErrorCode; detail?: string; /** The prompt that failed, for Retry. */ retryText?: string };

interface State {
  turns: Turn[];
  busy: boolean;
  /** What the agent is doing right now, for the thinking bubble. */
  working: { phase: 'thinking' | 'tools' | 'writing'; tools: string[] };
  /** True once the saved conversation has been read back. */
  hydrated: boolean;
}

type Action =
  | { type: 'push'; turn: Turn }
  | { type: 'busy'; busy: boolean }
  | { type: 'clear' }
  | { type: 'hydrate'; turns: Turn[] }
  | { type: 'remove'; turnId: string }
  | { type: 'working'; phase: 'thinking' | 'tools' | 'writing'; tools: string[] }
  | { type: 'pick'; turnId: string; option: string }
  | { type: 'settle'; turnId: string; index: number; status: 'accepted' | 'rejected'; message?: string };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'push':
      return { ...s, turns: [...s.turns, a.turn] };
    case 'busy':
      return { ...s, busy: a.busy, working: { phase: 'thinking', tools: [] } };
    case 'clear':
      return { ...s, turns: [], busy: false };
    case 'hydrate':
      return { ...s, turns: a.turns, hydrated: true };
    case 'remove':
      return { ...s, turns: s.turns.filter((t) => t.id !== a.turnId) };
    case 'working':
      return { ...s, working: { phase: a.phase, tools: a.tools } };
    case 'pick':
      return { ...s, turns: s.turns.map((t) => (t.id === a.turnId && t.role === 'assistant' && 'cards' in t ? { ...t, picked: a.option } : t)) };
    case 'settle':
      return {
        ...s,
        turns: s.turns.map((t) =>
          t.id === a.turnId && t.role === 'assistant' && 'cards' in t ? { ...t, settled: { ...(t.settled ?? {}), [a.index]: { status: a.status, message: a.message } } } : t
        ),
      };
  }
}

/** Bring a turn saved by an older build up to the current shape (or drop it). */
function normalizeTurn(raw: unknown): Turn | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.id !== 'string') return null;
  if (t.role === 'user') return typeof t.text === 'string' ? { id: t.id, role: 'user', text: t.text, imageUris: Array.isArray(t.imageUris) ? (t.imageUris as string[]) : undefined } : null;
  if (t.role !== 'assistant') return null;
  if (typeof t.error === 'string') {
    return { id: t.id, role: 'assistant', error: t.error as AiErrorCode, detail: typeof t.detail === 'string' ? t.detail : undefined, retryText: typeof t.retryText === 'string' ? t.retryText : undefined };
  }
  // Pre-agent shapes ({kind:'text'|'answer'|'draft'|'open'}) → the unified shape.
  const legacyKind = typeof t.kind === 'string' ? t.kind : null;
  const cards = Array.isArray(t.cards) ? (t.cards as Answer[]) : legacyKind === 'answer' && t.answer ? [t.answer as Answer] : [];
  const fixDraft = (d: unknown): ResolvedDraft | null => {
    if (!d || typeof d !== 'object' || !('draft' in (d as object))) return null;
    const r = d as ResolvedDraft;
    return { ...r, issues: r.issues ?? [], investors: r.investors ?? [], marks: r.marks ?? [], unresolved: r.unresolved ?? [] };
  };
  const rawDrafts: unknown[] = Array.isArray(t.drafts) ? (t.drafts as unknown[]) : t.draft ? [t.draft] : legacyKind === 'draft' && t.resolved ? [t.resolved] : [];
  const drafts = rawDrafts.map(fixDraft).filter((x): x is ResolvedDraft => x !== null);
  // Old single `settled` object → index 0.
  const settledRaw = t.settled && typeof t.settled === 'object' ? (t.settled as Record<string, unknown>) : undefined;
  const settled = settledRaw ? ('status' in settledRaw ? { 0: settledRaw as { status: 'accepted' | 'rejected'; message?: string } } : (settledRaw as Record<number, { status: 'accepted' | 'rejected'; message?: string }>)) : undefined;
  return {
    id: t.id,
    role: 'assistant',
    text: typeof t.text === 'string' ? t.text : '',
    cards,
    drafts,
    open: typeof t.open === 'string' ? (t.open as OpenScreen) : legacyKind === 'open' && typeof t.screen === 'string' ? (t.screen as OpenScreen) : undefined,
    suggestions: Array.isArray(t.suggestions) ? (t.suggestions as string[]) : [],
    options: Array.isArray(t.options) ? (t.options as string[]) : [],
    picked: typeof t.picked === 'string' ? t.picked : undefined,
    settled,
  };
}

/** Persisted conversation: the visible turns + the model's compact memory. */
interface SavedChat {
  turns: Turn[];
  history: AiChatMessage[];
}
const CHAT_KEY = 'aiChat';
/** Keep the saved conversation bounded (old turns fall off). */
const MAX_SAVED_TURNS = 40;

/** How many prior messages the model sees (3 exchanges). */
const HISTORY_TURNS = 6;

let seq = 0;
const nextId = (): string => `t${Date.now().toString(36)}${(seq++).toString(36)}`;

export interface AssistantApi extends State {
  /** Send one utterance (typed or transcribed) through the agent, with optional photos. */
  ask: (text: string, images?: { uri: string; base64: string }[]) => Promise<void>;
  clear: () => void;
  /** Fires with the sentence to read aloud after an answer lands. */
  onSpeak: React.MutableRefObject<((text: string) => void) | null>;
  /** Fires when the user asked to open a screen ("open reports"). */
  onOpen: React.MutableRefObject<((screen: OpenScreen) => void) | null>;
  /** Fires when an answer asks to be opened right away (a report / PDF). */
  onOpenTarget: React.MutableRefObject<((target: AnswerTarget) => void) | null>;
  /** Record that a draft card was accepted or rejected. */
  settle: (turnId: string, index: number, status: 'accepted' | 'rejected', message?: string) => void;
  /** Re-run the prompt behind a failed reply (replaces the error bubble). */
  retry: (turnId: string) => Promise<void>;
  /** The user tapped one of the offered choices: remember it and send it. */
  pick: (turnId: string, option: string) => Promise<void>;
}

/**
 * The assistant conversation on top of the agent loop: user text → tools →
 * an exact, grounded answer with data cards; or a draft for confirmation; or
 * a screen to open. The model never touches the database.
 */
export function useAssistant(): AssistantApi {
  const [state, dispatch] = useReducer(reducer, { turns: [], busy: false, working: { phase: 'thinking', tools: [] }, hydrated: false });
  // Always-fresh view of the turns for callbacks (avoids stale closures).
  const turnsRef = useRef<Turn[]>([]);
  turnsRef.current = state.turns;
  const onSpeak = useRef<((text: string) => void) | null>(null);
  const onOpen = useRef<((screen: OpenScreen) => void) | null>(null);
  const onOpenTarget = useRef<((target: AnswerTarget) => void) | null>(null);
  const inFlight = useRef(false);
  // Short conversational memory for the model (compact text, last few turns).
  const history = useRef<AiChatMessage[]>([]);
  const remember = (role: 'user' | 'assistant', content: string) => {
    if (!content) return;
    const msg: AiChatMessage = role === 'user' ? { role, content: content.slice(0, 500) } : { role, content: content.slice(0, 500) };
    history.current = [...history.current, msg].slice(-HISTORY_TURNS);
  };

  // Restore the saved conversation once; then mirror every change back.
  useEffect(() => {
    loadSettings()
      .then((s) => {
        if (!s[CHAT_KEY]) {
          dispatch({ type: 'hydrate', turns: [] });
          return;
        }
        try {
          const saved = JSON.parse(s[CHAT_KEY]) as SavedChat;
          history.current = Array.isArray(saved.history) ? saved.history : [];
          dispatch({ type: 'hydrate', turns: (Array.isArray(saved.turns) ? saved.turns : []).map(normalizeTurn).filter((x): x is Turn => x !== null) });
        } catch {
          dispatch({ type: 'hydrate', turns: [] });
        }
      })
      .catch(() => dispatch({ type: 'hydrate', turns: [] }));
  }, []);
  useEffect(() => {
    if (!state.hydrated) return;
    const payload: SavedChat = { turns: state.turns.slice(-MAX_SAVED_TURNS), history: history.current };
    void saveSetting(CHAT_KEY, JSON.stringify(payload)).catch(swallow('assistant:persist'));
  }, [state.turns, state.hydrated]);

  /** One agent run. `echoUser` false = a retry, the user bubble is already there. */
  const runTurn = useCallback(async (text: string, echoUser: boolean, images?: { uri: string; base64: string }[]) => {
    if ((!text && !images?.length) || inFlight.current) return;
    inFlight.current = true;
    if (echoUser) dispatch({ type: 'push', turn: { id: nextId(), role: 'user', text, imageUris: images?.map((i) => i.uri) } });
    dispatch({ type: 'busy', busy: true });
    try {
      const transport = getAiTransport();
      const world = await buildWorld();
      const r = await runAgent(text, {
        transport,
        world,
        runIntent,
        history: history.current,
        onProgress: (phase, tools) => dispatch({ type: 'working', phase, tools }),
        images: images?.map((i) => i.base64),
      });
      remember('user', images?.length ? `${text} [sent ${images.length} photo(s)]` : text);
      remember('assistant', r.memory);
      dispatch({ type: 'push', turn: { id: nextId(), role: 'assistant', text: r.text, cards: r.cards, drafts: r.drafts, open: r.open, suggestions: r.suggestions, options: r.options } });
      if (r.open) onOpen.current?.(r.open);
      const auto = r.cards.find((c) => c.autoOpen && c.target);
      if (auto?.target) onOpenTarget.current?.(auto.target);
      else if (r.text && r.drafts.length === 0) onSpeak.current?.(r.text);
    } catch (e) {
      const code: AiErrorCode = isAiError(e) ? e.code : 'failed';
      if (code === 'failed') reportError('assistant:ask', e);
      dispatch({ type: 'push', turn: { id: nextId(), role: 'assistant', error: code, detail: e instanceof Error ? e.message.slice(0, 160) : undefined, retryText: text } });
    } finally {
      inFlight.current = false;
      dispatch({ type: 'busy', busy: false });
    }
  }, []);

  const ask = useCallback((raw: string, images?: { uri: string; base64: string }[]) => runTurn(raw.trim(), true, images), [runTurn]);

  const retry = useCallback(
    async (turnId: string) => {
      const turns = turnsRef.current;
      const idx = turns.findIndex((t) => t.id === turnId);
      const turn = turns[idx];
      if (!turn || turn.role !== 'assistant' || !('error' in turn)) return;
      // Older saved errors carry no retryText: fall back to the user message just above.
      let text = turn.retryText ?? '';
      if (!text) {
        for (let i = idx - 1; i >= 0; i--) {
          const prev = turns[i];
          if (prev.role === 'user') {
            text = prev.text;
            break;
          }
        }
      }
      if (!text) return;
      dispatch({ type: 'remove', turnId });
      await runTurn(text, false);
    },
    [runTurn]
  );

  const pick = useCallback(
    async (turnId: string, option: string) => {
      dispatch({ type: 'pick', turnId, option });
      await runTurn(option, true);
    },
    [runTurn]
  );

  const clear = useCallback(() => {
    history.current = [];
    dispatch({ type: 'clear' });
    void saveSetting(CHAT_KEY, '').catch(swallow('assistant:clear'));
  }, []);

  const settle = useCallback((turnId: string, index: number, status: 'accepted' | 'rejected', message?: string) => {
    dispatch({ type: 'settle', turnId, index, status, message });
  }, []);

  return { ...state, ask, clear, settle, retry, pick, onSpeak, onOpen, onOpenTarget };
}
