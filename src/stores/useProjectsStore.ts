import { create } from 'zustand';

import { listProjectSummaries, type ProjectSummary } from '@/db';

/**
 * Projects loaded from SQLite (with live progress + money totals). Screens call
 * `refresh()` on focus / after a mutation so the list, Home rail and detail
 * all stay in sync with the database.
 */
interface ProjectsState {
  items: ProjectSummary[];
  loading: boolean;
  loaded: boolean;
  refresh: () => Promise<void>;
}

export const useProjectsStore = create<ProjectsState>((set) => ({
  items: [],
  loading: false,
  loaded: false,
  refresh: async () => {
    set({ loading: true });
    try {
      const items = await listProjectSummaries();
      set({ items, loading: false, loaded: true });
    } catch {
      set({ loading: false, loaded: true });
    }
  },
}));
