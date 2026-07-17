import { useCallback } from 'react';

import { type CategoryContext, type CategoryRow, listCategoriesForContext } from '@/db';

import { useFocusData, type FocusData } from './useFocusData';

/**
 * A module's bookable categories, scoped to where they're used and kept in the
 * user's Settings order. The one hook every entry sheet uses so no module ever
 * shows another module's categories (e.g. the Plot page never offers Groceries).
 * Reloads automatically when categories change (data-version bump).
 */
export function useModuleCategories(context: CategoryContext): FocusData<CategoryRow[]> {
  const loader = useCallback(() => listCategoriesForContext(context), [context]);
  return useFocusData<CategoryRow[]>(loader, []);
}
