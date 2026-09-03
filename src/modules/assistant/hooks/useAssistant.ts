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
  | { id: string; role: 'user'; text: string }
  | {
      id: string;
      role: 'assistant';
      /** The model's own answer (may be empty when only a draft / open follows). */
      text: string;
      /** Data cards from the read tools it used. */
      cards: Answer[];
      /** A write awaiting the user's confirmation. */
      draft?: ResolvedDraft;
      /** A screen it opened. */
      open?: OpenScreen;
      /** Tappable follow-ups. */
      suggestions: string[];
      /** Set once the user accepted or rejected the draft (survives restarts). */
      settled?: { status: 'accepted' | 'rejected'; message?: string };
    }
  | { id: string; role: 'assistant'; error: AiErrorCode };

interface State {
  turns: Turn[];
  busy: boolean;
  /** True once the saved conversation has been read back. */
  hydrated: boolean;
}

type Action =
  | { type: 'push'; turn: Turn }
  | { type: 'busy'; busy: boolean }
  | { type: 'clear' }
  | { type: 'hydrate'; turns: Turn[] }
  | { type: 'settle'; turnId: string; status: 'accepted' | 'rejected'; message?: string };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'push':
      return { ...s, turns: [...s.turns, a.turn] };
    case 'busy':
      return { ...s, busy: a.busy };
    case 'clear':
      return { ...s, turns: [], busy: false };
    case 'hydrate':
      return { ...s, turns: a.turns, hydrated: true };
    case 'settle':
      return {
        ...s,
        turns: s.turns.map((t) => (t.id === a.turnId && t.role === 'assistant' && 'cards' in t ? { ...t, settled: { status: a.status, message: a.message } } : t)),
      };
  }
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
  /** Send one utterance (typed or transcribed) through the agent. */
  ask: (text: string) => Promise<void>;
  clear: () => void;
  /** Fires with the sentence to read aloud after an answer lands. */
  onSpeak: React.MutableRefObject<((text: string) => void) | null>;
  /** Fires when the user asked to open a screen ("open reports"). */
  onOpen: React.MutableRefObject<((screen: OpenScreen) => void) | null>;
  /** Fires when an answer asks to be opened right away (a report / PDF). */
  onOpenTarget: React.MutableRefObject<((target: AnswerTarget) => void) | null>;
  /** Record that a draft card was accepted or rejected. */
  settle: (turnId: string, status: 'accepted' | 'rejected', message?: string) => void;
}

/**
 * The assistant conversation on top of the agent loop: user text → tools →
 * an exact, grounded answer with data cards; or a draft for confirmation; or
 * a screen to open. The model never touches the database.
 */
export function useAssistant(): AssistantApi {
  const [state, dispatch] = useReducer(reducer, { turns: [], busy: false, hydrated: false });
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
          dispatch({ type: 'hydrate', turns: Array.isArray(saved.turns) ? saved.turns : [] });
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

  const ask = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || inFlight.current) return;
    inFlight.current = true;
    dispatch({ type: 'push', turn: { id: nextId(), role: 'user', text } });
    dispatch({ type: 'busy', busy: true });
    try {
      const transport = getAiTransport();
      const world = await buildWorld();
      const r = await runAgent(text, { transport, world, runIntent, history: history.current });
      remember('user', text);
      remember('assistant', r.memory);
      dispatch({ type: 'push', turn: { id: nextId(), role: 'assistant', text: r.text, cards: r.cards, draft: r.draft, open: r.open, suggestions: r.suggestions } });
      if (r.open) onOpen.current?.(r.open);
      const auto = r.cards.find((c) => c.autoOpen && c.target);
      if (auto?.target) onOpenTarget.current?.(auto.target);
      else if (r.text && !r.draft) onSpeak.current?.(r.text);
    } catch (e) {
      const code: AiErrorCode = isAiError(e) ? e.code : 'failed';
      if (code === 'failed') reportError('assistant:ask', e);
      dispatch({ type: 'push', turn: { id: nextId(), role: 'assistant', error: code } });
    } finally {
      inFlight.current = false;
      dispatch({ type: 'busy', busy: false });
    }
  }, []);

  const clear = useCallback(() => {
    history.current = [];
    dispatch({ type: 'clear' });
    void saveSetting(CHAT_KEY, '').catch(swallow('assistant:clear'));
  }, []);

  const settle = useCallback((turnId: string, status: 'accepted' | 'rejected', message?: string) => {
    dispatch({ type: 'settle', turnId, status, message });
  }, []);

  return { ...state, ask, clear, settle, onSpeak, onOpen, onOpenTarget };
}
