import dayjs from 'dayjs';
import { useCallback } from 'react';

import {
  getConstructionSummary,
  getPlotSummary,
  getProjectCapitalSummary,
  getProjectCost,
  getProjectDistribution,
  getProjectSettlementSummary,
  getProjectSummary,
  getSaleSummary,
  getSettledSettlement,
  listDocuments,
  listInvestorsWithCapacity,
  listPlots,
  type ConstructionSummary,
  type DocumentRow,
  type InvestorCapacity,
  type OwnershipShare,
  type PlotRow,
  type PlotSummary,
  type ProjectCost,
  type ProjectDistribution,
  type ProjectSummary,
  type SaleSummary,
  type SettledReport,
  type SettlementSummary,
} from '@/db';
import { useFocusData } from '@/hooks';

export interface ProjectDetailData {
  summary: ProjectSummary | null;
  cost: ProjectCost | null;
  plotSum: PlotSummary | null;
  constr: ConstructionSummary | null;
  saleSum: SaleSummary | null;
  shares: OwnershipShare[];
  settlement: SettlementSummary | null;
  distribution: ProjectDistribution | null;
  photos: DocumentRow[];
  freePlots: PlotRow[];
  settledReport: SettledReport | null;
  allInvestors: InvestorCapacity[];
}

const INITIAL: ProjectDetailData = {
  summary: null,
  cost: null,
  plotSum: null,
  constr: null,
  saleSum: null,
  shares: [],
  settlement: null,
  distribution: null,
  photos: [],
  freePlots: [],
  settledReport: null,
  allInvestors: [],
};

/**
 * One project's full page data in a single struct (replaces the 13 scattered
 * useStates + two-round-trip loader the screen used to hold). The summary loads
 * first so plot/settlement fan-out can key off plot_id / settled_at.
 */
export function useProjectDetail(projectId: string) {
  const loader = useCallback(async (): Promise<ProjectDetailData> => {
    const summary = await getProjectSummary(projectId);
    const p = summary?.project;
    const [cost, constr, saleSum, cap, settlement, plotSum, photos, distribution, freePlots, settledReport, allInvestors] =
      await Promise.all([
        getProjectCost(projectId),
        getConstructionSummary(projectId, dayjs().format('YYYY-MM')),
        getSaleSummary(projectId),
        getProjectCapitalSummary(projectId),
        getProjectSettlementSummary(projectId),
        p?.plot_id ? getPlotSummary(p.plot_id) : Promise.resolve(null),
        listDocuments('site_photo', projectId),
        p?.settled_at ? getProjectDistribution(projectId) : Promise.resolve(null),
        p?.plot_id ? Promise.resolve<PlotRow[]>([]) : listPlots('OWNED'),
        p?.settled_at ? getSettledSettlement(projectId) : Promise.resolve(null),
        listInvestorsWithCapacity(),
      ]);
    return { summary, cost, plotSum, constr, saleSum, shares: cap.shares, settlement, distribution, photos, freePlots, settledReport, allInvestors };
  }, [projectId]);

  return useFocusData<ProjectDetailData>(loader, INITIAL);
}
