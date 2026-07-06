import { getDatabase } from './database';
import { seedDefaults } from './migrations';
import {
  addCapitalEntry,
  addInvestor,
  addParty,
  addProjectInvestor,
  addProperty,
  addPropertyPayment,
  addTransaction,
  createProject,
  createSale,
  listCategories,
  listMilestones,
  setMilestoneStatus,
} from './repositories';
import { nowISO } from './uuid';

/** Tables exposed in DevTools, in display order. */
export const TABLE_NAMES = [
  'projects',
  'properties',
  'property_payments',
  'parties',
  'categories',
  'transactions',
  'investors',
  'project_investors',
  'capital_ledger',
  'milestones',
  'documents',
  'sales',
  'sale_receipts',
] as const;

/** Row count per table (for the DevTools dashboard). */
export async function getTableCounts(): Promise<Record<string, number>> {
  const db = await getDatabase();
  const out: Record<string, number> = {};
  for (const t of TABLE_NAMES) {
    const row = await db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) AS c FROM ${t}`);
    out[t] = row?.c ?? 0;
  }
  return out;
}

/**
 * Wipe EVERY row from every table (demo data and real data alike), then
 * re-seed the default categories so the app keeps working. Append-only ledgers
 * included — this is a full reset, intended for DevTools only. Deletes children
 * before parents so it is safe even if foreign keys are enforced.
 */
export async function clearAllData(): Promise<void> {
  const db = await getDatabase();
  for (const t of [...TABLE_NAMES].reverse()) {
    await db.runAsync(`DELETE FROM ${t}`);
  }
  await seedDefaults(db); // restore the default expense/income categories
}

/**
 * Populate one realistic demo project end-to-end so every screen/report has
 * something to show. Returns the new project id.
 */
export async function loadDemoData(): Promise<string> {
  const today = nowISO().slice(0, 10);

  const project = await createProject({
    name: 'Bahria Town Villa',
    stage: 'CONSTRUCTION',
    startDate: today,
  });

  // Mark the first three milestones complete.
  const milestones = await listMilestones(project.id);
  for (const ms of milestones.slice(0, 3)) {
    await setMilestoneStatus(ms.id, 'DONE', today);
  }

  // Property + a token payment.
  const property = await addProperty({
    projectId: project.id,
    society: 'Bahria Town',
    block: 'C',
    plotNo: '123',
    sizeValue: 10,
    sizeUnit: 'MARLA',
    agreedPrice: 18_000_000,
    sellerName: 'Haji Saleem',
    sellerPhone: '0300-1234567',
  });
  await addPropertyPayment({
    propertyId: property.id,
    type: 'TOKEN',
    amount: 500_000,
    date: today,
    mode: 'BANK',
  });

  // Parties.
  await addParty({ type: 'SELLER', name: 'Haji Saleem', phone: '0300-1234567' });
  const contractor = await addParty({ type: 'CONTRACTOR', name: 'Ustad Akram', phone: '0321-1112222' });
  const buyer = await addParty({ type: 'BUYER', name: 'Mr. Tariq', phone: '0345-9998887' });

  // Categories (seeded on first run) — look up a few by English name.
  const cats = await listCategories();
  const catId = (nameEn: string) => cats.find((c) => c.name_en === nameEn)?.id ?? null;

  // Transactions.
  await addTransaction({
    projectId: project.id,
    direction: 'IN',
    categoryId: catId('Investor Investment'),
    amount: 600_000,
    date: today,
    mode: 'CASH',
    description: 'Sharik ki investment',
  });
  await addTransaction({
    projectId: project.id,
    direction: 'OUT',
    categoryId: catId('Cement'),
    amount: 185_000,
    date: today,
    mode: 'BANK',
    description: 'Cement 100 bori',
  });
  await addTransaction({
    projectId: project.id,
    direction: 'OUT',
    categoryId: catId('Labor Dehari'),
    amount: 24_000,
    date: today,
    mode: 'CASH',
    partyId: contractor.id,
    description: '8 mazdoor',
  });

  // Investors + capital ledger.
  const inv1 = await addInvestor({ name: 'Haji Saleem', phone: '0300-1234567' });
  const inv2 = await addInvestor({ name: 'Tariq Sb', phone: '0321-7654321' });
  const pi1 = await addProjectInvestor({
    projectId: project.id,
    investorId: inv1.id,
    committedAmount: 6_000_000,
  });
  const pi2 = await addProjectInvestor({
    projectId: project.id,
    investorId: inv2.id,
    committedAmount: 4_000_000,
  });
  await addCapitalEntry({ projectInvestorId: pi1.id, entryType: 'INITIAL', amount: 6_000_000, date: today });
  await addCapitalEntry({ projectInvestorId: pi2.id, entryType: 'INITIAL', amount: 4_000_000, date: today });

  // A sale in progress.
  await createSale({ projectId: project.id, buyerPartyId: buyer.id, agreedPrice: 22_000_000 });

  return project.id;
}
