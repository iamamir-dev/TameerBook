import type { AiErrorCode } from '@/ai';
import type { TranslationKey } from '@/i18n';

/** One plain sentence per failure code (see `AiError`). */
export const AI_ERROR_KEY: Record<AiErrorCode, TranslationKey> = {
  disabled: 'aiErrDisabled',
  offline: 'aiErrOffline',
  timeout: 'aiErrTimeout',
  noProvider: 'aiErrNoProvider',
  noVoice: 'aiErrNoVoice',
  quota: 'aiErrQuota',
  badkey: 'aiErrBadKey',
  unparseable: 'aiErrUnparseable',
  failed: 'aiErrFailed',
};

/** Codes the user can fix in Settings (the error card offers a shortcut). */
export const SETTINGS_FIXABLE: ReadonlySet<AiErrorCode> = new Set<AiErrorCode>(['disabled', 'noProvider', 'noVoice', 'badkey']);
