import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { isDuplicateAccount, isInsufficientFunds, isLimitExceeded } from '@/db';
import { useTranslation } from '@/i18n';
import { reportError } from '@/utils/log';

export interface SaveAction {
  saving: boolean;
  /**
   * Run a save. Returns true on success so callers reset/close/navigate only
   * when the write actually landed. Business guards (insufficient funds,
   * over-limit, duplicate name) alert their specific message; anything else is
   * reported and alerted generically — never an unhandled rejection.
   */
  run: (fn: () => Promise<void>) => Promise<boolean>;
}

/**
 * The one way screens run a DB write from a button. Replaces the copy-pasted
 * try/catch/finally blocks that each handled a different subset of errors
 * (and re-threw the rest into `onPress`, crashing silently).
 */
export function useSaveAction(): SaveAction {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  const run = useCallback(
    async (fn: () => Promise<void>): Promise<boolean> => {
      setSaving(true);
      try {
        await fn();
        return true;
      } catch (e) {
        if (isInsufficientFunds(e)) Alert.alert(t('insufficientFunds'));
        else if (isLimitExceeded(e)) Alert.alert(t('exceedsRemaining'));
        else if (isDuplicateAccount(e)) Alert.alert(t('duplicateAccount'));
        else {
          reportError('screen:save', e);
          Alert.alert(t('errorTitle'), t('errorBody'));
        }
        return false;
      } finally {
        setSaving(false);
      }
    },
    [t]
  );

  return { saving, run };
}
