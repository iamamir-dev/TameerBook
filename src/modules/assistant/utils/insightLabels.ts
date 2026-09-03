import type { IconKey } from '@/components/ui';
import type { TranslationKey } from '@/i18n';
import type { ColorKey } from '@/utils/tones';
import type { InsightKind, InsightLabels, InsightSeverity } from '@/utils/insights';

/** Build the translated fragments `describeInsight` assembles a sentence from. */
export function insightLabels(t: (k: TranslationKey) => string): InsightLabels {
  return {
    owed: t('insightOwed'),
    days: t('daysLabel'),
    daysLeft: t('daysLeftSuffix'),
    overdue: t('overdueLabel'),
    duplicate: t('insightDuplicate'),
    usual: t('insightUsual'),
    deadlineSoon: t('deadlineSoon'),
    buyerOwes: t('insightBuyerOwes'),
    loanUnpaid: t('insightLoanUnpaid'),
    poUndelivered: t('insightPoUndelivered'),
    spendUp: t('insightSpendUp'),
  };
}

/** Icon per insight kind — always paired with the sentence (icon + text rule). */
export const INSIGHT_ICON: Record<InsightKind, IconKey> = {
  workerOwed: 'dehari',
  duplicateEntry: 'ledger',
  rateOutlier: 'material',
  transferDeadline: 'today',
  buyerOutstanding: 'aamdani',
  staleUdhaar: 'ledger',
  poUndelivered: 'truck',
  spendSpike: 'trendUp',
};

/** Severity → theme tone (never color alone: the icon + text carry meaning too). */
export const SEVERITY_TONE: Record<InsightSeverity, ColorKey> = {
  critical: 'danger',
  warning: 'gold',
  info: 'primary',
};
