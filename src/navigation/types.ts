import type { NavigatorScreenParams } from '@react-navigation/native';

import type { TxnDirection } from '@/db';

/** Pre-filled values when opening the entry screen to correct a mistake. */
export interface EntryPrefill {
  amount?: number;
  categoryId?: string | null;
  note?: string;
  accountId?: string;
  projectId?: string;
  partyId?: string | null;
}

/** Bottom tab routes (two each side of the center "+" FAB). */
export type TabParamList = {
  Home: undefined;
  Projects: undefined;
  Plots: undefined;
  Investors: undefined;
};

/** Root stack: the tabs plus full-screen/modal destinations. */
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  QuickEntry: undefined;
  Settings: undefined;
  NewCompany: undefined;
  DevTools: undefined;
  // Cash flow. 'assets' (from the Home hero) widens the page to the full
  // asset picture; 'cash' / no param (from the Cash tile) is cash-only.
  Cash: { scope?: 'cash' | 'assets' } | undefined;
  Accounts: undefined;
  AccountDetail: { accountId: string };
  Transfer: { fromAccountId?: string } | undefined;
  // Reports hub (reached from Settings)
  Reports: undefined;
  Allocation: undefined;
  // Plots
  /** `forProjectId` set → the created plot is auto-included in that project. */
  NewPlot: { forProjectId?: string } | undefined;
  PlotDetail: { plotId: string };
  // Projects
  NewProject: undefined;
  ProjectDetail: { projectId: string };
  ConstructionDetail: { projectId: string };
  SaleDetail: { projectId: string };
  Transactions: { projectId: string };
  PhotoDiary: { projectId: string };
  Settlement: { projectId: string };
  // Money entry
  Entry: { direction: TxnDirection; prefill?: EntryPrefill };
  MaterialEntry: undefined;
  // Material bookings
  Bookings: undefined;
  BookingDetail: { bookingId: string };
  Investment: { investorId?: string } | undefined;
  // Udhaar
  Udhaar: undefined;
  UdhaarDetail: { udhaarId: string };
  // Labor (worker khatas across projects)
  Labor: undefined;
  LaborerDetail: { laborerId: string };
  // Investors
  InvestorProfile: { investorId: string };
  ExitWizard: { investorId: string };
  // Reports / misc
  Report: { type: 'summary' | 'pnl' | 'cashflow' | 'expense' | 'investment' | 'roi' | 'accounts' };
  ComingSoon: { titleKey: string };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
