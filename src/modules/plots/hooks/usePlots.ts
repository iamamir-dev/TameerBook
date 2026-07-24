import { useCallback } from 'react';

import {
  getPlotSummary,
  getProject,
  listAccountsWithBalance,
  listCategories,
  listDocuments,
  listPlotSummaries,
  listPlotTransactions,
  type AccountWithBalance,
  type CategoryRow,
  type DocumentRow,
  type PlotSummary,
  type ProjectRow,
  type TransactionRow,
} from '@/db';
import { useFocusData } from '@/hooks';

/** Plots home list: every plot's summary (status is auto-derived, not stored). */
export function usePlotsList() {
  const loader = useCallback(async () => ({ plots: await listPlotSummaries() }), []);
  return useFocusData(loader, { plots: [] as PlotSummary[] });
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
}

/** One plot's page data (summary, ledger, documents, accounts). */
export function usePlotDetail(plotId: string) {
  const loader = useCallback(async (): Promise<PlotDetailData> => {
    const summary = await getPlotSummary(plotId);
    const [accounts, categories, docs, txns, linkedProject] = await Promise.all([
      listAccountsWithBalance(),
      listCategories(),
      listDocuments('plot', plotId),
      listPlotTransactions(plotId),
      summary.plot.project_id ? getProject(summary.plot.project_id) : Promise.resolve(null),
    ]);
    return { summary, linkedProject, accounts, categories, docs, txns };
  }, [plotId]);
  return useFocusData<PlotDetailData>(loader, {
    summary: null,
    linkedProject: null,
    accounts: [],
    categories: [],
    docs: [],
    txns: [],
  });
}
