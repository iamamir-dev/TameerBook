/**
 * TameerBook offline database schema (expo-sqlite).
 *
 * This file is the single source of truth for the persisted data model:
 * enums, row types (keyed in snake_case to match SQLite columns exactly, so
 * `getAllAsync<Row>` results need no mapping), the DDL, and the default seed
 * data (categories + default cash account + milestone template).
 *
 * v2 data model ("cash-flow first"):
 * - `accounts` (bank / cash-in-hand / wallet) are the source of truth for
 *   money. Every real cash movement is a `transactions` row posted against an
 *   account; balances are always DERIVED (opening + Σin − Σout), never stored.
 * - `plots` are standalone purchases (deal price, seller payments, expenses,
 *   documents) that can later be included in a project.
 * - A project = an included plot + construction + sale. No stage pipeline.
 * - `laborers` are reusable workers; per-project wage + daily attendance
 *   accrues a wage balance (an accrual, not a cash movement).
 * - `udhaar` tracks money lent to (or taken from) a person  who may not be
 *   saved anywhere else (free-text name)  flowing out of / back into accounts.
 *
 * Design notes:
 * - Every table has `id` (TEXT uuid), `created_at` (ISO), `created_by`.
 * - `transactions` and `capital_ledger` are APPEND-ONLY ledgers: rows are
 *   never updated or deleted. A mistake is corrected by appending a reversal
 *   (see `voidTransaction`), preserving a full audit trail.
 */

/* -------------------------------------------------------------------------- */
/*  Enums (const arrays + derived union types)                                */
/* -------------------------------------------------------------------------- */

/** Where money lives: a named bank account, physical cash, or a mobile wallet. */
export const ACCOUNT_TYPES = ['BANK', 'CASH', 'WALLET'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Lifecycle of a purchased plot. */
export const PLOT_STATUSES = ['OWNED', 'IN_PROJECT', 'SOLD'] as const;
export type PlotStatus = (typeof PLOT_STATUSES)[number];

export const PROJECT_STATUSES = ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const SIZE_UNITS = ['MARLA', 'KANAL', 'SQYD'] as const;
export type SizeUnit = (typeof SIZE_UNITS)[number];

/** Named instalments of a property deal (seller side or buyer side). */
export const PAY_TYPES = ['TOKEN', 'BAYANA', 'INSTALLMENT', 'FINAL'] as const;
export type PayType = (typeof PAY_TYPES)[number];

/** Which slice of the business a transaction belongs to. */
export const TXN_PHASES = ['PLOT', 'CONSTRUCTION', 'SALE', 'GENERAL'] as const;
export type TxnPhase = (typeof TXN_PHASES)[number];

export const PARTY_TYPES = [
  'SELLER',
  'BUYER',
  'CONTRACTOR',
  'SUPPLIER',
  'DEALER',
  'LABOR',
] as const;
export type PartyType = (typeof PARTY_TYPES)[number];

export const CATEGORY_TYPES = ['INCOME', 'EXPENSE'] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const TXN_DIRECTIONS = ['IN', 'OUT'] as const;
export type TxnDirection = (typeof TXN_DIRECTIONS)[number];

export const INVESTOR_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type InvestorStatus = (typeof INVESTOR_STATUSES)[number];

export const PI_STATUSES = ['ACTIVE', 'EXITED', 'SETTLED'] as const;
export type ProjectInvestorStatus = (typeof PI_STATUSES)[number];

export const CAPITAL_ENTRY_TYPES = [
  'INITIAL',
  'ADDITIONAL',
  'WITHDRAWAL',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'EXIT_SETTLEMENT',
  'PROFIT_PAYOUT',
  'LOSS_ADJ',
  'DONATION',
] as const;
export type CapitalEntryType = (typeof CAPITAL_ENTRY_TYPES)[number];

export const MILESTONE_STATUSES = ['PENDING', 'IN_PROGRESS', 'DONE'] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const LABORER_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type LaborerStatus = (typeof LABORER_STATUSES)[number];

/** A day's attendance: full dihari, half dihari, or absent (no wage). */
export const ATTENDANCE_STATUSES = ['FULL', 'HALF', 'ABSENT'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** GIVEN = we lent money out (receivable); TAKEN = we borrowed (payable). */
export const UDHAAR_DIRECTIONS = ['GIVEN', 'TAKEN'] as const;
export type UdhaarDirection = (typeof UDHAAR_DIRECTIONS)[number];

export const UDHAAR_STATUSES = ['OPEN', 'CLEARED'] as const;
export type UdhaarStatus = (typeof UDHAAR_STATUSES)[number];

/* -------------------------------------------------------------------------- */
/*  Row types (snake_case to mirror columns)                                  */
/* -------------------------------------------------------------------------- */

interface Base {
  id: string;
  created_at: string;
  created_by: string;
}

/**
 * A company/workspace. Every ROOT entity (accounts, plots, projects,
 * investors, laborers, udhaar, parties, transactions) carries a `company_id`;
 * child tables inherit the scope through their parents. Switching companies
 * switches the whole world.
 */
export interface CompanyRow extends Base {
  name: string;
  owner_name: string | null;
  phone: string | null;
}

/** A place money lives. Balance is DERIVED: opening + Σ(IN) − Σ(OUT). */
export interface AccountRow extends Base {
  company_id: string | null;
  name: string;
  type: AccountType;
  opening_balance: number;
  icon: string | null;
  color: string | null;
  sort_order: number;
  is_archived: number; // 0 | 1
}

/** A standalone plot purchase; joins a project only when included in one. */
export interface PlotRow extends Base {
  company_id: string | null;
  name: string;
  society: string | null;
  block: string | null;
  plot_no: string | null;
  size_value: number | null;
  size_unit: SizeUnit | null;
  /** Price agreed with the seller at deal time. */
  deal_price: number;
  seller_name: string | null;
  seller_cnic: string | null;
  seller_phone: string | null;
  transfer_date: string | null;
  transfer_deadline: string | null;
  status: PlotStatus;
  /** Set when the plot is included in a project. */
  project_id: string | null;
}

export interface ProjectRow extends Base {
  company_id: string | null;
  name: string;
  /** The plot this project builds on (set at creation). */
  plot_id: string | null;
  start_date: string | null;
  status: ProjectStatus;
  /** Optional per-project override of the Settings donation %. */
  donation_pct: number | null;
}

export interface PartyRow extends Base {
  company_id: string | null;
  type: PartyType;
  name: string;
  phone: string | null;
  cnic: string | null;
}

export interface CategoryRow extends Base {
  parent_id: string | null;
  name_en: string;
  name_ur: string;
  type: CategoryType;
  icon: string | null;
}

/**
 * The universal money primitive: every real cash movement is one row posted
 * against an account. Transfers are two linked rows (shared `transfer_id`);
 * udhaar rows link to their `udhaar` record. APPEND-ONLY.
 */
export interface TransactionRow extends Base {
  company_id: string | null;
  direction: TxnDirection;
  amount: number;
  date: string;
  /** The account money moved through. Null only for legacy/system rows. */
  account_id: string | null;
  /** Optional: which project this belongs to (null = personal/global money). */
  project_id: string | null;
  /** Optional: which plot this belongs to (seller payments / plot expenses). */
  plot_id: string | null;
  /** Which slice of the business: PLOT / CONSTRUCTION / SALE / GENERAL. */
  phase: TxnPhase | null;
  category_id: string | null;
  party_id: string | null;
  /** Free-text counterparty (e.g. an udhaar person not saved as a party). */
  counterparty_name: string | null;
  /** Named instalment (TOKEN/BAYANA/...) for seller/buyer deal payments. */
  pay_type: PayType | null;
  /** Links the two rows of an account-to-account transfer. */
  transfer_id: string | null;
  /** Links a give/return to its udhaar record. */
  udhaar_id: string | null;
  /** Links a wage payment to the worker's project attachment. */
  labor_id: string | null;
  /** Links a payment received to the investor it came from (like plot_id). */
  investor_id: string | null;
  description: string | null;
  doc_id: string | null;
  is_void: number; // 0 | 1
  void_of_id: string | null;
}

export interface InvestorRow extends Base {
  company_id: string | null;
  name: string;
  cnic: string | null;
  phone: string | null;
  photo_uri: string | null;
  bank_info: string | null;
  status: InvestorStatus;
  /** Total the investor has pledged to invest (their stake basis). */
  committed_amount: number;
  /** How much of that pledge they've actually handed over so far. */
  given_amount: number;
}

export interface ProjectInvestorRow extends Base {
  project_id: string;
  investor_id: string;
  committed_amount: number;
  profit_pct: number | null;
  status: ProjectInvestorStatus;
  joined_at: string | null;
  exited_at: string | null;
}

export interface CapitalLedgerRow extends Base {
  project_investor_id: string;
  entry_type: CapitalEntryType;
  amount: number;
  counterparty_pi_id: string | null;
  valuation_amount: number | null;
  date: string;
  note: string | null;
  doc_id: string | null;
}

export interface MilestoneRow extends Base {
  project_id: string;
  name: string;
  sequence: number;
  pct_weight: number;
  status: MilestoneStatus;
  completed_date: string | null;
}

export interface DocumentRow extends Base {
  entity_type: string;
  entity_id: string;
  label: string | null;
  file_uri: string;
  mime: string | null;
}

export interface SaleRow extends Base {
  project_id: string;
  buyer_party_id: string | null;
  /** Free-text buyer (may not be saved as a party). */
  buyer_name: string | null;
  agreed_price: number;
  completed_at: string | null;
}

export interface SaleReceiptRow extends Base {
  sale_id: string;
  amount: number;
  date: string;
  /** The account the buyer's money landed in. */
  account_id: string | null;
  /** Named instalment from the buyer (TOKEN/BAYANA/...). */
  pay_type: PayType | null;
  doc_id: string | null;
}

/** A reusable worker (mazdoor)  attach to projects with a per-project wage. */
export interface LaborerRow extends Base {
  company_id: string | null;
  name: string;
  phone: string | null;
  cnic: string | null;
  photo_uri: string | null;
  status: LaborerStatus;
}

/** A worker attached to a project with the dihari agreed for that project. */
export interface ProjectLaborerRow extends Base {
  project_id: string;
  laborer_id: string;
  daily_wage: number;
  status: LaborerStatus;
  joined_at: string | null;
}

/**
 * One row per worker per day. `wage_accrued` snapshots the wage owed for the
 * day (full/half/0) so later wage changes don't rewrite history. An accrual,
 * NOT a cash movement  payment happens via a Labor Payment transaction.
 */
export interface LaborAttendanceRow extends Base {
  project_laborer_id: string;
  date: string;
  status: AttendanceStatus;
  wage_accrued: number;
  note: string | null;
}

/**
 * A lending relationship with a person (possibly unsaved  free-text name).
 * Balance is derived from linked transactions: Σ(given) − Σ(returned).
 */
export interface UdhaarRow extends Base {
  company_id: string | null;
  person_name: string;
  party_id: string | null;
  direction: UdhaarDirection;
  note: string | null;
  status: UdhaarStatus;
}

/* -------------------------------------------------------------------------- */
/*  DDL                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Schema version 7  the v2 "cash-flow first" clean rebuild (pre-launch, so
 * legacy dev data is disposable). Drops every v1 table and recreates the new
 * model. `app_settings` is preserved (prefs survive). Fresh installs run this
 * as their first (only) migration.
 */
export const SCHEMA_V7_CLEAN_REBUILD = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS entries;
DROP TABLE IF EXISTS project_stage_history;
DROP TABLE IF EXISTS property_payments;
DROP TABLE IF EXISTS properties;
DROP TABLE IF EXISTS sale_receipts;
DROP TABLE IF EXISTS sales;
DROP TABLE IF EXISTS milestones;
DROP TABLE IF EXISTS capital_ledger;
DROP TABLE IF EXISTS project_investors;
DROP TABLE IF EXISTS investors;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS parties;
DROP TABLE IF EXISTS projects;

CREATE TABLE accounts (
  id              TEXT PRIMARY KEY NOT NULL,
  created_at      TEXT NOT NULL,
  created_by      TEXT NOT NULL DEFAULT 'local',
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'CASH',
  opening_balance REAL NOT NULL DEFAULT 0,
  icon            TEXT,
  color           TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_archived     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE projects (
  id           TEXT PRIMARY KEY NOT NULL,
  created_at   TEXT NOT NULL,
  created_by   TEXT NOT NULL DEFAULT 'local',
  name         TEXT NOT NULL,
  plot_id      TEXT,
  start_date   TEXT,
  status       TEXT NOT NULL DEFAULT 'ACTIVE',
  donation_pct REAL
);

CREATE TABLE plots (
  id                TEXT PRIMARY KEY NOT NULL,
  created_at        TEXT NOT NULL,
  created_by        TEXT NOT NULL DEFAULT 'local',
  name              TEXT NOT NULL,
  society           TEXT,
  block             TEXT,
  plot_no           TEXT,
  size_value        REAL,
  size_unit         TEXT,
  deal_price        REAL NOT NULL DEFAULT 0,
  seller_name       TEXT,
  seller_cnic       TEXT,
  seller_phone      TEXT,
  transfer_date     TEXT,
  transfer_deadline TEXT,
  status            TEXT NOT NULL DEFAULT 'OWNED',
  project_id        TEXT,
  FOREIGN KEY (project_id) REFERENCES projects (id)
);

CREATE TABLE parties (
  id         TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'local',
  type       TEXT NOT NULL,
  name       TEXT NOT NULL,
  phone      TEXT,
  cnic       TEXT
);

CREATE TABLE categories (
  id         TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'local',
  parent_id  TEXT,
  name_en    TEXT NOT NULL,
  name_ur    TEXT NOT NULL,
  type       TEXT NOT NULL,
  icon       TEXT
);

CREATE TABLE udhaar (
  id          TEXT PRIMARY KEY NOT NULL,
  created_at  TEXT NOT NULL,
  created_by  TEXT NOT NULL DEFAULT 'local',
  person_name TEXT NOT NULL,
  party_id    TEXT,
  direction   TEXT NOT NULL DEFAULT 'GIVEN',
  note        TEXT,
  status      TEXT NOT NULL DEFAULT 'OPEN',
  FOREIGN KEY (party_id) REFERENCES parties (id)
);

CREATE TABLE transactions (
  id                TEXT PRIMARY KEY NOT NULL,
  created_at        TEXT NOT NULL,
  created_by        TEXT NOT NULL DEFAULT 'local',
  direction         TEXT NOT NULL,
  amount            REAL NOT NULL DEFAULT 0,
  date              TEXT NOT NULL,
  account_id        TEXT,
  project_id        TEXT,
  plot_id           TEXT,
  phase             TEXT,
  category_id       TEXT,
  party_id          TEXT,
  counterparty_name TEXT,
  pay_type          TEXT,
  transfer_id       TEXT,
  udhaar_id         TEXT,
  labor_id          TEXT,
  description       TEXT,
  doc_id            TEXT,
  is_void           INTEGER NOT NULL DEFAULT 0,
  void_of_id        TEXT,
  FOREIGN KEY (account_id) REFERENCES accounts (id),
  FOREIGN KEY (project_id) REFERENCES projects (id),
  FOREIGN KEY (plot_id) REFERENCES plots (id),
  FOREIGN KEY (category_id) REFERENCES categories (id),
  FOREIGN KEY (udhaar_id) REFERENCES udhaar (id),
  FOREIGN KEY (labor_id) REFERENCES project_laborers (id)
);

CREATE TABLE investors (
  id         TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'local',
  name       TEXT NOT NULL,
  cnic       TEXT,
  phone      TEXT,
  photo_uri  TEXT,
  bank_info  TEXT,
  status     TEXT NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE project_investors (
  id               TEXT PRIMARY KEY NOT NULL,
  created_at       TEXT NOT NULL,
  created_by       TEXT NOT NULL DEFAULT 'local',
  project_id       TEXT NOT NULL,
  investor_id      TEXT NOT NULL,
  committed_amount REAL NOT NULL DEFAULT 0,
  profit_pct       REAL,
  status           TEXT NOT NULL DEFAULT 'ACTIVE',
  joined_at        TEXT,
  exited_at        TEXT,
  FOREIGN KEY (project_id) REFERENCES projects (id),
  FOREIGN KEY (investor_id) REFERENCES investors (id)
);

CREATE TABLE capital_ledger (
  id                  TEXT PRIMARY KEY NOT NULL,
  created_at          TEXT NOT NULL,
  created_by          TEXT NOT NULL DEFAULT 'local',
  project_investor_id TEXT NOT NULL,
  entry_type          TEXT NOT NULL,
  amount              REAL NOT NULL DEFAULT 0,
  counterparty_pi_id  TEXT,
  valuation_amount    REAL,
  date                TEXT NOT NULL,
  note                TEXT,
  doc_id              TEXT,
  FOREIGN KEY (project_investor_id) REFERENCES project_investors (id)
);

CREATE TABLE laborers (
  id         TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'local',
  name       TEXT NOT NULL,
  phone      TEXT,
  cnic       TEXT,
  photo_uri  TEXT,
  status     TEXT NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE project_laborers (
  id         TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'local',
  project_id TEXT NOT NULL,
  laborer_id TEXT NOT NULL,
  daily_wage REAL NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'ACTIVE',
  joined_at  TEXT,
  FOREIGN KEY (project_id) REFERENCES projects (id),
  FOREIGN KEY (laborer_id) REFERENCES laborers (id)
);

CREATE TABLE labor_attendance (
  id                 TEXT PRIMARY KEY NOT NULL,
  created_at         TEXT NOT NULL,
  created_by         TEXT NOT NULL DEFAULT 'local',
  project_laborer_id TEXT NOT NULL,
  date               TEXT NOT NULL,
  status             TEXT NOT NULL,
  wage_accrued       REAL NOT NULL DEFAULT 0,
  note               TEXT,
  UNIQUE (project_laborer_id, date),
  FOREIGN KEY (project_laborer_id) REFERENCES project_laborers (id)
);

CREATE TABLE milestones (
  id             TEXT PRIMARY KEY NOT NULL,
  created_at     TEXT NOT NULL,
  created_by     TEXT NOT NULL DEFAULT 'local',
  project_id     TEXT NOT NULL,
  name           TEXT NOT NULL,
  sequence       INTEGER NOT NULL DEFAULT 0,
  pct_weight     REAL NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'PENDING',
  completed_date TEXT,
  FOREIGN KEY (project_id) REFERENCES projects (id)
);

CREATE TABLE documents (
  id          TEXT PRIMARY KEY NOT NULL,
  created_at  TEXT NOT NULL,
  created_by  TEXT NOT NULL DEFAULT 'local',
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  label       TEXT,
  file_uri    TEXT NOT NULL,
  mime        TEXT
);

CREATE TABLE sales (
  id             TEXT PRIMARY KEY NOT NULL,
  created_at     TEXT NOT NULL,
  created_by     TEXT NOT NULL DEFAULT 'local',
  project_id     TEXT NOT NULL,
  buyer_party_id TEXT,
  buyer_name     TEXT,
  agreed_price   REAL NOT NULL DEFAULT 0,
  completed_at   TEXT,
  FOREIGN KEY (project_id) REFERENCES projects (id),
  FOREIGN KEY (buyer_party_id) REFERENCES parties (id)
);

CREATE TABLE sale_receipts (
  id         TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'local',
  sale_id    TEXT NOT NULL,
  amount     REAL NOT NULL DEFAULT 0,
  date       TEXT NOT NULL,
  account_id TEXT,
  pay_type   TEXT,
  doc_id     TEXT,
  FOREIGN KEY (sale_id) REFERENCES sales (id),
  FOREIGN KEY (account_id) REFERENCES accounts (id)
);

CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE INDEX idx_txn_account ON transactions (account_id);
CREATE INDEX idx_txn_project ON transactions (project_id);
CREATE INDEX idx_txn_plot ON transactions (plot_id);
CREATE INDEX idx_txn_udhaar ON transactions (udhaar_id);
CREATE INDEX idx_txn_category ON transactions (category_id);
CREATE INDEX idx_txn_void ON transactions (is_void);
CREATE INDEX idx_plot_project ON plots (project_id);
CREATE INDEX idx_pi_project ON project_investors (project_id);
CREATE INDEX idx_cap_pi ON capital_ledger (project_investor_id);
CREATE INDEX idx_ms_project ON milestones (project_id);
CREATE INDEX idx_pl_project ON project_laborers (project_id);
CREATE INDEX idx_att_pl ON labor_attendance (project_laborer_id);
`;

/**
 * Schema version 8  multi-company workspaces. Adds the `companies` table and
 * a `company_id` column on every ROOT table (child tables inherit scope via
 * their parents). Existing dev data is backfilled into a default company so
 * nothing disappears; fresh installs create their first company in onboarding.
 */
export const SCHEMA_V8_COMPANIES = `
CREATE TABLE companies (
  id         TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'local',
  name       TEXT NOT NULL,
  owner_name TEXT,
  phone      TEXT
);

ALTER TABLE accounts ADD COLUMN company_id TEXT;
ALTER TABLE plots ADD COLUMN company_id TEXT;
ALTER TABLE projects ADD COLUMN company_id TEXT;
ALTER TABLE investors ADD COLUMN company_id TEXT;
ALTER TABLE laborers ADD COLUMN company_id TEXT;
ALTER TABLE udhaar ADD COLUMN company_id TEXT;
ALTER TABLE parties ADD COLUMN company_id TEXT;
ALTER TABLE transactions ADD COLUMN company_id TEXT;

CREATE INDEX idx_acc_company ON accounts (company_id);
CREATE INDEX idx_plot_company ON plots (company_id);
CREATE INDEX idx_proj_company ON projects (company_id);
CREATE INDEX idx_txn_company ON transactions (company_id);

-- Backfill: if any data already exists, keep it under a default company the
-- user can rename. Fresh installs skip this (no rows anywhere).
INSERT INTO companies (id, created_at, created_by, name, owner_name, phone)
SELECT '__default__', datetime('now'), 'local', 'My Company', NULL, NULL
WHERE EXISTS (SELECT 1 FROM accounts)
   OR EXISTS (SELECT 1 FROM plots)
   OR EXISTS (SELECT 1 FROM projects)
   OR EXISTS (SELECT 1 FROM transactions);

UPDATE accounts     SET company_id = '__default__' WHERE company_id IS NULL AND EXISTS (SELECT 1 FROM companies);
UPDATE plots        SET company_id = '__default__' WHERE company_id IS NULL AND EXISTS (SELECT 1 FROM companies);
UPDATE projects     SET company_id = '__default__' WHERE company_id IS NULL AND EXISTS (SELECT 1 FROM companies);
UPDATE investors    SET company_id = '__default__' WHERE company_id IS NULL AND EXISTS (SELECT 1 FROM companies);
UPDATE laborers     SET company_id = '__default__' WHERE company_id IS NULL AND EXISTS (SELECT 1 FROM companies);
UPDATE udhaar       SET company_id = '__default__' WHERE company_id IS NULL AND EXISTS (SELECT 1 FROM companies);
UPDATE parties      SET company_id = '__default__' WHERE company_id IS NULL AND EXISTS (SELECT 1 FROM companies);
UPDATE transactions SET company_id = '__default__' WHERE company_id IS NULL AND EXISTS (SELECT 1 FROM companies);
`;

/**
 * Ordered list of migrations, applied by `PRAGMA user_version`.
 * Versions 1–6 were the pre-launch v1 model; the clean rebuild replaces them,
 * so existing dev installs (user_version ≤ 6) and fresh installs both land on
 * version 7 directly, then 8 adds companies.
 */
/**
 * Schema version 9 — an investor carries a global pledge (`committed_amount`)
 * and how much they've paid in so far (`given_amount`). Project ownership % is
 * derived from committed amounts.
 */
export const SCHEMA_V9_INVESTOR_PLEDGE = `
ALTER TABLE investors ADD COLUMN committed_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE investors ADD COLUMN given_amount REAL NOT NULL DEFAULT 0;
`;

/**
 * Schema version 10 — payments received from an investor are tracked like a
 * plot's payments: each is a transaction tagged with `investor_id`, so
 * "received so far" = Σ those (against their committed pledge).
 */
export const SCHEMA_V10_INVESTOR_PAYMENTS = `
ALTER TABLE transactions ADD COLUMN investor_id TEXT;
CREATE INDEX idx_txn_investor ON transactions (investor_id);
`;

export const MIGRATIONS: { version: number; sql: string }[] = [
  { version: 7, sql: SCHEMA_V7_CLEAN_REBUILD },
  { version: 8, sql: SCHEMA_V8_COMPANIES },
  { version: 9, sql: SCHEMA_V9_INVESTOR_PLEDGE },
  { version: 10, sql: SCHEMA_V10_INVESTOR_PAYMENTS },
];

/* -------------------------------------------------------------------------- */
/*  Default seed data                                                         */
/* -------------------------------------------------------------------------- */

export interface DefaultCategory {
  name_en: string;
  name_ur: string;
  type: CategoryType;
  icon: string;
}

/**
 * Seeded once on first run. Urdu names included for the bilingual UI.
 * System categories (created/used by business logic, hidden from the manual
 * entry grid): Plot Payment, Transfer, Labor Payment, Sale Cost, Investor
 * Investment, Buyer Receipt.
 */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // Expenses  plot phase
  { name_en: 'Plot Payment', name_ur: 'پلاٹ کی ادائیگی', type: 'EXPENSE', icon: 'home' },
  { name_en: 'Transfer Fees & Tax', name_ur: 'ٹرانسفر فیس و ٹیکس', type: 'EXPENSE', icon: 'receipt' },
  { name_en: 'Naqsha/Approval', name_ur: 'نقشہ/منظوری', type: 'EXPENSE', icon: 'project' },
  // Expenses  construction phase
  { name_en: 'Cement', name_ur: 'سیمنٹ', type: 'EXPENSE', icon: 'material' },
  { name_en: 'Sariya', name_ur: 'سریا', type: 'EXPENSE', icon: 'material' },
  { name_en: 'Bricks', name_ur: 'اینٹیں', type: 'EXPENSE', icon: 'brick' },
  { name_en: 'Sand/Crush', name_ur: 'ریت/بجری', type: 'EXPENSE', icon: 'truck' },
  { name_en: 'Tiles', name_ur: 'ٹائلیں', type: 'EXPENSE', icon: 'material' },
  { name_en: 'Wood', name_ur: 'لکڑی', type: 'EXPENSE', icon: 'material' },
  { name_en: 'Paint', name_ur: 'پینٹ', type: 'EXPENSE', icon: 'material' },
  { name_en: 'Electric', name_ur: 'بجلی کا سامان', type: 'EXPENSE', icon: 'tools' },
  { name_en: 'Sanitary', name_ur: 'سینٹری', type: 'EXPENSE', icon: 'tools' },
  { name_en: 'Labor Dehari', name_ur: 'مزدور دیہاڑی', type: 'EXPENSE', icon: 'dehari' },
  { name_en: 'Labor Payment', name_ur: 'مزدور کی ادائیگی', type: 'EXPENSE', icon: 'dehari' },
  { name_en: 'Contractor', name_ur: 'ٹھیکیدار', type: 'EXPENSE', icon: 'tools' },
  { name_en: 'Utilities', name_ur: 'یوٹیلٹی بل', type: 'EXPENSE', icon: 'receipt' },
  // Expenses  sale phase + general
  { name_en: 'Sale Cost', name_ur: 'فروخت کے اخراجات', type: 'EXPENSE', icon: 'tag' },
  { name_en: 'Misc', name_ur: 'متفرق', type: 'EXPENSE', icon: 'kharcha' },
  // Income
  { name_en: 'Investor Investment', name_ur: 'سرمایہ کاری', type: 'INCOME', icon: 'investor' },
  { name_en: 'Buyer Receipt', name_ur: 'خریدار کی رقم', type: 'INCOME', icon: 'aamdani' },
  { name_en: 'Other Income', name_ur: 'دیگر آمدنی', type: 'INCOME', icon: 'aamdani' },
];

/**
 * System category names  created on demand by business logic and hidden from
 * the manual entry category grid.
 */
export const SYSTEM_CATEGORY_NAMES = [
  'Plot Payment',
  'Labor Payment',
  'Sale Cost',
  'Investor Investment',
  'Buyer Receipt',
  'Transfer',
  'Udhaar',
] as const;

export interface DefaultAccount {
  name: string;
  type: AccountType;
}

/** Seeded once on first run so entries always have somewhere to post. */
export const DEFAULT_ACCOUNTS: DefaultAccount[] = [
  { name: 'Cash in Hand', type: 'CASH' },
];

export interface DefaultMilestone {
  name: string;
  sequence: number;
  pct_weight: number;
}

/** 9 default construction milestones (pct weights sum to 100). */
export const DEFAULT_MILESTONES: DefaultMilestone[] = [
  { name: 'Foundation', sequence: 1, pct_weight: 15 },
  { name: 'Ground Slab', sequence: 2, pct_weight: 15 },
  { name: 'First Floor Slab', sequence: 3, pct_weight: 15 },
  { name: 'Plaster', sequence: 4, pct_weight: 12 },
  { name: 'Tile', sequence: 5, pct_weight: 10 },
  { name: 'Wood', sequence: 6, pct_weight: 10 },
  { name: 'Paint', sequence: 7, pct_weight: 8 },
  { name: 'Fittings', sequence: 8, pct_weight: 8 },
  { name: 'Complete', sequence: 9, pct_weight: 7 },
];

/** Default actor stamped on `created_by` when none is supplied. */
export const DEFAULT_USER = 'local';
