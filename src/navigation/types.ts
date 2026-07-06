import type { NavigatorScreenParams } from '@react-navigation/native';

import type { PaymentMode, TxnDirection } from '@/db';

/** Pre-filled values when opening the entry screen to correct a mistake. */
export interface EntryPrefill {
  amount?: number;
  categoryId?: string | null;
  note?: string;
  mode?: PaymentMode;
  projectId?: string;
  partyId?: string | null;
}

/** Bottom tab routes. Home, Projects, Reports, Investors — entry is the FAB. */
export type TabParamList = {
  Home: undefined;
  Projects: undefined;
  Reports: undefined;
  Investors: undefined;
};

/** Root stack: the tabs plus full-screen/modal destinations. */
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  QuickEntry: undefined;
  Settings: undefined;
  DevTools: undefined;
  NewProject: undefined;
  ProjectDetail: { projectId: string };
  Entry: { direction: TxnDirection; prefill?: EntryPrefill };
  ComingSoon: { titleKey: string };
  Transactions: { projectId: string };
  Udhaar: undefined;
  MaterialEntry: undefined;
  DehariEntry: undefined;
  PhotoDiary: { projectId: string };
  SupplierLedger: { partyId: string };
  Investment: { investorId?: string } | undefined;
  InvestorProfile: { investorId: string };
  ExitWizard: { investorId: string };
  Settlement: { projectId: string };
  Report: { type: 'summary' | 'pnl' | 'cashflow' | 'expense' | 'investment' | 'roi' };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
