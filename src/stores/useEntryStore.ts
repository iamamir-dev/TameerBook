import { create } from 'zustand';

/**
 * Sticky preferences for the Quick Entry flow so rapid repeat entries keep the
 * user's last project and account (a key part of the "<15s" goal).
 */
interface EntryState {
  lastProjectId: string | null;
  lastAccountId: string | null;
  setLastProjectId: (id: string) => void;
  setLastAccountId: (id: string) => void;
}

export const useEntryStore = create<EntryState>((set) => ({
  lastProjectId: null,
  lastAccountId: null,
  setLastProjectId: (lastProjectId) => set({ lastProjectId }),
  setLastAccountId: (lastAccountId) => set({ lastAccountId }),
}));
