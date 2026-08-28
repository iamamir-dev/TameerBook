import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import { getDatabase } from './database';
import type { CategoryRow } from './schema';
import {
  addAccount,
  addDelivery,
  addDocument,
  addInvestment,
  addInvestor,
  addLaborer,
  addParty,
  addPlotExpense,
  addPlotPayment,
  addPlotSaleReceipt,
  addProjectInvestor,
  addSaleCost,
  addSaleReceipt,
  addTransaction,
  attachLaborerToProject,
  createCompany,
  createPlot,
  createProject,
  createPurchaseOrder,
  createUdhaar,
  getAccountFlowReport,
  getActiveCompanyId,
  getBookingSummary,
  getCashFlow,
  getCompanyAssets,
  getExpenseByCategory,
  getLaborBalance,
  getPlotSummary,
  getPnl,
  getPurchaseOrder,
  getRoiReport,
  getTotalBalance,
  getUdhaarTotals,
  giveUdhaar,
  hydrateActiveCompany,
  listAccounts,
  listAccountsWithBalance,
  listAllCompanyTransactions,
  listBuyerPaymentCategories,
  listCategories,
  listInvestorsWithCapital,
  listLaborersWithTotals,
  listPlotSummaries,
  listPlots,
  listProjectSummaries,
  listPurchaseOrders,
  listRecentTransactions,
  listSellerPaymentCategories,
  listUdhaar,
  markAttendance,
  markPlotTransferred,
  payBooking,
  payLaborer,
  receiveAndPay,
  resolveTxnModuleTarget,
  returnUdhaar,
  setPlotSale,
  setProjectStatus,
  transferBetween,
  upsertSale,
  voidTransaction,
} from './repositories';

/**
 * DEV-ONLY load generator + profiler.
 *
 * Every row is written through the SAME repository functions the screens call —
 * `addPlotPayment`, `addInvestment`, `receiveAndPay`, `markAttendance`,
 * `addSaleReceipt`, `giveUdhaar` and friends. Nothing is hand-inserted, so every
 * category, phase tag, `pay_type`, cross-link, derived total and status flip is
 * exactly what a real user's data looks like. That is the whole point: data that
 * merely *sits* in the tables tells you nothing, because the screens read
 * derived views (deal remaining, labour owed, PO payRemaining, settlement) that
 * only come out right when the write path produced them.
 *
 * Consequence: it is not fast. The repositories validate, re-read and recompute
 * per row — the same work the app does. Budget minutes, not seconds, and watch
 * the live counter.
 *
 * Everything lands in a DEDICATED company (named with the `Stress Test` prefix),
 * so `clearStressData()` removes it wholesale and your real books are never
 * touched. Creating the company also switches to it.
 */

/** Company-name prefix that marks a generated workspace. */
const STRESS_CO_PREFIX = 'Stress Test';

/** Where generated receipt photos land (real files, real bytes on disk). */
const PHOTO_DIR = `${FileSystem.documentDirectory}stress-photos/`;

export interface StressPreset {
  key: string;
  label: string;
  note: string;
  projects: number;
  /** Plots that never join a project (standalone flips). */
  standalonePlots: number;
  investors: number;
  /** Workers. Each is attached to exactly ONE project — the app forbids a
   *  worker earning on two projects the same day. */
  laborers: number;
  suppliers: number;
  accounts: number;
  /** Direct material/site expenses booked per project. */
  expensesPerProject: number;
  /** Purchase orders raised per project (each 2–4 line items). */
  posPerProject: number;
  /** Attendance days logged per worker. */
  attendanceDays: number;
  udhaar: number;
  /** Household expenses booked outside any project. */
  homeExpenses: number;
  photos: number;
  /** Calendar span the history is spread over. */
  years: number;
}

export const STRESS_PRESETS: StressPreset[] = [
  {
    key: 'small',
    label: 'Small — 2 years',
    note: '~1.5k transactions. Finishes in about a minute.',
    projects: 5,
    standalonePlots: 12,
    investors: 8,
    laborers: 15,
    suppliers: 12,
    accounts: 4,
    expensesPerProject: 60,
    posPerProject: 3,
    attendanceDays: 45,
    udhaar: 8,
    homeExpenses: 150,
    photos: 30,
    years: 2,
  },
  {
    key: 'medium',
    label: 'Medium — 3 years, busy builder',
    note: '~7k transactions. A few minutes.',
    projects: 20,
    standalonePlots: 45,
    investors: 25,
    laborers: 60,
    suppliers: 30,
    accounts: 6,
    expensesPerProject: 120,
    posPerProject: 5,
    attendanceDays: 90,
    udhaar: 25,
    homeExpenses: 500,
    photos: 120,
    years: 3,
  },
  {
    key: 'large',
    label: 'Large — 5 years, never deleted',
    note: '~28k transactions + ~20k attendance rows. Expect 10–20 minutes.',
    projects: 60,
    standalonePlots: 140,
    investors: 60,
    laborers: 180,
    suppliers: 60,
    accounts: 8,
    expensesPerProject: 200,
    posPerProject: 8,
    attendanceDays: 120,
    udhaar: 60,
    homeExpenses: 1500,
    photos: 300,
    years: 5,
  },
  {
    key: 'extreme',
    label: 'Extreme — beyond any real customer',
    note: '~80k transactions. Leave it running; this can take an hour.',
    projects: 150,
    standalonePlots: 350,
    investors: 120,
    laborers: 450,
    suppliers: 120,
    accounts: 10,
    expensesPerProject: 300,
    posPerProject: 10,
    attendanceDays: 120,
    udhaar: 120,
    homeExpenses: 4000,
    photos: 600,
    years: 6,
  },
];

/**
 * Rough transaction count a preset will produce — for the confirm dialog only.
 * Derived from the same shape the generator writes: per-project construction
 * spend and PO payments, per-plot seller/buyer instalments, wages, sales,
 * udhaar and household spend.
 */
export function estimateTransactions(p: StressPreset): number {
  const perProject = p.expensesPerProject + p.posPerProject * 2.5 + 8;
  const perPlot = 6;
  const wages = p.laborers * 2;
  return Math.round(
    p.projects * perProject + (p.standalonePlots + p.projects) * perPlot + wages + p.udhaar * 2 + p.homeExpenses
  );
}

/** Attendance rows a preset will produce — the other high-cardinality table. */
export const estimateAttendance = (p: StressPreset): number => p.laborers * p.attendanceDays;

export interface StressProgress {
  step: string;
  done: number;
  total: number;
}

export interface StressReport {
  preset: string;
  ms: number;
  /** Successful repository writes, by kind. */
  written: Record<string, number>;
  /** Writes a guard legitimately rejected (over-cap, insufficient funds, …). */
  skipped: number;
  /** First few rejection reasons — a spike here means the generator is wrong. */
  skipReasons: string[];
}

/* ------------------------------------------------------------------ *
 * Deterministic pseudo-randomness — the same preset always produces the
 * same books, so two benchmark runs are comparable.
 * ------------------------------------------------------------------ */

function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const pick = <T,>(rng: () => number, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
const between = (rng: () => number, lo: number, hi: number): number => lo + rng() * (hi - lo);
/** Round to the nearest 500 rupees — nobody records 17,431. */
const money = (rng: () => number, lo: number, hi: number): number =>
  Math.max(500, Math.round(between(rng, lo, hi) / 500) * 500);

const SOCIETIES = ['Bahria Town', 'DHA', 'Gulberg Greens', 'Park View', 'Lake City', 'Wapda Town', 'Johar Town'];
const BLOCKS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const FIRST = ['Amir', 'Bilal', 'Danish', 'Ehsan', 'Faisal', 'Ghulam', 'Haris', 'Imran', 'Junaid', 'Kashif', 'Liaqat', 'Mudassar', 'Nadeem', 'Owais', 'Qasim', 'Rizwan', 'Saleem', 'Tariq', 'Usman', 'Waqar', 'Yasir', 'Zubair'];
const LAST = ['Khan', 'Ahmed', 'Malik', 'Butt', 'Sheikh', 'Chishti', 'Awan', 'Gujjar', 'Rana', 'Qureshi'];
const SUPPLIER_KIND = ['Traders', 'Builders', 'Steel House', 'Cement Depot', 'Hardware', 'Sanitary Store', 'Tile Centre', 'Timber Mart'];
const PO_ITEMS: { item: string; unit: string; lo: number; hi: number; qtyLo: number; qtyHi: number }[] = [
  { item: 'Cement (Maple Leaf)', unit: 'bori', lo: 1100, hi: 1450, qtyLo: 50, qtyHi: 400 },
  { item: 'Sariya Grade-60', unit: 'kg', lo: 240, hi: 300, qtyLo: 200, qtyHi: 3000 },
  { item: 'Awal bricks', unit: 'adad', lo: 18, hi: 26, qtyLo: 2000, qtyHi: 30000 },
  { item: 'Crush', unit: 'truck', lo: 22000, hi: 34000, qtyLo: 1, qtyHi: 8 },
  { item: 'Ravi sand', unit: 'truck', lo: 14000, hi: 22000, qtyLo: 1, qtyHi: 8 },
  { item: 'Floor tiles', unit: 'adad', lo: 180, hi: 420, qtyLo: 100, qtyHi: 1200 },
];

const person = (rng: () => number): string => `${pick(rng, FIRST)} ${pick(rng, LAST)}`;

/** ISO day `daysAgo` before today. */
function dayISO(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.max(0, Math.floor(daysAgo)));
  return d.toISOString().slice(0, 10);
}

const todayISO = (): string => dayISO(0);

/* ------------------------------------------------------------------ *
 * Seeder
 * ------------------------------------------------------------------ */

export async function seedStressData(
  preset: StressPreset,
  onProgress?: (p: StressProgress) => void
): Promise<StressReport> {
  const startedAt = Date.now();
  const rng = makeRng(20260727);
  const span = preset.years * 365;

  const written: Record<string, number> = {};
  const skipReasons: string[] = [];
  let skipped = 0;
  const bump = (kind: string, n = 1) => {
    written[kind] = (written[kind] ?? 0) + n;
  };

  /**
   * Run one repository write. Guard rejections (over the deal cap, insufficient
   * funds, a once-only milestone already used) are EXPECTED at the edges of
   * randomly generated plans — they're counted, not fatal. Anything else
   * rethrows, because that means the generator is producing data the app would
   * never produce, which is the bug this whole rewrite exists to fix.
   */
  async function attempt<T>(kind: string, fn: () => Promise<T>): Promise<T | null> {
    try {
      const out = await fn();
      bump(kind);
      return out;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const expected = [
        'INSUFFICIENT_FUNDS',
        'LIMIT_EXCEEDED',
        'ONE_TIME_PAYMENT',
        'ATTENDANCE_CONFLICT',
        'PROJECT_CLOSED',
        'WORKER_INACTIVE',
        'WAGE_NOT_SET',
        'PLOT_UNAVAILABLE',
        'DUPLICATE_ACCOUNT',
      ];
      if (!expected.includes(msg)) throw e;
      skipped++;
      if (skipReasons.length < 8) skipReasons.push(`${kind}: ${msg}`);
      return null;
    }
  }

  let stepDone = 0;
  let stepTotal = 1;
  let stepName = 'Starting';
  const step = (name: string, total: number) => {
    stepName = name;
    stepTotal = Math.max(1, total);
    stepDone = 0;
    onProgress?.({ step: stepName, done: 0, total: stepTotal });
  };
  const tick = (n = 1) => {
    stepDone += n;
    // Reporting every row would spend more time in React than in SQLite.
    if (stepDone % 10 === 0 || stepDone >= stepTotal) {
      onProgress?.({ step: stepName, done: stepDone, total: stepTotal });
    }
  };

  /* --- workspace ------------------------------------------------- */
  step('Company + accounts', preset.accounts + 1);
  // Opening balances are deliberately generous. Every OUT is guarded against
  // the live account balance, so an under-funded book would reject most of the
  // spend and produce a thin, unrepresentative dataset.
  const funding = 40_000_000 + preset.projects * 25_000_000;
  const perAccount = Math.round(funding / preset.accounts);

  const existing = await countStressCompanies();
  await createCompany({
    name: `${STRESS_CO_PREFIX} ${existing + 1}`,
    ownerName: person(rng),
    phone: '0300-0000000',
    // Funds the Cash-in-Hand account createCompany seeds for every new company.
    openingCash: perAccount,
  });
  bump('companies');
  tick();

  // Adopt the accounts the new company already has — createCompany seeds a
  // "Cash in Hand", and addAccount rejects a second account with the same name
  // in the same company. Only the banks are ours to create.
  const accounts: string[] = (await listAccounts()).map((a) => a.id);
  const BANKS = ['HBL', 'Meezan', 'UBL', 'Alfalah', 'JS', 'Askari', 'Faysal', 'Soneri'];
  for (let i = accounts.length; i < preset.accounts; i++) {
    const acc = await addAccount({
      // Indexed so two draws of the same bank can't collide on the name.
      name: `${BANKS[i % BANKS.length]} ${i}`,
      type: 'BANK',
      openingBalance: perAccount,
    });
    accounts.push(acc.id);
    bump('accounts');
    tick();
  }
  const anyAccount = () => pick(rng, accounts);

  /* --- reference data -------------------------------------------- */
  const cats = await listCategories();
  const byName = (n: string) => cats.find((c) => c.name_en === n) ?? null;
  const childrenOf = (parentName: string): CategoryRow[] => {
    const parent = byName(parentName);
    return parent ? cats.filter((c) => c.parent_id === parent.id) : [];
  };
  const materialCats = childrenOf('Materials');
  const plotCats = childrenOf('Plot').filter((c) => c.name_en !== 'Plot Payment');
  const homeCats = childrenOf('Home Expense');
  const sellerCats = await listSellerPaymentCategories();
  const buyerCats = await listBuyerPaymentCategories();
  // Token / Advance are once-per-deal; everything else may repeat.
  const onceOnly = (c: CategoryRow) => c.name_en === 'Token' || c.name_en === 'Advance';

  step('Suppliers, investors, workers', preset.suppliers + preset.investors + preset.laborers);
  const suppliers: string[] = [];
  for (let i = 0; i < preset.suppliers; i++) {
    const p = await addParty({
      type: 'SUPPLIER',
      // Indexed: nothing enforces unique names, but two identical suppliers in
      // a picker make manual testing miserable.
      name: `${pick(rng, LAST)} ${pick(rng, SUPPLIER_KIND)} ${i + 1}`,
      phone: `03${Math.floor(between(rng, 10, 99))}-${Math.floor(between(rng, 1000000, 9999999))}`,
    });
    suppliers.push(p.id);
    bump('parties');
    tick();
  }

  const investors: string[] = [];
  for (let i = 0; i < preset.investors; i++) {
    const inv = await addInvestor({
      name: `${person(rng)} ${i + 1}`,
      phone: `0300-${Math.floor(between(rng, 1000000, 9999999))}`,
      cnic: `3520${Math.floor(between(rng, 1000000, 9999999))}${Math.floor(between(rng, 1, 9))}`,
      // Generous pledge: the project-attach path checks each stake against the
      // investor's remaining capacity.
      committedAmount: money(rng, 30_000_000, 120_000_000),
    });
    investors.push(inv.id);
    bump('investors');
    tick();
  }

  const laborers: string[] = [];
  for (let i = 0; i < preset.laborers; i++) {
    const l = await addLaborer({
      name: `Ustad ${person(rng)} ${i + 1}`,
      phone: `0321-${Math.floor(between(rng, 1000000, 9999999))}`,
    });
    laborers.push(l.id);
    bump('laborers');
    tick();
  }

  /* --- standalone plot flips -------------------------------------- */
  // The full flip story: buy → pay the seller in milestones → transfer costs →
  // (sometimes) investor capital → (sometimes) list and receive from a buyer.
  step('Standalone plots', preset.standalonePlots);
  const soloPlots: string[] = [];
  for (let i = 0; i < preset.standalonePlots; i++) {
    const boughtDaysAgo = Math.floor(between(rng, 45, span));
    const deal = money(rng, 3_500_000, 40_000_000);
    const plot = await createPlot({
      name: `${pick(rng, SOCIETIES)} ${pick(rng, BLOCKS)}-${500 + i}`,
      society: pick(rng, SOCIETIES),
      block: pick(rng, BLOCKS),
      plotNo: String(500 + i),
      sizeValue: pick(rng, [3, 5, 7, 10, 20]),
      sizeUnit: 'MARLA',
      dealPrice: deal,
      sellerName: person(rng),
      sellerPhone: `0333-${Math.floor(between(rng, 1000000, 9999999))}`,
      transferDeadline: rng() < 0.4 ? dayISO(boughtDaysAgo - 60) : null,
    });
    soloPlots.push(plot.id);
    bump('plots');

    await paySellerPlan(plot.id, deal, boughtDaysAgo, rng() < 0.75);
    await plotSideExpenses(plot.id, boughtDaysAgo);

    if (rng() < 0.5) {
      await attempt('plotTransfers', () => markPlotTransferred(plot.id, dayISO(boughtDaysAgo - 30)));
    }

    // A slice of flips are investor-funded (the v34 "venture" path).
    if (rng() < 0.3) {
      const backers = investors.slice(0, 1 + Math.floor(rng() * 3));
      for (const investorId of backers) {
        await attempt('investments', () =>
          addInvestment({
            investorId,
            plotId: plot.id,
            amount: money(rng, 500_000, 6_000_000),
            date: dayISO(boughtDaysAgo - Math.floor(rng() * 20)),
            accountId: anyAccount(),
          })
        );
      }
    }

    // Listed for sale → buyer instalments. Only for plots still open.
    if (rng() < 0.45) {
      const salePrice = Math.round(deal * between(rng, 1.08, 1.55));
      const ok = await attempt('plotSales', () =>
        setPlotSale({ plotId: plot.id, salePrice, buyerName: person(rng) })
      );
      if (ok !== null) await receiveBuyerPlan(plot.id, boughtDaysAgo);
    }
    tick();
  }

  /* --- projects ---------------------------------------------------- */
  // Each project: its own plot (bought + paid), investor stakes and real
  // capital, construction spend, purchase orders with deliveries + supplier
  // payments, a crew with attendance and wage payouts, then a sale.
  step('Projects', preset.projects);
  const projects: string[] = [];
  const projectStart: Record<string, number> = {};
  for (let i = 0; i < preset.projects; i++) {
    const startedDaysAgo = Math.floor(between(rng, 60, span));
    const deal = money(rng, 5_000_000, 45_000_000);
    const plot = await createPlot({
      name: `${pick(rng, SOCIETIES)} ${pick(rng, BLOCKS)}-${100 + i}`,
      society: pick(rng, SOCIETIES),
      block: pick(rng, BLOCKS),
      plotNo: String(100 + i),
      sizeValue: pick(rng, [5, 7, 10, 20]),
      sizeUnit: 'MARLA',
      dealPrice: deal,
      sellerName: person(rng),
      sellerPhone: `0333-${Math.floor(between(rng, 1000000, 9999999))}`,
    });
    bump('plots');

    // Seller is paid BEFORE the plot joins the project, exactly like the real
    // flow (buy the land, then start the build on it).
    await paySellerPlan(plot.id, deal, startedDaysAgo, true);
    await plotSideExpenses(plot.id, startedDaysAgo);
    await attempt('plotTransfers', () => markPlotTransferred(plot.id, dayISO(startedDaysAgo - 20)));

    const project = await createProject({
      name: `${pick(rng, SOCIETIES)} ${pick(rng, BLOCKS)}-${100 + i} House`,
      plotId: plot.id,
      startDate: dayISO(startedDaysAgo),
    });
    projects.push(project.id);
    projectStart[project.id] = startedDaysAgo;
    bump('projects');

    // Investor participation, then their real money arriving.
    const backers: string[] = [];
    const backerCount = 1 + Math.floor(rng() * 4);
    for (let k = 0; k < backerCount; k++) {
      const investorId = investors[(i * 3 + k) % investors.length];
      if (backers.includes(investorId)) continue;
      backers.push(investorId);
      await attempt('participations', () =>
        addProjectInvestor({
          projectId: project.id,
          investorId,
          committedAmount: money(rng, 2_000_000, 12_000_000),
          profitPct: Math.round(between(rng, 5, 30)),
        })
      );
    }
    for (const investorId of backers) {
      const tranches = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < tranches; k++) {
        await attempt('investments', () =>
          addInvestment({
            investorId,
            projectId: project.id,
            amount: money(rng, 800_000, 6_000_000),
            date: dayISO(Math.max(1, startedDaysAgo - k * 30)),
            accountId: anyAccount(),
          })
        );
      }
    }

    tick();
  }

  /* --- construction spend ------------------------------------------ */
  step('Construction expenses', preset.projects * preset.expensesPerProject);
  for (const projectId of projects) {
    const from = projectStart[projectId];
    for (let k = 0; k < preset.expensesPerProject; k++) {
      const cat = pick(rng, materialCats.length ? materialCats : cats);
      await attempt('expenses', () =>
        addTransaction({
          direction: 'OUT',
          amount: money(rng, 4_000, 350_000),
          date: dayISO(Math.floor(between(rng, 1, Math.max(2, from)))),
          accountId: anyAccount(),
          projectId,
          phase: 'CONSTRUCTION',
          categoryId: cat.id,
          partyId: pick(rng, suppliers),
          description: `${cat.name_en} — site`,
          qty: cat.default_unit ? Math.round(between(rng, 1, 400)) : null,
        })
      );
      tick();
    }
  }

  /* --- purchase orders --------------------------------------------- */
  // Deliveries and payments are dated TODAY: the repository rejects any PO
  // movement dated before the booking was created, and bookings are created now.
  step('Purchase orders', preset.projects * preset.posPerProject);
  const today = todayISO();
  for (const projectId of projects) {
    for (let k = 0; k < preset.posPerProject; k++) {
      const supplierId = pick(rng, suppliers);
      const lineCount = 1 + Math.floor(rng() * 3);
      const items = Array.from({ length: lineCount }, () => {
        const spec = pick(rng, PO_ITEMS);
        return {
          itemName: spec.item,
          unit: spec.unit,
          qty: Math.round(between(rng, spec.qtyLo, spec.qtyHi)),
          rate: Math.round(between(rng, spec.lo, spec.hi)),
        };
      });
      const poId = await attempt('purchaseOrders', () =>
        createPurchaseOrder({ projectId, partyId: supplierId, supplierName: null, items })
      );
      if (!poId) {
        tick();
        continue;
      }
      bump('poItems', items.length);

      // Three lifecycles, like real orders: fully received + paid, partly
      // received, or booked and still untouched.
      const roll = rng();
      // getPurchaseOrder(poId), NOT listPurchaseOrders().find(...) — the list
      // summarises every PO in the company, which inside this loop is O(n²).
      const po = await getPurchaseOrder(poId);
      if (!po) {
        tick();
        continue;
      }
      for (const item of po.items) {
        const booked = item.booking.qty;
        if (roll < 0.5) {
          await attempt('deliveries', () =>
            receiveAndPay({
              bookingId: item.booking.id,
              qty: booked,
              date: today,
              payAmount: item.booking.total,
              accountId: anyAccount(),
            })
          );
        } else if (roll < 0.8) {
          const part = Math.max(1, Math.round(booked * between(rng, 0.3, 0.7)));
          await attempt('deliveries', () =>
            addDelivery({ bookingId: item.booking.id, qty: part, date: today })
          );
          const s = await getBookingSummary(item.booking.id);
          if (s.payRemaining > 0) {
            await attempt('poPayments', () =>
              payBooking({
                bookingId: item.booking.id,
                amount: Math.round(s.payRemaining * between(rng, 0.3, 0.9)),
                date: today,
                accountId: anyAccount(),
              })
            );
          }
        }
      }
      tick();
    }
  }

  /* --- labour: crew, attendance, wage payouts ----------------------- */
  // Each worker belongs to exactly ONE project. The app blocks a worker earning
  // on two projects the same day, so sharing them would make most attendance
  // writes bounce and leave the labour totals meaningless.
  step('Labour attendance', preset.laborers * preset.attendanceDays);
  const crew: { plId: string; projectId: string }[] = [];
  for (let i = 0; i < laborers.length && projects.length > 0; i++) {
    const projectId = projects[i % projects.length];
    const pl = await attempt('crew', () =>
      attachLaborerToProject({
        projectId,
        laborerId: laborers[i],
        dailyWage: money(rng, 1000, 3500),
      })
    );
    if (pl) crew.push({ plId: pl.id, projectId });
  }

  for (const member of crew) {
    const from = projectStart[member.projectId] ?? span;
    const days = Math.min(preset.attendanceDays, Math.max(1, from - 1));
    for (let d = 1; d <= days; d++) {
      const roll = rng();
      const status = roll < 0.78 ? 'FULL' : roll < 0.9 ? 'HALF' : 'ABSENT';
      await attempt('attendance', () =>
        markAttendance({ projectLaborerId: member.plId, date: dayISO(d), status })
      );
      tick();
    }
    // Pay out most of what accrued — the rest stays as an open balance, which
    // is what the Labour khata screen is actually for.
    const { balance } = await getLaborBalance(member.plId);
    if (balance > 0) {
      const payments = 1 + Math.floor(rng() * 3);
      let left = Math.round(balance * between(rng, 0.5, 0.95));
      for (let k = 0; k < payments && left > 0; k++) {
        const amount = k === payments - 1 ? left : Math.round(left / (payments - k));
        left -= amount;
        if (amount <= 0) continue;
        await attempt('laborPayments', () =>
          payLaborer({
            projectLaborerId: member.plId,
            amount,
            date: dayISO(Math.floor(between(rng, 1, 30))),
            accountId: anyAccount(),
          })
        );
      }
    }
  }

  /* --- project sales ------------------------------------------------ */
  step('Sales', projects.length);
  for (const projectId of projects) {
    tick();
    if (rng() > 0.65) continue;
    const from = projectStart[projectId] ?? span;
    const agreed = money(rng, 18_000_000, 95_000_000);
    const sale = await attempt('sales', () =>
      upsertSale(projectId, { agreedPrice: agreed, buyerName: person(rng) })
    );
    if (!sale) continue;

    // Sale-side costs (commission, stamp paper) — a real sale has them.
    await attempt('saleCosts', () =>
      addSaleCost({
        projectId,
        name: pick(rng, ['Commission', 'Stamp paper', 'Registry fee']),
        amount: money(rng, 50_000, 700_000),
        date: dayISO(Math.floor(between(rng, 1, Math.max(2, from / 2)))),
        accountId: anyAccount(),
      })
    );

    // Token → bayana → instalments, each capped at what's still outstanding.
    let received = 0;
    const plan: { payType: 'TOKEN' | 'BAYANA' | 'INSTALLMENT' | 'FINAL'; frac: number }[] = [
      { payType: 'TOKEN', frac: 0.05 },
      { payType: 'BAYANA', frac: 0.2 },
      { payType: 'INSTALLMENT', frac: 0.25 },
      { payType: 'INSTALLMENT', frac: 0.25 },
      { payType: 'FINAL', frac: 0.25 },
    ];
    const stop = 1 + Math.floor(rng() * plan.length);
    for (let k = 0; k < stop; k++) {
      const amount = Math.min(Math.round(agreed * plan[k].frac), agreed - received);
      if (amount <= 0) break;
      const ok = await attempt('saleReceipts', () =>
        addSaleReceipt({
          saleId: sale.id,
          amount,
          date: dayISO(Math.max(1, Math.floor(from / 2) - k * 25)),
          accountId: anyAccount(),
          payType: plan[k].payType,
        })
      );
      if (ok) received += amount;
    }
  }

  /* --- udhaar -------------------------------------------------------- */
  step('Udhaar', preset.udhaar);
  for (let i = 0; i < preset.udhaar; i++) {
    const direction = rng() < 0.6 ? 'GIVEN' : 'TAKEN';
    const u = await attempt('udhaar', () =>
      createUdhaar({
        personName: `${person(rng)} (${direction === 'GIVEN' ? 'neighbour' : 'lender'})`,
        direction,
        note: direction === 'GIVEN' ? 'Zaroorat par diya' : 'Kaam ke liye liya',
      })
    );
    if (!u) {
      tick();
      continue;
    }
    const amount = money(rng, 50_000, 1_500_000);
    const given = await attempt('udhaarMoves', () =>
      giveUdhaar({ udhaarId: u.id, amount, date: dayISO(Math.floor(between(rng, 30, span))), accountId: anyAccount() })
    );
    // Most get partly repaid; some clear completely (flipping to CLEARED).
    if (given !== null && rng() < 0.7) {
      const back = rng() < 0.35 ? amount : Math.round(amount * between(rng, 0.2, 0.8));
      await attempt('udhaarMoves', () =>
        returnUdhaar({ udhaarId: u.id, amount: back, date: dayISO(Math.floor(between(rng, 1, 29))), accountId: anyAccount() })
      );
    }
    tick();
  }

  /* --- household expenses + transfers -------------------------------- */
  step('Household + transfers', preset.homeExpenses + Math.floor(preset.homeExpenses / 20));
  for (let i = 0; i < preset.homeExpenses; i++) {
    const cat = homeCats.length ? pick(rng, homeCats) : null;
    await attempt('homeExpenses', () =>
      addTransaction({
        direction: 'OUT',
        amount: money(rng, 1_500, 90_000),
        date: dayISO(Math.floor(between(rng, 1, span))),
        accountId: anyAccount(),
        phase: 'GENERAL',
        categoryId: cat?.id ?? null,
        description: cat?.name_en ?? 'Ghar ka kharcha',
      })
    );
    tick();
  }

  if (accounts.length > 1) {
    const transfers = Math.floor(preset.homeExpenses / 20);
    for (let i = 0; i < transfers; i++) {
      const from = anyAccount();
      const to = accounts.find((a) => a !== from)!;
      await attempt('transfers', () =>
        transferBetween({
          fromAccountId: from,
          toAccountId: to,
          amount: money(rng, 100_000, 3_000_000),
          date: dayISO(Math.floor(between(rng, 1, span))),
          note: 'Cash shift',
        })
      );
      tick();
    }
  }

  /* --- photos -------------------------------------------------------- */
  step('Photos', preset.photos);
  await seedPhotos(preset.photos, projects, soloPlots, rng, bump, tick);

  /* --- corrections: a realistic sprinkle of voided entries ------------ */
  // Real books contain mistakes that were reversed. Voided rows exercise every
  // `is_void = 0` filter and the reversal-row rendering.
  // Ids only, bounded — pulling every transaction into JS just to pick a few to
  // reverse would be the exact memory spike this tool exists to measure.
  const db = await getDatabase();
  const voidCount = Math.max(3, Math.round(preset.homeExpenses * 0.05));
  const voidable = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM transactions
     WHERE company_id = ? AND is_void = 0 AND void_of_id IS NULL
       AND transfer_id IS NULL AND udhaar_id IS NULL AND labor_id IS NULL
       AND booking_id IS NULL AND investor_id IS NULL
     ORDER BY date DESC LIMIT ?`,
    getActiveCompanyId()!,
    voidCount
  );
  step('Voided corrections', voidable.length);
  for (const row of voidable) {
    await attempt('voids', () => voidTransaction(row.id));
    tick();
  }

  /* --- close out some projects ---------------------------------------- */
  // Done LAST: a COMPLETED project is read-only, so closing earlier would make
  // every later write on it bounce.
  step('Closing projects', projects.length);
  for (const projectId of projects) {
    if (rng() < 0.3) await attempt('completedProjects', () => setProjectStatus(projectId, 'COMPLETED'));
    tick();
  }

  return {
    preset: preset.key,
    ms: Date.now() - startedAt,
    written,
    skipped,
    skipReasons,
  };

  /* ---------------- helpers that close over the generator ------------- */

  /**
   * Pay the seller as a real deal runs: Token, then Advance, then instalments —
   * each a "Seller Payment" child category, the whole plan capped at the deal
   * price (the repository rejects anything above what's still owed).
   */
  async function paySellerPlan(plotId: string, deal: number, boughtDaysAgo: number, payFully: boolean): Promise<void> {
    if (sellerCats.length === 0) return;
    const target = payFully ? deal : Math.round(deal * between(rng, 0.25, 0.8));
    const token = sellerCats.find((c) => c.name_en === 'Token');
    const advance = sellerCats.find((c) => c.name_en === 'Advance');
    const instalment = sellerCats.find((c) => c.name_en === 'Installment') ?? sellerCats.find((c) => !onceOnly(c));

    let paid = 0;
    let day = boughtDaysAgo;
    const post = async (cat: CategoryRow | undefined, amount: number) => {
      if (!cat || amount <= 0 || paid + amount > deal) return;
      const ok = await attempt('sellerPayments', () =>
        addPlotPayment({
          plotId,
          categoryId: cat.id,
          amount,
          date: dayISO(Math.max(1, day)),
          accountId: anyAccount(),
          note: cat.name_en,
        })
      );
      if (ok !== null) paid += amount;
      day = Math.max(1, day - Math.floor(between(rng, 10, 60)));
    };

    await post(token, Math.round(target * 0.05));
    await post(advance, Math.round(target * 0.2));
    const rounds = 1 + Math.floor(rng() * 4);
    for (let k = 0; k < rounds && paid < target; k++) {
      await post(instalment, Math.min(Math.round(target * 0.25), target - paid));
    }
  }

  /** Tax / transfer fee / naqsha — the costs that sit ON TOP of the deal. */
  async function plotSideExpenses(plotId: string, boughtDaysAgo: number): Promise<void> {
    const rounds = 1 + Math.floor(rng() * 3);
    for (let k = 0; k < rounds; k++) {
      const cat = plotCats.length ? pick(rng, plotCats) : null;
      if (!cat) return;
      await attempt('plotExpenses', () =>
        addPlotExpense({
          plotId,
          categoryId: cat.id,
          amount: money(rng, 25_000, 600_000),
          date: dayISO(Math.max(1, boughtDaysAgo - k * 15)),
          accountId: anyAccount(),
          note: cat.name_en,
        })
      );
    }
  }

  /** Buyer instalments on a standalone flip, capped at what's outstanding. */
  async function receiveBuyerPlan(plotId: string, boughtDaysAgo: number): Promise<void> {
    if (buyerCats.length === 0) return;
    const token = buyerCats.find((c) => c.name_en === 'Token');
    const advance = buyerCats.find((c) => c.name_en === 'Advance');
    const instalment = buyerCats.find((c) => c.name_en === 'Installment') ?? buyerCats.find((c) => !onceOnly(c));

    const summary = await getPlotSummary(plotId);
    const price = summary.salePrice;
    if (price <= 0) return;
    // Some flips complete (plot flips to SOLD), most are mid-payment.
    const target = rng() < 0.4 ? price : Math.round(price * between(rng, 0.15, 0.8));

    let got = 0;
    let day = Math.max(1, Math.floor(boughtDaysAgo / 2));
    const post = async (cat: CategoryRow | undefined, amount: number) => {
      if (!cat || amount <= 0 || got + amount > price) return;
      const ok = await attempt('buyerReceipts', () =>
        addPlotSaleReceipt({
          plotId,
          categoryId: cat.id,
          amount,
          date: dayISO(day),
          accountId: anyAccount(),
        })
      );
      if (ok !== null) got += amount;
      day = Math.max(1, day - Math.floor(between(rng, 10, 45)));
    };

    await post(token, Math.round(target * 0.05));
    await post(advance, Math.round(target * 0.25));
    while (got < target - 1) {
      const next = Math.min(Math.round(target * 0.35), target - got);
      if (next <= 0) break;
      const before = got;
      await post(instalment, next);
      if (got === before) break; // guard rejected it — stop rather than spin
    }
  }
}

async function countStressCompanies(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) AS c FROM companies WHERE name LIKE ?",
    `${STRESS_CO_PREFIX}%`
  );
  return row?.c ?? 0;
}

/**
 * Write real JPEGs (one master, compressed exactly like `utils/photo.ts`, then
 * copied) and register each through `addDocument`, so the photo diary and the
 * plot document chips have genuine files to load.
 */
async function seedPhotos(
  count: number,
  projectIds: string[],
  plotIds: string[],
  rng: () => number,
  bump: (kind: string, n?: number) => void,
  tick: (n?: number) => void
): Promise<void> {
  // `documents.entity_id` is NOT NULL — with nothing to attach to, skip.
  if (count === 0 || (projectIds.length === 0 && plotIds.length === 0)) return;
  await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });

  const asset = Asset.fromModule(require('../../assets/icon.png'));
  await asset.downloadAsync();
  if (!asset.localUri) return;
  const master = await ImageManipulator.manipulateAsync(
    asset.localUri,
    [{ resize: { width: 1080 } }],
    { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
  );

  for (let i = 0; i < count; i++) {
    const to = `${PHOTO_DIR}stress-photo-${Date.now()}-${i}.jpg`;
    await FileSystem.copyAsync({ from: master.uri, to });
    const onProject = plotIds.length === 0 || (rng() < 0.6 && projectIds.length > 0);
    await addDocument({
      entityType: onProject ? 'site_photo' : 'plot',
      entityId: onProject
        ? projectIds[Math.floor(rng() * projectIds.length)]
        : plotIds[Math.floor(rng() * plotIds.length)],
      label: onProject ? 'Site photo' : 'Fard',
      fileUri: to,
      mime: 'image/jpeg',
    });
    bump('documents');
    tick();
  }
}

/* ------------------------------------------------------------------ *
 * Cleanup
 * ------------------------------------------------------------------ */

/**
 * Delete every generated workspace and its entire object graph, then switch
 * back to whatever real company remains. Scoped by company, not by id pattern,
 * because the repositories mint their own uuids — which is exactly why the data
 * they produce is indistinguishable from real entry.
 */
export async function clearStressData(): Promise<void> {
  const db = await getDatabase();
  const stressCos = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM companies WHERE name LIKE ?',
    `${STRESS_CO_PREFIX}%`
  );
  if (stressCos.length === 0) return;
  const ids = stressCos.map((c) => c.id);
  const inList = ids.map(() => '?').join(',');

  await db.execAsync('PRAGMA foreign_keys = OFF');
  try {
    const P = `SELECT id FROM projects WHERE company_id IN (${inList})`;
    const L = `SELECT id FROM plots WHERE company_id IN (${inList})`;
    const run = (sql: string, params: string[]) => db.runAsync(sql, ...params);

    // Deepest children first, so nothing is orphaned even with FKs off.
    await run(
      `DELETE FROM labor_attendance WHERE project_laborer_id IN
         (SELECT id FROM project_laborers WHERE project_id IN (${P}))`,
      ids
    );
    await run(
      `DELETE FROM capital_ledger WHERE project_investor_id IN
         (SELECT id FROM project_investors WHERE project_id IN (${P}) OR plot_id IN (${L}))`,
      [...ids, ...ids]
    );
    await run(
      `DELETE FROM sale_receipts WHERE sale_id IN (SELECT id FROM sales WHERE project_id IN (${P}))`,
      ids
    );
    await run(
      `DELETE FROM material_deliveries WHERE booking_id IN
         (SELECT id FROM material_bookings WHERE company_id IN (${inList}))`,
      ids
    );
    // `documents` carries no company_id — reach it through its owning entity.
    await run(
      `DELETE FROM documents WHERE entity_id IN (${P}) OR entity_id IN (${L})
         OR entity_id IN (SELECT id FROM transactions WHERE company_id IN (${inList}))`,
      [...ids, ...ids, ...ids]
    );
    await run(`DELETE FROM project_laborers WHERE project_id IN (${P})`, ids);
    await run(`DELETE FROM project_investors WHERE project_id IN (${P}) OR plot_id IN (${L})`, [...ids, ...ids]);
    await run(`DELETE FROM sales WHERE project_id IN (${P})`, ids);
    await run(`DELETE FROM material_bookings WHERE company_id IN (${inList})`, ids);
    await run(`DELETE FROM transactions WHERE company_id IN (${inList})`, ids);
    // Break the projects ↔ plots cycle before dropping either side.
    await run(`UPDATE projects SET plot_id = NULL WHERE company_id IN (${inList})`, ids);
    await run(`DELETE FROM plots WHERE company_id IN (${inList})`, ids);
    await run(`DELETE FROM projects WHERE company_id IN (${inList})`, ids);
    for (const table of ['investors', 'laborers', 'udhaar', 'parties', 'accounts']) {
      await run(`DELETE FROM ${table} WHERE company_id IN (${inList})`, ids);
    }
    await run(`DELETE FROM companies WHERE id IN (${inList})`, ids);
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON');
  }

  // Reclaim the pages — without this the file stays at its stressed size.
  await db.execAsync('VACUUM');
  await FileSystem.deleteAsync(PHOTO_DIR, { idempotent: true });
  await hydrateActiveCompany();
}

/* ------------------------------------------------------------------ *
 * Storage + performance measurement
 * ------------------------------------------------------------------ */

export interface StorageReport {
  dbBytes: number;
  freeBytes: number;
  walBytes: number;
  documentsBytes: number;
  cacheBytes: number;
  photoCount: number;
  photoBytes: number;
  /** `documents` rows whose file no longer exists on disk. */
  missingPhotos: number;
  dbPath: string;
}

async function dirBytes(uri: string | null, depth = 0): Promise<number> {
  if (!uri || depth > 3) return 0;
  try {
    const names = await FileSystem.readDirectoryAsync(uri);
    let total = 0;
    for (const n of names) {
      const child = `${uri}${uri.endsWith('/') ? '' : '/'}${n}`;
      const info = await FileSystem.getInfoAsync(child);
      if (!info.exists) continue;
      total += info.isDirectory ? await dirBytes(`${child}/`, depth + 1) : info.size;
    }
    return total;
  } catch {
    return 0;
  }
}

export async function measureStorage(): Promise<StorageReport> {
  const db = await getDatabase();
  const pageCount = (await db.getFirstAsync<{ page_count: number }>('PRAGMA page_count'))?.page_count ?? 0;
  const pageSize = (await db.getFirstAsync<{ page_size: number }>('PRAGMA page_size'))?.page_size ?? 0;
  const freeList = (await db.getFirstAsync<{ freelist_count: number }>('PRAGMA freelist_count'))?.freelist_count ?? 0;

  const dbDir = `${FileSystem.documentDirectory}SQLite/`;
  const walInfo = await FileSystem.getInfoAsync(`${dbDir}tameerbook.db-wal`);

  const docs = await db.getAllAsync<{ file_uri: string }>('SELECT file_uri FROM documents');
  let photoBytes = 0;
  let missing = 0;
  for (const d of docs) {
    const info = await FileSystem.getInfoAsync(d.file_uri);
    if (info.exists && !info.isDirectory) photoBytes += info.size;
    else missing++;
  }

  return {
    dbBytes: pageCount * pageSize,
    freeBytes: freeList * pageSize,
    walBytes: walInfo.exists && !walInfo.isDirectory ? walInfo.size : 0,
    documentsBytes: await dirBytes(FileSystem.documentDirectory),
    cacheBytes: await dirBytes(FileSystem.cacheDirectory),
    photoCount: docs.length,
    photoBytes,
    missingPhotos: missing,
    dbPath: `${dbDir}tameerbook.db`,
  };
}

/* ------------------------------------------------------------------ *
 * Data audit — "is the data actually there, and does it add up?"
 * ------------------------------------------------------------------ */

export interface AuditRow {
  /** The module / screen this check speaks for. */
  label: string;
  ok: boolean;
  detail: string;
}

/**
 * Cross-check the ACTIVE company's data the way each screen reads it: does the
 * module have rows at all, and do its derived numbers reconcile? Run it right
 * after seeding — a generator that writes rows the screens can't interpret
 * (wrong category, missing phase tag, broken link) shows up here as a failing
 * line instead of as an empty screen you have to go hunting through.
 */
export async function runDataAudit(): Promise<AuditRow[]> {
  const db = await getDatabase();
  const companyId = getActiveCompanyId();
  if (!companyId) return [{ label: 'Company', ok: false, detail: 'No active company' }];

  const out: AuditRow[] = [];
  const check = (label: string, ok: boolean, detail: string) => out.push({ label, ok, detail });

  /* Transactions page — the specific complaint: does every module's money
     actually reach the global ledger, tagged so the page can render it? */
  const mix = await db.getFirstAsync<{
    total: number; plot: number; project: number; investor: number;
    labor: number; booking: number; udhaar: number; transfer: number; voided: number;
  }>(
    `SELECT COUNT(*) AS total,
       SUM(plot_id IS NOT NULL)     AS plot,
       SUM(project_id IS NOT NULL)  AS project,
       SUM(investor_id IS NOT NULL) AS investor,
       SUM(labor_id IS NOT NULL)    AS labor,
       SUM(booking_id IS NOT NULL)  AS booking,
       SUM(udhaar_id IS NOT NULL)   AS udhaar,
       SUM(transfer_id IS NOT NULL) AS transfer,
       SUM(is_void = 1)             AS voided
     FROM transactions WHERE company_id = ?`,
    companyId
  );
  check('Transactions — total', (mix?.total ?? 0) > 0, `${(mix?.total ?? 0).toLocaleString()} rows`);
  check(
    'Transactions — every module represented',
    !!mix && mix.plot > 0 && mix.project > 0 && mix.investor > 0 && mix.labor > 0 && mix.booking > 0 && mix.udhaar > 0 && mix.transfer > 0,
    `plot ${mix?.plot ?? 0} · project ${mix?.project ?? 0} · investor ${mix?.investor ?? 0} · labour ${mix?.labor ?? 0} · material ${mix?.booking ?? 0} · udhaar ${mix?.udhaar ?? 0} · transfer ${mix?.transfer ?? 0}`
  );
  check('Transactions — voided corrections', (mix?.voided ?? 0) > 0, `${mix?.voided ?? 0} reversed`);

  const uncategorised = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM transactions WHERE company_id = ? AND category_id IS NULL AND transfer_id IS NULL AND udhaar_id IS NULL',
    companyId
  );
  check(
    'Transactions — categorised',
    (uncategorised?.c ?? 0) === 0,
    `${uncategorised?.c ?? 0} rows with no category (transfers/udhaar excluded)`
  );

  /* Plots — the deal maths the plot card shows. */
  const plots = await listPlotSummaries();
  const overpaid = plots.filter((p) => p.paidToSeller > p.dealPrice + 0.5);
  check('Plots — list', plots.length > 0, `${plots.length} plots`);
  check(
    'Plots — seller never overpaid',
    overpaid.length === 0,
    overpaid.length ? `${overpaid.length} plots paid past the deal price` : 'every plot within its deal'
  );
  check(
    'Plots — costs computed',
    plots.some((p) => p.paidToSeller > 0) && plots.some((p) => p.expenses > 0),
    `${plots.filter((p) => p.paidToSeller > 0).length} with seller payments · ${plots.filter((p) => p.expenses > 0).length} with expenses`
  );
  const sold = plots.filter((p) => p.saleReceived > 0);
  check('Plots — buyer money counted', sold.length > 0, `${sold.length} plots with buyer receipts`);

  /* Projects — cost breakdown + progress. */
  const projects = await listProjectSummaries();
  check('Projects — list', projects.length > 0, `${projects.length} projects`);
  check(
    'Projects — cost breakdown',
    projects.some((p) => p.cost.plotCost > 0) && projects.some((p) => p.cost.constructionCost > 0),
    `${projects.filter((p) => p.cost.plotCost > 0).length} with plot cost · ${projects.filter((p) => p.cost.constructionCost > 0).length} with construction cost`
  );
  check(
    'Projects — sales recorded',
    projects.some((p) => p.saleReceived > 0),
    `${projects.filter((p) => p.saleDeal > 0).length} listed · ${projects.filter((p) => p.saleReceived > 0).length} receiving`
  );

  /* Investors, labour, materials, udhaar. */
  const investors = await listInvestorsWithCapital();
  check(
    'Investors — capital received',
    investors.length > 0 && investors.some((i) => i.received > 0),
    `${investors.length} investors · ${investors.filter((i) => i.received > 0).length} with money in`
  );

  const workers = await listLaborersWithTotals();
  check(
    'Labour — accrued and paid',
    workers.some((w) => w.earned > 0) && workers.some((w) => w.taken > 0),
    `${workers.length} workers · ${workers.filter((w) => w.earned > 0).length} earning · ${workers.filter((w) => w.balance > 0).length} still owed`
  );

  const pos = await listPurchaseOrders();
  check(
    'Materials — purchase orders',
    pos.length > 0 && pos.some((p) => p.paid > 0),
    `${pos.length} POs · ${pos.filter((p) => p.paid > 0).length} part-paid · ${pos.filter((p) => p.fullyReceived).length} fully received`
  );

  const udhaar = await listUdhaar();
  check(
    'Udhaar — open and cleared',
    udhaar.some((u) => u.balance > 0) && udhaar.some((u) => u.status === 'CLEARED'),
    `${udhaar.length} records · ${udhaar.filter((u) => u.balance > 0).length} open · ${udhaar.filter((u) => u.status === 'CLEARED').length} cleared`
  );

  /* Accounts — no account may hold negative money; the guard should have
     made that impossible, so a failure here means a write bypassed it. */
  const balances = await listAccountsWithBalance();
  const negative = balances.filter((a) => a.balance < -0.5);
  check(
    'Accounts — no negative balance',
    negative.length === 0,
    negative.length ? negative.map((a) => `${a.name} ${Math.round(a.balance)}`).join(', ') : `${balances.length} accounts positive`
  );

  /* Reports tab reads its own aggregates — confirm they're non-empty. */
  const pnl = await getPnl();
  check(
    'Reports — P&L populated',
    pnl.some((r) => r.expenses > 0),
    `${pnl.length} project rows · ${pnl.filter((r) => r.revenue > 0).length} with revenue`
  );

  return out;
}

export interface BenchRow {
  label: string;
  ms: number;
  rows: number;
  note?: string;
}

async function time<T>(label: string, fn: () => Promise<T>, size: (r: T) => number): Promise<BenchRow> {
  const t0 = Date.now();
  const out = await fn();
  return { label, ms: Date.now() - t0, rows: size(out) };
}

/**
 * Time each screen's real focus-load path against whatever is in the DB.
 * Everything here is exactly what the screen calls, so the numbers are the
 * numbers the user feels.
 */
export async function runStressBenchmark(): Promise<BenchRow[]> {
  const out: BenchRow[] = [];

  out.push(
    await time(
      'Home (focus load)',
      () =>
        Promise.all([
          getTotalBalance(),
          listAccountsWithBalance(),
          getUdhaarTotals(),
          listRecentTransactions(8),
          listCategories(),
          getCompanyAssets(),
          listPlots(),
          listLaborersWithTotals(),
        ]),
      () => 0
    )
  );

  out.push(await time('Projects list', () => listProjectSummaries(), (r) => r.length));
  out.push(await time('Plots list', () => listPlotSummaries(), (r) => r.length));
  out.push(await time('Investors list', async () => listInvestorsWithCapital(), (r) => r.length));
  out.push(await time('Labour list', () => listLaborersWithTotals(), (r) => r.length));
  out.push(await time('Purchase orders list', () => listPurchaseOrders(), (r) => r.length));
  out.push(await time('Udhaar list', async () => listUdhaar(), (r) => r.length));
  out.push(await time('Transactions — SQL only', () => listAllCompanyTransactions(), (r) => r.length));

  // The screen then resolves a module target PER ROW. Sampled: running it over
  // every row is the very thing being flagged, and would hang the profiler.
  const all = await listAllCompanyTransactions();
  const SAMPLE = Math.min(500, all.length);
  if (SAMPLE > 0) {
    const t0 = Date.now();
    await Promise.all(all.slice(0, SAMPLE).map((x) => resolveTxnModuleTarget(x)));
    const sampleMs = Date.now() - t0;
    out.push({
      label: 'Transactions — per-row target resolve',
      ms: Math.round((sampleMs / SAMPLE) * all.length),
      rows: all.length,
      note: `extrapolated from ${SAMPLE} rows (${sampleMs}ms)`,
    });
  }

  out.push(
    await time(
      'Reports tab',
      () => Promise.all([getPnl(), getCashFlow(), getExpenseByCategory(), getRoiReport(), getAccountFlowReport()]),
      () => 0
    )
  );

  return out;
}
