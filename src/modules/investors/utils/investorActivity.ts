import dayjs from 'dayjs';

import type { ActivityItem } from '@/components/ActivityList';
import type { InvestorActivityRow } from '@/db';
import type { TranslationKey } from '@/i18n';

/** Human label key per activity entry-type (capital entry types + cash TXN_*). */
export const ENTRY_LABEL: Record<string, TranslationKey> = {
  INITIAL: 'ctInitial',
  ADDITIONAL: 'ctAdditional',
  TRANSFER_IN: 'ctTransferIn',
  TRANSFER_OUT: 'ctTransferOut',
  WITHDRAWAL: 'ctWithdrawal',
  EXIT_SETTLEMENT: 'ctExitSettlement',
  PROFIT_PAYOUT: 'ctProfitPayout',
  DONATION: 'ctDonation',
  LOSS_ADJ: 'ctLossAdj',
  TXN_IN: 'newInvestment',
  TXN_OUT: 'payout',
};

/** The i18n key for an activity entry-type (falls back to the history title). */
export function entryLabelKey(type: string): TranslationKey {
  return ENTRY_LABEL[type] ?? 'capitalTimeline';
}

/**
 * Map the repo's unified investor activity rows to `ActivityItem`s for the
 * reusable `ActivityList`: transaction-backed rows stay editable + open the
 * rich detail sheet; settlement rows get read-only detail rows.
 */
export function buildInvestorActivityItems(
  activity: InvestorActivityRow[],
  t: (k: TranslationKey) => string
): ActivityItem[] {
  return activity.map((a) => {
    const label = t(entryLabelKey(a.entryType));
    return {
      id: a.id,
      title: a.projectName || label,
      date: a.date,
      amount: a.amount,
      direction: a.direction,
      typeLabel: label,
      txn: a.txn ?? undefined,
      editable: a.editable,
      detail: a.txn
        ? undefined
        : [
            { label: t('category'), value: label },
            ...(a.projectName ? [{ label: t('projects'), value: a.projectName }] : []),
            { label: t('date'), value: dayjs(a.date).format('DD MMM YYYY') },
          ],
    };
  });
}
