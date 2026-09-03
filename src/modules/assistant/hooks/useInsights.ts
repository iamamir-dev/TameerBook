import { useCallback } from 'react';

import { listInsights } from '@/db';
import { useFocusData, type FocusData } from '@/hooks';
import type { Insight } from '@/utils/insights';

export interface InsightsData {
  insights: Insight[];
}

/**
 * The ranked offline insights for the active company. Reloads on focus and
 * after every save (via `useFocusData`), so a payment that clears a worker's
 * debt removes its suggestion immediately.
 */
export function useInsights(): FocusData<InsightsData> {
  const loader = useCallback(async () => ({ insights: await listInsights() }), []);
  return useFocusData(loader, { insights: [] });
}
