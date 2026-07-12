import { create } from 'zustand';

/**
 * A global "the data changed" counter. `useSaveAction` bumps it after EVERY
 * successful write, and `useFocusReload` re-runs its screen's load when it
 * changes — so every mounted screen (including the always-mounted tab scenes
 * behind the current one) refreshes in real time after any save, instead of
 * waiting for a focus event that may never re-fire.
 */
interface DataVersionState {
  version: number;
  bump: () => void;
}

export const useDataVersion = create<DataVersionState>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));
