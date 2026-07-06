import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { useTheme } from '@/theme';

import { HomeScreen } from '@/screens/HomeScreen';
import { InvestorsScreen } from '@/screens/InvestorsScreen';
import { ProjectsScreen } from '@/screens/ProjectsScreen';
import { ComingSoonScreen } from '@/screens/ComingSoonScreen';
import { DehariEntryScreen } from '@/screens/DehariEntryScreen';
import { DevToolsScreen } from '@/screens/DevToolsScreen';
import { EntryScreen } from '@/screens/EntryScreen';
import { ExitWizardScreen } from '@/screens/ExitWizardScreen';
import { InvestmentEntryScreen } from '@/screens/InvestmentEntryScreen';
import { InvestorProfileScreen } from '@/screens/InvestorProfileScreen';
import { SettlementScreen } from '@/screens/SettlementScreen';
import { MaterialEntryScreen } from '@/screens/MaterialEntryScreen';
import { PhotoDiaryScreen } from '@/screens/PhotoDiaryScreen';
import { SupplierLedgerScreen } from '@/screens/SupplierLedgerScreen';
import { NewProjectWizard } from '@/screens/NewProjectWizard';
import { ProjectDetailScreen } from '@/screens/ProjectDetailScreen';
import { QuickEntryScreen } from '@/screens/QuickEntryScreen';
import { ReportScreen } from '@/screens/ReportScreen';
import { ReportsScreen } from '@/screens/ReportsScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { TransactionsScreen } from '@/screens/TransactionsScreen';
import { UdhaarScreen } from '@/screens/UdhaarScreen';

import { TabBar } from './TabBar';
import type { RootStackParamList, TabParamList } from './types';

const Tab = createMaterialTopTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * The three bottom-tab destinations. The center "+" FAB is part of the custom
 * `TabBar` (it pushes the QuickEntry route on the root stack), so it is NOT a
 * tab itself — keeping Home / Projects / Investors balanced around it.
 *
 * Swipeable (pager-backed) tabs: dragging horizontally pages between Home /
 * Projects / Reports / Investors and commits as you swipe, with the custom
 * floating `TabBar` pinned to the bottom. Screens render their own `AppHeader`.
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
      <Tab.Screen name="Reports" component={ReportsScreen} />
      <Tab.Screen name="Investors" component={InvestorsScreen} />
    </Tab.Navigator>
  );
}

/**
 * Root stack: the tab shell plus full-screen destinations. Quick Entry slides
 * up as a modal (it's the FAB's full-screen launcher); Settings pushes
 * normally. Headers are off everywhere because each screen owns its AppHeader.
 */
export function RootNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen
        name="QuickEntry"
        component={QuickEntryScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="DevTools" component={DevToolsScreen} />
      <Stack.Screen name="NewProject" component={NewProjectWizard} />
      <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
      <Stack.Screen
        name="Entry"
        component={EntryScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="ComingSoon" component={ComingSoonScreen} />
      <Stack.Screen name="Transactions" component={TransactionsScreen} />
      <Stack.Screen name="Udhaar" component={UdhaarScreen} />
      <Stack.Screen
        name="MaterialEntry"
        component={MaterialEntryScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="DehariEntry"
        component={DehariEntryScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="PhotoDiary" component={PhotoDiaryScreen} />
      <Stack.Screen name="SupplierLedger" component={SupplierLedgerScreen} />
      <Stack.Screen
        name="Investment"
        component={InvestmentEntryScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="InvestorProfile" component={InvestorProfileScreen} />
      <Stack.Screen name="ExitWizard" component={ExitWizardScreen} />
      <Stack.Screen name="Settlement" component={SettlementScreen} />
      <Stack.Screen name="Report" component={ReportScreen} />
    </Stack.Navigator>
  );
}
