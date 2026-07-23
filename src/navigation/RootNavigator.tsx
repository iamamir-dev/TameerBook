import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { useTheme } from '@/theme';

import { AccountDetailScreen } from '@/screens/AccountDetailScreen';
import { AccountsScreen } from '@/screens/AccountsScreen';
import { BookingsScreen, NewPurchaseOrderScreen, PurchaseOrderDetailScreen } from '@/modules/bookings';
import { CashScreen } from '@/screens/CashScreen';
import { ComingSoonScreen } from '@/screens/ComingSoonScreen';
import { ConstructionDetailScreen } from '@/screens/ConstructionDetailScreen';
import { DevToolsScreen } from '@/screens/DevToolsScreen';
import { EntryScreen } from '@/screens/EntryScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import {
  AllocationScreen,
  ExitWizardScreen,
  InvestmentEntryScreen,
  InvestorProfileScreen,
  InvestorsScreen,
} from '@/modules/investors';
import { LaborerDetailScreen, LaborScreen } from '@/modules/labor';
import { MaterialEntryScreen } from '@/screens/MaterialEntryScreen';
import { NewCompanyScreen } from '@/screens/NewCompanyScreen';
import { NewPlotScreen } from '@/screens/NewPlotScreen';
import { EditPlotScreen } from '@/screens/EditPlotScreen';
import { NewProjectWizard } from '@/screens/NewProjectWizard';
import { PhotoDiaryScreen } from '@/screens/PhotoDiaryScreen';
import { PlotDetailScreen } from '@/screens/PlotDetailScreen';
import { PlotsScreen } from '@/screens/PlotsScreen';
import { ProjectDetailScreen } from '@/screens/ProjectDetailScreen';
import { ProjectsScreen } from '@/screens/ProjectsScreen';
import { QuickEntryScreen } from '@/screens/QuickEntryScreen';
import { ReportScreen } from '@/screens/ReportScreen';
import { CategoriesScreen } from '@/screens/CategoriesScreen';
import { SignatureScreen } from '@/screens/SignatureScreen';
import { StatusesScreen } from '@/screens/StatusesScreen';
import { CompanyDetailScreen } from '@/screens/CompanyDetailScreen';
import { ReportsScreen } from '@/screens/ReportsScreen';
import { SaleDetailScreen } from '@/screens/SaleDetailScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { SettlementScreen } from '@/screens/SettlementScreen';
import { TransactionsScreen } from '@/screens/TransactionsScreen';
import { TransferScreen } from '@/screens/TransferScreen';
import { UdhaarDetailScreen } from '@/screens/UdhaarDetailScreen';
import { UdhaarScreen } from '@/screens/UdhaarScreen';

import { TabBar } from './TabBar';
import type { RootStackParamList, TabParamList } from './types';

const Tab = createMaterialTopTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Swipeable (pager-backed) tabs: dragging horizontally pages between Home /
 * Projects / Reports / Investors and commits as you swipe, with the custom
 * floating `TabBar` pinned to the bottom. The center "+" FAB is part of the
 * TabBar (it pushes QuickEntry on the root stack), so it is NOT a tab itself.
 * Screens render their own `AppHeader`.
 */
function Tabs(): React.JSX.Element {
  const theme = useTheme();
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      tabBarPosition="bottom"
      screenOptions={{
        swipeEnabled: true,
        // Tab-bar taps switch instantly (no slide through intermediate pages,
        // which made every shadowed card flicker); swipe gestures still animate.
        animationEnabled: false,
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Projects" component={ProjectsScreen} />
      <Tab.Screen name="Plots" component={PlotsScreen} />
      <Tab.Screen name="Investors" component={InvestorsScreen} />
    </Tab.Navigator>
  );
}

const MODAL = { presentation: 'modal', animation: 'slide_from_bottom' } as const;

/**
 * Root stack: the tab shell plus full-screen destinations. Money-entry
 * screens slide up as modals; everything else pushes. Headers are off
 * everywhere because each screen owns its AppHeader.
 */
export function RootNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="QuickEntry" component={QuickEntryScreen} options={MODAL} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="NewCompany" component={NewCompanyScreen} />
      <Stack.Screen name="DevTools" component={DevToolsScreen} />

      {/* Cash flow (hub reached from Home) */}
      <Stack.Screen name="Cash" component={CashScreen} />
      <Stack.Screen name="Accounts" component={AccountsScreen} />
      <Stack.Screen name="AccountDetail" component={AccountDetailScreen} />
      <Stack.Screen name="Transfer" component={TransferScreen} options={MODAL} />

      {/* Reports hub (reached from Settings) */}
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="Categories" component={CategoriesScreen} />
      <Stack.Screen name="Statuses" component={StatusesScreen} />
      <Stack.Screen name="Signature" component={SignatureScreen} />
      <Stack.Screen name="CompanyDetail" component={CompanyDetailScreen} />
      <Stack.Screen name="Allocation" component={AllocationScreen} />

      {/* Plots (the list itself is a tab) */}
      <Stack.Screen name="NewPlot" component={NewPlotScreen} />
      <Stack.Screen name="EditPlot" component={EditPlotScreen} />
      <Stack.Screen name="PlotDetail" component={PlotDetailScreen} />

      {/* Projects */}
      <Stack.Screen name="NewProject" component={NewProjectWizard} />
      <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
      <Stack.Screen name="ConstructionDetail" component={ConstructionDetailScreen} />
      <Stack.Screen name="SaleDetail" component={SaleDetailScreen} />
      <Stack.Screen name="Transactions" component={TransactionsScreen} />
      <Stack.Screen name="PhotoDiary" component={PhotoDiaryScreen} />
      <Stack.Screen name="Settlement" component={SettlementScreen} />

      {/* Money entry */}
      <Stack.Screen name="Entry" component={EntryScreen} options={MODAL} />
      <Stack.Screen name="MaterialEntry" component={MaterialEntryScreen} options={MODAL} />
      <Stack.Screen name="Investment" component={InvestmentEntryScreen} options={MODAL} />

      {/* Material bookings */}
      <Stack.Screen name="Bookings" component={BookingsScreen} />
      <Stack.Screen name="NewPurchaseOrder" component={NewPurchaseOrderScreen} />
      <Stack.Screen name="PurchaseOrderDetail" component={PurchaseOrderDetailScreen} />

      {/* Udhaar */}
      <Stack.Screen name="Udhaar" component={UdhaarScreen} />
      <Stack.Screen name="UdhaarDetail" component={UdhaarDetailScreen} />

      {/* Labor (worker khatas across projects) */}
      <Stack.Screen name="Labor" component={LaborScreen} />
      <Stack.Screen name="LaborerDetail" component={LaborerDetailScreen} />

      {/* Investors / reports / misc */}
      <Stack.Screen name="InvestorProfile" component={InvestorProfileScreen} />
      <Stack.Screen name="ExitWizard" component={ExitWizardScreen} />
      <Stack.Screen name="Report" component={ReportScreen} />
      <Stack.Screen name="ComingSoon" component={ComingSoonScreen} />
    </Stack.Navigator>
  );
}
