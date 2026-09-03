import { useCallback, useReducer, useRef } from 'react';

import {
  buildWorld,
  getAiTransport,
  isAiError,
  resolveDraft,
  routeUtterance,
  runIntent,
  type AiErrorCode,
  type Answer,
  type ResolvedDraft,
} from '@/ai';
import { reportError } from '@/utils/log';

/** One message in the conversation. */
export type Turn =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; kind: 'text'; text: string }
  | { id: string; role: 'assistant'; kind: 'answer'; answer: Answer }
  | { id: string; role: 'assistant'; kind: 'draft'; resolved: ResolvedDraft }
  | { id: string; role: 'assistant'; kind: 'error'; code: AiErrorCode };

interface State {
  turns: Turn[];
  busy: boolean;
}

type Action = { type: 'push'; turn: Turn } | { type: 'busy'; busy: boolean } | { type: 'clear' };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'push':
      return { ...s, turns: [...s.turns, a.turn] };
    case 'busy':
      return { ...s, busy: a.busy };
    case 'clear':
      return { turns: [], busy: false };
  }
}

let seq = 0;
const nextId = (): string => `t${Date.now().toString(36)}${(seq++).toString(36)}`;

export interface AssistantApi extends State {
  /** Send one utterance (typed or transcribed) through the router. */
  ask: (text: string) => Promise<void>;
  clear: () => void;
  /** Fires with the sentence to read aloud after an assistant turn lands. */
  onSpeak: React.MutableRefObject<((text: string) => void) | null>;
}

/**
 * The assistant conversation: user text → router (one JSON call) → either a
 * repository-backed answer, a resolved draft, or a short reply. The model
 * never touches the database; every write still goes through a confirm.
 */
export function useAssistant(): AssistantApi {
  const [state, dispatch] = useReducer(reducer, { turns: [], busy: false });
  const onSpeak = useRef<((text: string) => void) | null>(null);
  const inFlight = useRef(false);

  const ask = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || inFlight.current) return;
    inFlight.current = true;
    dispatch({ type: 'push', turn: { id: nextId(), role: 'user', text } });
    dispatch({ type: 'busy', busy: true });
    try {
      const transport = getAiTransport();
      const world = await buildWorld();
      // Validate-and-repair routing: a bad shape or an unknown name gets ONE
      // corrective follow-up before we show anything.
      const { result: routed, resolved: pre } = await routeUtterance(transport, world, text);
      if (routed.kind === 'question') {
        const answer = await runIntent(routed.intent, world);
        dispatch({ type: 'push', turn: { id: nextId(), role: 'assistant', kind: 'answer', answer } });
        onSpeak.current?.(answer.speak);
      } else if (routed.kind === 'draft') {
        const resolved = pre ?? resolveDraft(routed.draft, world);
        dispatch({ type: 'push', turn: { id: nextId(), role: 'assistant', kind: 'draft', resolved } });
      } else {
        dispatch({ type: 'push', turn: { id: nextId(), role: 'assistant', kind: 'text', text: routed.reply } });
        onSpeak.current?.(routed.reply);
      }
    } catch (e) {
      const code: AiErrorCode = isAiError(e) ? e.code : 'failed';
      if (code === 'failed') reportError('assistant:ask', e);
      dispatch({ type: 'push', turn: { id: nextId(), role: 'assistant', kind: 'error', code } });
    } finally {
      inFlight.current = false;
      dispatch({ type: 'busy', busy: false });
    }
  }, []);

  const clear = useCallback(() => dispatch({ type: 'clear' }), []);

  return { ...state, ask, clear, onSpeak };
}
