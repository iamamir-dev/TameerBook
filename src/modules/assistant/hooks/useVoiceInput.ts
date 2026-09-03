import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { useCallback, useRef, useState } from 'react';

import { buildWorld, getAiTransport, isAiError, isWhisperNoise, MIN_RECORDING_MS, transcriptionPrompt, type AiErrorCode } from '@/ai';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { reportError } from '@/utils/log';

export type VoiceStatus = 'idle' | 'recording' | 'transcribing';
export type VoiceError = AiErrorCode | 'mic' | 'tooShort' | 'silence';

export interface VoiceInput {
  status: VoiceStatus;
  /** Set when the last attempt failed; cleared on the next start. */
  error: VoiceError | null;
  /** Developer detail for the last failure (shown in dev builds only). */
  errorDetail: string | null;
  /** Begin recording (hold). */
  start: () => Promise<void>;
  /** Stop, transcribe, and hand the text to `onText`. */
  stop: () => Promise<void>;
}

/**
 * Mono 16 kHz AAC in an .m4a container on every platform. (The LOW_QUALITY
 * preset records .3gp/AMR on Android, which Whisper endpoints reject.)
 */
const SPEECH_RECORDING = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 48000,
};

/**
 * Hold-to-talk: records with `expo-audio` (works in Expo Go), then sends the
 * clip to Whisper through the configured transport. The vocabulary prompt
 * carries the user's material / supplier / worker names so spellings match.
 *
 * Start and stop are SERIALIZED: `pressIn` kicks off an async chain
 * (permission → prepare → record) and a quick `pressOut` can arrive before it
 * finishes. `stop` therefore waits for the in-flight start and, if the hold
 * was released before recording began, cancels instead of calling
 * `recorder.stop()` on an idle recorder (which Android rejects).
 */
export function useVoiceInput(onText: (text: string) => void): VoiceInput {
  const recorder = useAudioRecorder(SPEECH_RECORDING);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<VoiceError | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  /** True while the recorder is actually capturing. */
  const active = useRef(false);
  /** The start chain in flight (resolves true once recording began). */
  const starting = useRef<Promise<boolean> | null>(null);
  /** Set when the user released before the start chain finished. */
  const cancelled = useRef(false);

  const fail = (code: VoiceError, detail?: string) => {
    setError(code);
    setErrorDetail(detail ?? null);
  };

  const start = useCallback(async () => {
    if (active.current || starting.current) return;
    setError(null);
    setErrorDetail(null);
    cancelled.current = false;
    starting.current = (async () => {
      try {
        const perm = await requestRecordingPermissionsAsync();
        if (!perm.granted) {
          fail('mic');
          return false;
        }
        if (cancelled.current) return false;
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        if (cancelled.current) return false;
        recorder.record();
        active.current = true;
        setStatus('recording');
        return true;
      } catch (e) {
        reportError('voice:start', e);
        fail('mic', e instanceof Error ? e.message : undefined);
        return false;
      } finally {
        starting.current = null;
      }
    })();
    await starting.current;
  }, [recorder]);

  const stop = useCallback(async () => {
    // Released while still starting: cancel the start instead of stopping.
    if (starting.current) {
      cancelled.current = true;
      const began = await starting.current;
      if (!began) {
        setStatus('idle');
        fail('tooShort');
        return;
      }
    }
    if (!active.current) return;
    active.current = false;
    setStatus('transcribing');
    try {
      const durationMs = recorder.getStatus().durationMillis;
      try {
        await recorder.stop();
      } catch (e) {
        // Stopping an already-idle recorder: treat as an accidental tap.
        reportError('voice:recorderStop', e);
        fail('tooShort');
        return;
      }
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      // A tap, not a hold: nothing to transcribe (and Whisper would hallucinate).
      if (durationMs < MIN_RECORDING_MS) {
        fail('tooShort');
        return;
      }
      const uri = recorder.uri;
      if (!uri) throw new Error('no recording');
      const transport = getAiTransport();
      const world = await buildWorld();
      const text = await transport.transcribe(
        { uri, name: 'speech.m4a', type: 'audio/m4a' },
        // Urdu UI → tell Whisper it's Urdu (stops Hindi/Arabic mis-detection);
        // English UI → auto-detect (mixed Roman Urdu/English speech).
        { prompt: transcriptionPrompt(world), language: useSettingsStore.getState().language === 'ur' ? 'ur' : undefined }
      );
      if (isWhisperNoise(text, transcriptionPrompt(world))) {
        fail('silence');
        return;
      }
      onText(text);
    } catch (e) {
      const code: AiErrorCode = isAiError(e) ? e.code : 'failed';
      if (code === 'failed') reportError('voice:stop', e);
      fail(code, e instanceof Error ? e.message : String(e));
    } finally {
      setStatus('idle');
    }
  }, [recorder, onText]);

  return { status, error, errorDetail, start, stop };
}
