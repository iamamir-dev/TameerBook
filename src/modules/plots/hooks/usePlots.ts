import { useCallback } from 'react';

import {
  getPlotSummary,
  getProject,
  listAccountsWithBalance,
  listCategories,
  listDocuments,
  listPlotSummaries,
  listPlotTransactions,
  listStages,
  type AccountWithBalance,
  type CategoryRow,
  type DocumentRow,
  type PlotSummary,
  type ProjectRow,
  type StageRow,
  type TransactionRow,
} from '@/db';
import { useFocusData } from '@/hooks';

/** Plots home list: every plot's summary + the PLOT display statuses. */
export function usePlotsList() {
  const loader = useCallback(async () => {
    const [plots, stages] = await Promise.all([listPlotSummaries(), listStages('PLOT')]);
    return { plots, stages };
  }, []);
  return useFocusData(loader, { plots: [] as PlotSummary[], stages: [] as StageRow[] });
}

export interface PlotDetailData {
  summary: PlotSummary | null;
  linkedProject: ProjectRow | null;
  accounts: AccountWithBalance[];
  /** All categories — only for resolving ledger row labels (the expense picker
   *  uses the scoped `useModuleCategories('plot')` instead). */
  categories: CategoryRow[];
  docs: DocumentRow[];
  txns: TransactionRow[];
  stages: StageRow[];
}

/** One plot's page data (summary, ledger, documents, accounts, statuses). */
export function usePlotDetail(plotId: string) {
  const loader = useCallback(async (): Promise<PlotDetailData> => {
    const summary = await getPlotSummary(plotId);
    const [accounts, categories, docs, txns, linkedProject, stages] = await Promise.all([
      listAccountsWithBalance(),
      listCategories(),
      listDocuments('plot', plotId),
      listPlotTransactions(plotId),
      summary.plot.project_id ? getProject(summary.plot.project_id) : Promise.resolve(null),
      listStages('PLOT'),
    ]);
    return { summary, linkedProject, accounts, categories, docs, txns, stages };
  }, [plotId]);
  return useFocusData<PlotDetailData>(loader, {
    summary: null,
    linkedProject: null,
    accounts: [],
    categories: [],
    docs: [],
    txns: [],
    stages: [],
  });
}
