import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { useCallback, useRef, useState } from 'react';

import { buildWorld, getAiTransport, isAiError, transcriptionPrompt, type AiErrorCode } from '@/ai';
import { reportError } from '@/utils/log';

export type VoiceStatus = 'idle' | 'recording' | 'transcribing';

export interface VoiceInput {
  status: VoiceStatus;
  /** Set when the last attempt failed; cleared on the next start. */
  error: AiErrorCode | 'mic' | null;
  /** Begin recording (hold). */
  start: () => Promise<void>;
  /** Stop, transcribe, and hand the text to `onText`. */
  stop: () => Promise<void>;
}

/**
 * Hold-to-talk: records with `expo-audio` (works in Expo Go), then sends the
 * clip to Whisper through the configured transport. The vocabulary prompt
 * carries the user's material / supplier / worker names so spellings match.
 */
export function useVoiceInput(onText: (text: string) => void): VoiceInput {
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<VoiceInput['error']>(null);
  const active = useRef(false);

  const start = useCallback(async () => {
    if (active.current) return;
    setError(null);
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setError('mic');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      active.current = true;
      setStatus('recording');
    } catch (e) {
      reportError('voice:start', e);
      setError('mic');
    }
  }, [recorder]);

  const stop = useCallback(async () => {
    if (!active.current) return;
    active.current = false;
    setStatus('transcribing');
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      const uri = recorder.uri;
      if (!uri) throw new Error('no recording');
      const transport = getAiTransport();
      const world = await buildWorld();
      const text = await transport.transcribe(
        { uri, name: 'speech.m4a', type: 'audio/m4a' },
        { prompt: transcriptionPrompt(world) }
      );
      if (text) onText(text);
    } catch (e) {
      const code: AiErrorCode = isAiError(e) ? e.code : 'failed';
      if (code === 'failed') reportError('voice:stop', e);
      setError(code);
    } finally {
      setStatus('idle');
    }
  }, [recorder, onText]);

  return { status, error, start, stop };
}
