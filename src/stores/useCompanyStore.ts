import { create } from 'zustand';

import {
  hydrateActiveCompany,
  listCompanies,
  setActiveCompany,
} from '@/db/repositories/companies';
import type { CompanyRow } from '@/db/schema';

/**
 * The company/workspace switcher. `activeCompanyId` mirrors the module-level
 * value inside the companies repository (which every scoped query reads);
 * this store makes it reactive for the UI. Switching companies bumps
 * `switchCount` so screens can re-key/refetch everything.
 */
interface CompanyState {
  ready: boolean;
  companies: CompanyRow[];
  activeCompanyId: string | null;
  /** Increments on every switch  use as a key to force refetches. */
  switchCount: number;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  switchTo: (companyId: string) => Promise<void>;
}

export const useCompanyStore = create<CompanyState>((set, get) => ({
  ready: false,
  companies: [],
  activeCompanyId: null,
  switchCount: 0,

  hydrate: async () => {
    const activeId = await hydrateActiveCompany();
    const companies = await listCompanies();
    set({ ready: true, companies, activeCompanyId: activeId });
  },

  refresh: async () => {
    const companies = await listCompanies();
    set({ companies });
  },

  switchTo: async (companyId) => {
    if (companyId === get().activeCompanyId) return;
    await setActiveCompany(companyId);
    set((s) => ({ activeCompanyId: companyId, switchCount: s.switchCount + 1 }));
  },
}));
