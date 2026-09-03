import {
  listAccounts,
  listCategories,
  listInvestors,
  listLaborers,
  listParties,
  listPlots,
  listProjects,
} from '@/db';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { todayISO } from '@/utils/date';

import type { CategoryNamed } from './drafts';
import type { World } from './prompts';

/**
 * Snapshot of the user's own vocabulary for one assistant turn: the names the
 * model may use and the ids we resolve them back to. Deliberately EXCLUDES
 * phones, CNICs, bank details and balances — names only.
 */
export async function buildWorld(): Promise<World> {
  const [projects, plots, accounts, categories, parties, workers, investors] = await Promise.all([
    listProjects(),
    listPlots(),
    listAccounts(),
    listCategories(),
    listParties(),
    listLaborers(),
    listInvestors(),
  ]);
  const cats: CategoryNamed[] = categories.map((c) => ({
    id: c.id,
    name: c.name_en,
    alt: c.name_ur ? [c.name_ur] : undefined,
    type: c.type,
    unit: c.default_unit,
    parentId: c.parent_id,
  }));
  const cs = useCompanyStore.getState();
  const company = cs.companies.find((c) => c.id === cs.activeCompanyId);
  return {
    today: todayISO(),
    language: useSettingsStore.getState().language,
    company: company ? { name: company.name, owner: company.owner_name } : undefined,
    projects: projects.filter((p) => p.status === 'ACTIVE' || p.status === 'ON_HOLD').map((p) => ({ id: p.id, name: p.name })),
    plots: plots.map((p) => ({ id: p.id, name: p.name })),
    accounts: accounts.map((a) => ({ id: a.id, name: a.name })),
    categories: cats,
    parties: parties.map((p) => ({ id: p.id, name: p.name })),
    workers: workers.map((w) => ({ id: w.id, name: w.name })),
    investors: investors.map((i) => ({ id: i.id, name: i.name })),
  };
}
