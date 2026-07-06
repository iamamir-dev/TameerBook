import { create } from 'zustand';

import type { EntryRecord, InvestorRecord, ProjectRecord } from '@/db/schema';
import { todayISO } from '@/utils/date';

/**
 * In-memory ledger store seeded with demo data so the Home screen can prove
 * the design system without a database round-trip. The shape mirrors the
 * SQLite schema, so swapping the seed for real queries later is mechanical.
 */

const TODAY = todayISO();

const demoProjects: ProjectRecord[] = [
  {
    id: 'p1',
    name: 'Bahria Town Villa',
    location: 'Rawalpindi',
    stageKey: 'stageGreyStructure',
    createdAt: TODAY,
  },
  {
    id: 'p2',
    name: 'DHA Phase 6 Plot',
    location: 'Lahore',
    stageKey: 'stageFoundation',
    createdAt: TODAY,
  },
  {
    id: 'p3',
    name: 'Gulberg Shop',
    location: 'Lahore',
    stageKey: 'stageFinishing',
    createdAt: TODAY,
  },
];

const demoEntries: EntryRecord[] = [
  {
    id: 'e1',
    projectId: 'p1',
    type: 'aamdani',
    amount: 500000,
    note: 'Sharik ki investment',
    receiptUri: null,
    date: TODAY,
    createdAt: `${TODAY}T09:15:00`,
  },
  {
    id: 'e2',
    projectId: 'p1',
    type: 'material',
    amount: 185000,
    note: 'Cement 100 bori',
    receiptUri: 'https://picsum.photos/seed/cement/80',
    date: TODAY,
    createdAt: `${TODAY}T11:40:00`,
  },
  {
    id: 'e3',
    projectId: 'p2',
    type: 'dehari',
    amount: 24000,
    note: '8 mazdoor',
    receiptUri: null,
    date: TODAY,
    createdAt: `${TODAY}T15:05:00`,
  },
  {
    id: 'e4',
    projectId: 'p3',
    type: 'kharcha',
    amount: 42000,
    note: 'Tiles transport',
    receiptUri: null,
    date: TODAY,
    createdAt: `${TODAY}T17:20:00`,
  },
];

const demoInvestors: InvestorRecord[] = [
  { id: 'i1', name: 'Haji Saleem', phone: '0300-1234567', committed: 5000000 },
  { id: 'i2', name: 'Tariq Sb', phone: '0321-7654321', committed: 2500000 },
];

/** Entry types that represent money coming IN. Everything else is money OUT. */
const MONEY_IN_TYPES = new Set<EntryRecord['type']>(['aamdani', 'investor']);

export const isMoneyIn = (type: EntryRecord['type']): boolean => MONEY_IN_TYPES.has(type);

interface LedgerState {
  projects: ProjectRecord[];
  entries: EntryRecord[];
  investors: InvestorRecord[];
}

export const useLedgerStore = create<LedgerState>(() => ({
  projects: demoProjects,
  entries: demoEntries,
  investors: demoInvestors,
}));

/* ----------------------------- selectors -------------------------------- */

/** Sum of money-in minus money-out across all entries. */
export const selectBalance = (state: LedgerState): number =>
  state.entries.reduce(
    (acc, e) => acc + (isMoneyIn(e.type) ? e.amount : -e.amount),
    0
  );

export const selectMoneyIn = (state: LedgerState): number =>
  state.entries.filter((e) => isMoneyIn(e.type)).reduce((a, e) => a + e.amount, 0);

export const selectMoneyOut = (state: LedgerState): number =>
  state.entries.filter((e) => !isMoneyIn(e.type)).reduce((a, e) => a + e.amount, 0);
