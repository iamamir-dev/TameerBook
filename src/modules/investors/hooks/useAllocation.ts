import { useCallback } from 'react';

import {
  getInvestorProjectReturns,
  getProjectCapitalSummary,
  listInvestorsWithCapacity,
  listProjectSummaries,
  type InvestorCapacity,
  type InvestorProjectReturn,
  type ProjectCapitalSummary,
  type ProjectSummary,
} from '@/db';
import { useFocusData, type FocusData } from '@/hooks';

/** A project paired with its live capital summary (Σ paid-in shares). */
export interface ProjectAllocation {
  summary: ProjectSummary;
  capital: ProjectCapitalSummary;
}

/** An investor paired with their per-project invested breakdown. */
export interface InvestorAllocation {
  investor: InvestorCapacity;
  returns: InvestorProjectReturn[];
}

export interface AllocationData {
  projects: ProjectAllocation[];
  investors: InvestorAllocation[];
}

/** Loads where all capital sits — per project and per investor. */
export function useAllocation(): FocusData<AllocationData> {
  const loader = useCallback(async (): Promise<AllocationData> => {
    const [summaries, investorRows] = await Promise.all([
      listProjectSummaries(),
      listInvestorsWithCapacity(),
    ]);
    const [capitals, returns] = await Promise.all([
      Promise.all(summaries.map((s) => getProjectCapitalSummary(s.project.id))),
      Promise.all(investorRows.map((inv) => getInvestorProjectReturns(inv.id))),
    ]);
    return {
      projects: summaries.map((summary, i) => ({ summary, capital: capitals[i] })),
      investors: investorRows.map((investor, i) => ({ investor, returns: returns[i] })),
    };
  }, []);

  return useFocusData<AllocationData>(loader, { projects: [], investors: [] });
}
