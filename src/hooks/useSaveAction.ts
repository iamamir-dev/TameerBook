import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import {
  isAttendanceConflict,
  isDuplicateAccount,
  isCategoryInUse,
  isInsufficientFunds,
  isInvestorAlreadyExited,
  isLimitExceeded,
  isOneTimePayment,
  isPlotUnavailable,
  isProfitPctRange,
  isStageInUse,
  isProjectClosed,
  isWageNotSet,
  isWorkerInactive,
  PAY_TYPE_LABEL_KEYS,
} from '@/db';
import { useTranslation } from '@/i18n';
import { useDataVersion } from '@/stores/useDataVersion';
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
        // Every successful write announces itself so every mounted screen
        // (useFocusReload subscribers) refreshes in real time.
        useDataVersion.getState().bump();
        return true;
      } catch (e) {
        if (isInsufficientFunds(e)) Alert.alert(t('insufficientFunds'));
        else if (isLimitExceeded(e)) Alert.alert(t('exceedsRemaining'));
        else if (isDuplicateAccount(e)) Alert.alert(t('duplicateAccount'));
        else if (isAttendanceConflict(e))
          Alert.alert(t('attendanceConflict'), e.conflictingProjectName || undefined);
        else if (isProjectClosed(e)) Alert.alert(t('projectClosedNote'));
        else if (isPlotUnavailable(e)) Alert.alert(t('plotTaken'));
        else if (isOneTimePayment(e))
          Alert.alert(t('payTypeOnce'), `${t(PAY_TYPE_LABEL_KEYS[e.payType])}`);
        else if (isWageNotSet(e)) Alert.alert(t('setWageFirst'));
        else if (isWorkerInactive(e)) Alert.alert(t('workerInactive'));
        else if (isInvestorAlreadyExited(e)) Alert.alert(t('investorAlreadyExited'));
        else if (isProfitPctRange(e)) Alert.alert(t('profitPctRange'));
        else if (isCategoryInUse(e)) Alert.alert(t('categoryInUse'));
        else if (isStageInUse(e)) Alert.alert(t('stageInUse'));
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
