/**
 * UI kit barrel. Import components from '@/components/ui' everywhere.
 * Every component here reads design tokens via `useTheme()` only  none
 * hardcode a color, font size, spacing value, or radius.
 */
export { AppText } from './AppText';
export { AppIcon } from './AppIcon';
export { AppButton, type ButtonVariant } from './AppButton';
export { AppToggle } from './AppToggle';
export { AppCard } from './AppCard';
export { StatCard, type Trend } from './StatCard';
export { AmountInput } from './AmountInput';
export { AppListRow, type EntryDirection } from './AppListRow';
export { LedgerTable, type LedgerRow } from './LedgerTable';
export { MonthCalendar, type DayVisual, type MonthCalendarProps } from './MonthCalendar';
export { DateField } from './DateField';
export { AccountCard } from './AccountCard';
export { PhaseCard, type PhaseMetric } from './PhaseCard';
export { EmptyState } from './EmptyState';
export { LoadErrorState } from './LoadErrorState';
export { AppHeader } from './AppHeader';
export { StickyFooter } from './StickyFooter';
export { SelectSheet, type SelectOption } from './SelectSheet';
export { ICONS, iconFor, type GlyphName, type IconKey } from './icons';
