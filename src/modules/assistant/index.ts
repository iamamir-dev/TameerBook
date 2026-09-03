/** Assistant module — proactive insights, ledger questions, voice + bill drafts. */
export { AssistantScreen } from './screens/AssistantScreen';
export { AssistantFab } from './components/AssistantFab';
export { InsightsCard, openInsightTarget } from './components/InsightsCard';
export { useInsights, type InsightsData } from './hooks/useInsights';
export { insightLabels, INSIGHT_ICON, SEVERITY_TONE } from './utils/insightLabels';
export { useBillReader, type BillReader } from './hooks/useBillReader';
export { AI_ERROR_KEY } from './utils/aiErrors';
export { speak, stopSpeaking } from './utils/speech';
