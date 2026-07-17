import { useCallback } from 'react';

import {
  getInvestor,
  getInvestorProjectReturns,
  getInvestorSummary,
  listAccountsWithBalance,
  listInvestorActivity,
  type AccountWithBalance,
  type InvestorActivityRow,
  type InvestorProjectReturn,
  type InvestorRow,
  type InvestorSummary,
} from '@/db';
import { useFocusData, type FocusData } from '@/hooks';

export interface InvestorProfileData {
  investor: InvestorRow | null;
  summary: InvestorSummary | null;
  returns: InvestorProjectReturn[];
  activity: InvestorActivityRow[];
  accounts: AccountWithBalance[];
}

const EMPTY: InvestorProfileData = {
  investor: null,
  summary: null,
  returns: [],
  activity: [],
  accounts: [],
};

/** One data hook for the investor profile — replaces the Promise.all + 6 setters. */
export function useInvestorProfile(investorId: string): FocusData<InvestorProfileData> {
  const loader = useCallback(async (): Promise<InvestorProfileData> => {
    const [investor, summary, returns, activity, accounts] = await Promise.all([
      getInvestor(investorId),
      getInvestorSummary(investorId),
      getInvestorProjectReturns(investorId),
      listInvestorActivity(investorId),
      listAccountsWithBalance(),
    ]);
    return { investor, summary, returns, activity, accounts };
  }, [investorId]);

  return useFocusData<InvestorProfileData>(loader, EMPTY);
}
