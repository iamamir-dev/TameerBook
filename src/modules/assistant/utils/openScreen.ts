import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { OpenScreen } from '@/ai';
import type { TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Human label per openable screen. */
export const OPEN_SCREEN_LABEL: Record<OpenScreen, TranslationKey> = {
  NewProject: 'newProject',
  NewPlot: 'plotsTitle',
  NewPurchaseOrder: 'bookingsTitle',
  QuickEntry: 'quickEntry',
  Transfer: 'transferTitleV2',
  Labor: 'laborTitle',
  Udhaar: 'udhaar',
  Bookings: 'bookingsTitle',
  Cash: 'tabCash',
  Accounts: 'accountsTitle',
  Reports: 'reports',
  Categories: 'manageCategories',
  Settings: 'settings',
  Projects: 'projects',
  Plots: 'plotsTitle',
  Investors: 'investors',
};

/** Navigate to a screen the user asked the assistant to open. */
export function openScreen(nav: Nav, screen: OpenScreen): void {
  switch (screen) {
    case 'Projects':
      nav.navigate('Tabs', { screen: 'Projects' });
      return;
    case 'Plots':
      nav.navigate('Tabs', { screen: 'Plots' });
      return;
    case 'Investors':
      nav.navigate('Tabs', { screen: 'Investors' });
      return;
    case 'NewPlot':
    case 'NewPurchaseOrder':
    case 'Transfer':
    case 'Cash':
    case 'Categories':
      nav.navigate(screen, undefined);
      return;
    default:
      nav.navigate(screen);
  }
}
