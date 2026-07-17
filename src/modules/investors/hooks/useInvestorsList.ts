import { useCallback } from 'react';
import { Alert } from 'react-native';

import { deleteInvestor, isInvestorInUse, listInvestorsWithCapital, type InvestorWithCapital } from '@/db';
import { useFocusData, useSaveAction, type FocusData } from '@/hooks';
import { useTranslation } from '@/i18n';

export interface InvestorsList extends FocusData<InvestorWithCapital[]> {
  /** Confirm + delete an investor (blocked with a specific alert if in use). */
  remove: (inv: InvestorWithCapital) => void;
}

/** Investors list data + delete flow — the screen stays presentational. */
export function useInvestorsList(): InvestorsList {
  const { t } = useTranslation();
  const loader = useCallback(() => listInvestorsWithCapital(), []);
  const focus = useFocusData<InvestorWithCapital[]>(loader, []);
  const { run } = useSaveAction();

  const remove = useCallback(
    (inv: InvestorWithCapital) => {
      Alert.alert(inv.name, t('deleteInvestorConfirm'), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            await run(async () => {
              try {
                await deleteInvestor(inv.id);
              } catch (e) {
                if (isInvestorInUse(e)) {
                  Alert.alert(t('investorInUse'));
                  return;
                }
                throw e;
              }
              await focus.reload();
            });
          },
        },
      ]);
    },
    [run, t, focus]
  );

  return { ...focus, remove };
}
