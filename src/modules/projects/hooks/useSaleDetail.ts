import { useCallback } from 'react';

import {
  getProject,
  getSaleSummary,
  listAccountsWithBalance,
  listParties,
  listProjectPhaseTransactions,
  type AccountWithBalance,
  type PartyRow,
  type ProjectRow,
  type SaleSummary,
  type TransactionRow,
} from '@/db';
import { useFocusData } from '@/hooks';

export interface SaleDetailData {
  summary: SaleSummary | null;
  project: ProjectRow | null;
  txns: TransactionRow[];
  accounts: AccountWithBalance[];
  buyers: PartyRow[];
}

/** The SALE phase page data in one struct (deal, ledger, accounts, buyers). */
export function useSaleDetail(projectId: string) {
  const loader = useCallback(async (): Promise<SaleDetailData> => {
    const [summary, project, txns, accounts, buyers] = await Promise.all([
      getSaleSummary(projectId),
      getProject(projectId),
      listProjectPhaseTransactions(projectId, 'SALE'),
      listAccountsWithBalance(),
      listParties('BUYER'),
    ]);
    return { summary, project, txns, accounts, buyers };
  }, [projectId]);
  return useFocusData<SaleDetailData>(loader, { summary: null, project: null, txns: [], accounts: [], buyers: [] });
}
