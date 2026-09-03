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
 * Hold-to-talk: records with `expo-audio` (works in Expo Go), then sends the
 * clip to Whisper through the configured transport. The vocabulary prompt
 * carries the user's material / supplier / worker names so spellings match.
 */
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

export function useVoiceInput(onText: (text: string) => void): VoiceInput {
  const recorder = useAudioRecorder(SPEECH_RECORDING);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<VoiceError | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const active = useRef(false);
  const fail = (code: VoiceError, detail?: string) => {
    setError(code);
    setErrorDetail(detail ?? null);
  };

  const start = useCallback(async () => {
    if (active.current) return;
    setError(null);
    setErrorDetail(null);
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        fail('mic');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      active.current = true;
      setStatus('recording');
    } catch (e) {
      reportError('voice:start', e);
      fail('mic', e instanceof Error ? e.message : undefined);
    }
  }, [recorder]);

  const stop = useCallback(async () => {
    if (!active.current) return;
    active.current = false;
    setStatus('transcribing');
    try {
      const durationMs = recorder.getStatus().durationMillis;
      await recorder.stop();
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
      if (isWhisperNoise(text)) {
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
