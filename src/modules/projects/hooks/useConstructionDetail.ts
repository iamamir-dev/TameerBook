import dayjs from 'dayjs';
import { useCallback } from 'react';

import {
  getConstructionSummary,
  getProject,
  listAccountsWithBalance,
  listLaborers,
  listProjectLaborers,
  listProjectPhaseTransactions,
  type AccountWithBalance,
  type ConstructionSummary,
  type LaborerRow,
  type ProjectLaborerSummary,
  type ProjectRow,
  type TransactionRow,
} from '@/db';
import { useFocusData } from '@/hooks';

export interface ConstructionDetailData {
  summary: ConstructionSummary | null;
  project: ProjectRow | null;
  accounts: AccountWithBalance[];
  workers: ProjectLaborerSummary[];
  allLaborers: LaborerRow[];
  txns: TransactionRow[];
}

/** The CONSTRUCTION phase page data in one struct. */
export function useConstructionDetail(projectId: string) {
  const loader = useCallback(async (): Promise<ConstructionDetailData> => {
    const [summary, project, accounts, workers, txns, allLaborers] = await Promise.all([
      getConstructionSummary(projectId, dayjs().format('YYYY-MM')),
      getProject(projectId),
      listAccountsWithBalance(),
      listProjectLaborers(projectId),
      listProjectPhaseTransactions(projectId, 'CONSTRUCTION'),
      listLaborers(),
    ]);
    return { summary, project, accounts, workers, txns, allLaborers };
  }, [projectId]);
  return useFocusData<ConstructionDetailData>(loader, {
    summary: null,
    project: null,
    accounts: [],
    workers: [],
    allLaborers: [],
    txns: [],
  });
}
