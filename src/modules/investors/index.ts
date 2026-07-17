/** Investors module barrel — the one import site for the investors feature. */
export { InvestorProfileScreen } from './screens/InvestorProfileScreen';
export { InvestorsScreen } from './screens/InvestorsScreen';
export { InvestmentEntryScreen } from './screens/InvestmentEntryScreen';
export { ExitWizardScreen } from './screens/ExitWizardScreen';
export { AllocationScreen } from './screens/AllocationScreen';

// Shared investor components used by other modules (project attach / add person).
export { InvestorSheet, type InvestorInclusion, type InvestorOption } from './components/InvestorSheet';
export { InvestorPersonSheet } from './components/InvestorPersonSheet';

export { useInvestorProfile, type InvestorProfileData } from './hooks/useInvestorProfile';
