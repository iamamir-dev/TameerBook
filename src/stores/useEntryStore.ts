import { create } from 'zustand';

import type { PaymentMode } from '@/db';

/**
 * Sticky preferences for the Quick Entry flow so rapid repeat entries keep the
 * user's last project and payment mode (a key part of the "<15s" goal).
 */
interface EntryState {
  lastProjectId: string | null;
  lastMode: PaymentMode;
  setLastProjectId: (id: string) => void;
  setLastMode: (mode: PaymentMode) => void;
}

export const useEntryStore = create<EntryState>((set) => ({
  lastProjectId: null,
  lastMode: 'CASH',
  setLastProjectId: (lastProjectId) => set({ lastProjectId }),
  setLastMode: (lastMode) => set({ lastMode }),
}));
