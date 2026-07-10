import { useCallback, useMemo } from 'react';

import type { IconKey, SelectOption } from '@/components/ui';
import type { AccountWithBalance, CategoryRow } from '@/db';
import { useTranslation } from '@/i18n';
import { formatRupees } from '@/utils/money';

/** Account rows → SelectSheet options (name + live balance + type icon). */
export function useAccountOptions(accounts: AccountWithBalance[]): SelectOption[] {
  return useMemo(
    () =>
      accounts.map((a) => ({
        id: a.id,
        label: a.name,
        subtitle: formatRupees(a.balance),
        icon: (a.type === 'BANK' ? 'bank' : a.type === 'CASH' ? 'rupee' : 'balance') as IconKey,
      })),
    [accounts]
  );
}

/** Category display name in the active language (was re-implemented per screen). */
export function useCategoryLabel(): (c: CategoryRow) => string {
  const { language } = useTranslation();
  return useCallback((c: CategoryRow) => (language === 'ur' ? c.name_ur : c.name_en), [language]);
}
