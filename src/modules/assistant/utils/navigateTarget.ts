import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { AnswerTarget } from '@/ai';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Open the screen an answer is about ("Open" on an answer card). */
export function navigateToTarget(nav: Nav, target: AnswerTarget): void {
  switch (target.screen) {
    case 'ProjectDetail':
      nav.navigate('ProjectDetail', { projectId: target.projectId });
      return;
    case 'ConstructionDetail':
      nav.navigate('ConstructionDetail', { projectId: target.projectId });
      return;
    case 'SaleDetail':
      nav.navigate('SaleDetail', { projectId: target.projectId });
      return;
    case 'LaborerDetail':
      nav.navigate('LaborerDetail', { laborerId: target.laborerId });
      return;
    case 'PlotDetail':
      nav.navigate('PlotDetail', { plotId: target.plotId });
      return;
    case 'InvestorProfile':
      nav.navigate('InvestorProfile', { investorId: target.investorId });
      return;
    case 'UdhaarDetail':
      nav.navigate('UdhaarDetail', { udhaarId: target.udhaarId });
      return;
    case 'Report':
      nav.navigate('Report', { type: target.type });
      return;
    case 'Plots':
      nav.navigate('Tabs', { screen: 'Plots' });
      return;
    case 'Investors':
      nav.navigate('Tabs', { screen: 'Investors' });
      return;
    case 'Cash':
    case 'Labor':
    case 'Udhaar':
    case 'Bookings':
    case 'Accounts':
    case 'Reports':
      nav.navigate(target.screen);
      return;
  }
}
