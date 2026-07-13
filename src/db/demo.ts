import { getDatabase } from './database';
import { seedDefaults } from './migrations';
import {
  createCompany,
  getActiveCompanyId,
  addAccount,
  addInvestment,
  addInvestor,
  addLaborer,
  addPlotExpense,
  addPlotPayment,
  addProjectInvestor,
  addSaleReceipt,
  addTransaction,
  attachLaborerToProject,
  createPlot,
  createProject,
  createUdhaar,
  giveUdhaar,
  listCategories,
  markAttendance,
  upsertSale,
} from './repositories';
import { nowISO } from './uuid';

/** Tables exposed in DevTools, in display order. */
export const TABLE_NAMES = [
  'companies',
  'accounts',
  'plots',
  'projects',
  'parties',
  'categories',
  'transactions',
  'investors',
  'project_investors',
  'capital_ledger',
  'laborers',
  'project_laborers',
  'labor_attendance',
  'udhaar',
  'milestones',
  'documents',
  'sales',
  'sale_receipts',
  'material_bookings',
  'material_deliveries',
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
 * re-seed the defaults (categories) so the app keeps working. Append-only
 * ledgers included — this is a full reset, intended for DevTools only.
 *
 * Foreign-key enforcement is turned OFF for the duration: the schema has a
 * projects ↔ plots cycle, so no single delete order satisfies every FK. When
 * we're deleting everything anyway, enforcement only gets in the way (with it
 * ON the wipe threw partway and left data behind). It's restored afterward.
 */
export async function clearAllData(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync('PRAGMA foreign_keys = OFF');
  try {
    for (const t of TABLE_NAMES) {
      await db.runAsync(`DELETE FROM ${t}`);
    }
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON');
  }
  await seedDefaults(db);
}

/**
 * Populate a realistic demo dataset end-to-end (accounts → plot → project →
 * construction + labor → sale → udhaar) so every screen has something to show.
 * Returns the new project id.
 */
export async function loadDemoData(): Promise<string> {
  const today = nowISO().slice(0, 10);

  // Demo data needs a company to live in (creating one also activates it).
  if (!getActiveCompanyId()) await createCompany({ name: 'Demo Company' });

  // Accounts  the cash-flow backbone.
  const bank = await addAccount({ name: 'HBL Bank', type: 'BANK', openingBalance: 30_000_000 });
  const cash = await addAccount({ name: 'Cash in Hand', type: 'CASH', openingBalance: 2_000_000 });

  const cats = await listCategories();
  const catId = (nameEn: string) => cats.find((c) => c.name_en === nameEn)?.id ?? null;

  // A standalone plot: deal 18,000,000  token + bayana paid, tax on top.
  const plot = await createPlot({
    name: 'Bahria Town C-123',
    society: 'Bahria Town',
    block: 'C',
    plotNo: '123',
    sizeValue: 10,
    sizeUnit: 'MARLA',
    dealPrice: 18_000_000,
    sellerName: 'Haji Saleem',
    sellerPhone: '0300-1234567',
  });
  await addPlotPayment({ plotId: plot.id, payType: 'TOKEN', amount: 500_000, date: today, accountId: bank.id });
  await addPlotPayment({ plotId: plot.id, payType: 'BAYANA', amount: 4_500_000, date: today, accountId: bank.id });
  await addPlotExpense({
    plotId: plot.id,
    categoryId: catId('Transfer Fees & Tax')!,
    amount: 350_000,
    date: today,
    accountId: bank.id,
  });

  // Project on that plot with two investors.
  const project = await createProject({ name: 'Bahria Town Villa', plotId: plot.id });
  const inv1 = await addInvestor({ name: 'Amir Khan', phone: '0300-1234567' });
  const inv2 = await addInvestor({ name: 'Amanullah', phone: '0321-7654321' });
  await addProjectInvestor({ projectId: project.id, investorId: inv1.id, committedAmount: 6_000_000, profitPct: 20 });
  await addProjectInvestor({ projectId: project.id, investorId: inv2.id, committedAmount: 4_000_000, profitPct: 15 });
  await addInvestment({ investorId: inv1.id, projectId: project.id, amount: 6_000_000, date: today, accountId: bank.id });
  await addInvestment({ investorId: inv2.id, projectId: project.id, amount: 4_000_000, date: today, accountId: bank.id });

  // Construction spend + a worker with attendance.
  await addTransaction({
    direction: 'OUT', amount: 185_000, date: today, accountId: bank.id,
    projectId: project.id, phase: 'CONSTRUCTION', categoryId: catId('Cement'), description: 'Cement 100 bori',
  });
  await addTransaction({
    direction: 'OUT', amount: 95_000, date: today, accountId: cash.id,
    projectId: project.id, phase: 'CONSTRUCTION', categoryId: catId('Sand/Crush'), description: 'Bajri 2 trolley',
  });
  const worker = await addLaborer({ name: 'Ustad Akram', phone: '0321-1112222' });
  const pl = await attachLaborerToProject({ projectId: project.id, laborerId: worker.id, dailyWage: 1500 });
  await markAttendance({ projectLaborerId: pl.id, date: today, status: 'FULL' });

  // A sale in progress: deal 32,000,000, token received.
  const sale = await upsertSale(project.id, { agreedPrice: 32_000_000, buyerName: 'Mr. Tariq' });
  await addSaleReceipt({ saleId: sale.id, amount: 1_000_000, date: today, accountId: bank.id, payType: 'TOKEN' });

  // An udhaar given from cash.
  const udhaar = await createUdhaar({ personName: 'Bilal (neighbour)' });
  await giveUdhaar({ udhaarId: udhaar.id, amount: 150_000, date: today, accountId: cash.id });

  return project.id;
}
