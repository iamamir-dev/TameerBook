/**
 * TameerBook offline database schema (expo-sqlite).
 *
 * This file is the single source of truth for the persisted data model:
 * enums, row types (keyed in snake_case to match SQLite columns exactly, so
 * `getAllAsync<Row>` results need no mapping), the DDL, and the default seed
 * data (categories + milestone template).
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

/**
 * Deal → delivery pipeline, in order. Buying is the essential Pakistani
 * milestones only (no "negotiation/agreement" filler): the new deal, then
 * token, bayana, transfer, possession.
 */
export const PROJECT_STAGES = [
  'TOKEN_PAID',
  'BAYANA_PAID',
  'TRANSFER',
  'POSSESSION',
  'CONSTRUCTION',
  'FINISHING',
  'LISTED_FOR_SALE',
  'CLOSED',
] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

export const PROFIT_METHODS = ['SIMPLE', 'TIME_WEIGHTED'] as const;
export type ProfitMethod = (typeof PROFIT_METHODS)[number];

export const PROJECT_STATUSES = ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const SIZE_UNITS = ['MARLA', 'KANAL', 'SQYD'] as const;
export type SizeUnit = (typeof SIZE_UNITS)[number];

export const PROPERTY_PAYMENT_TYPES = ['TOKEN', 'BAYANA', 'INSTALLMENT', 'FINAL'] as const;
export type PropertyPaymentType = (typeof PROPERTY_PAYMENT_TYPES)[number];

export const PAYMENT_MODES = ['CASH', 'BANK', 'JAZZCASH', 'CREDIT'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

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
] as const;
export type CapitalEntryType = (typeof CAPITAL_ENTRY_TYPES)[number];

export const MILESTONE_STATUSES = ['PENDING', 'IN_PROGRESS', 'DONE'] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

/* -------------------------------------------------------------------------- */
/*  Row types (snake_case to mirror columns)                                  */
/* -------------------------------------------------------------------------- */

interface Base {
  id: string;
  created_at: string;
  created_by: string;
}

export interface ProjectRow extends Base {
  name: string;
  stage: ProjectStage;
  start_date: string | null;
  profit_method: ProfitMethod;
  status: ProjectStatus;
}

export interface PropertyRow extends Base {
  project_id: string;
  society: string | null;
  block: string | null;
  plot_no: string | null;
  size_value: number | null;
  size_unit: SizeUnit | null;
  agreed_price: number | null;
  seller_name: string | null;
  seller_cnic: string | null;
  seller_phone: string | null;
  transfer_date: string | null;
  /** Deadline by which transfer must complete (set when bayana is paid). */
  transfer_deadline: string | null;
}

export interface PropertyPaymentRow extends Base {
  property_id: string;
  type: PropertyPaymentType;
  amount: number;
  date: string;
  mode: PaymentMode;
  doc_id: string | null;
}

export interface PartyRow extends Base {
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

export interface TransactionRow extends Base {
  project_id: string;
  direction: TxnDirection;
  category_id: string | null;
  amount: number;
  date: string;
  mode: PaymentMode;
  party_id: string | null;
  description: string | null;
  doc_id: string | null;
  is_void: number; // 0 | 1
  void_of_id: string | null;
}

export interface InvestorRow extends Base {
  name: string;
  cnic: string | null;
  phone: string | null;
  photo_uri: string | null;
  bank_info: string | null;
  status: InvestorStatus;
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
  agreed_price: number;
  completed_at: string | null;
}

export interface SaleReceiptRow extends Base {
  sale_id: string;
  amount: number;
  date: string;
  mode: PaymentMode;
  doc_id: string | null;
}

export interface ProjectStageHistoryRow extends Base {
  project_id: string;
  from_stage: ProjectStage | null;
  to_stage: ProjectStage;
  changed_at: string;
}

/* -------------------------------------------------------------------------- */
/*  DDL                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Schema version 1. Legacy demo tables (from the earlier in-memory build) are
 * dropped first — they never held real data — so we always land on the
 * current shape regardless of what a previous launch created.
 */
export const SCHEMA_V1 = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS entries;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS investors;

CREATE TABLE projects (
  id            TEXT PRIMARY KEY NOT NULL,
  created_at    TEXT NOT NULL,
  created_by    TEXT NOT NULL DEFAULT 'local',
  name          TEXT NOT NULL,
  stage         TEXT NOT NULL DEFAULT 'DEAL_PIPELINE',
  start_date    TEXT,
  profit_method TEXT NOT NULL DEFAULT 'SIMPLE',
  status        TEXT NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE properties (
  id            TEXT PRIMARY KEY NOT NULL,
  created_at    TEXT NOT NULL,
  created_by    TEXT NOT NULL DEFAULT 'local',
  project_id    TEXT NOT NULL,
  society       TEXT,
  block         TEXT,
  plot_no       TEXT,
  size_value    REAL,
  size_unit     TEXT,
  agreed_price  REAL,
  seller_name   TEXT,
  seller_cnic   TEXT,
  seller_phone  TEXT,
  transfer_date TEXT,
  FOREIGN KEY (project_id) REFERENCES projects (id)
);

CREATE TABLE property_payments (
  id          TEXT PRIMARY KEY NOT NULL,
  created_at  TEXT NOT NULL,
  created_by  TEXT NOT NULL DEFAULT 'local',
  property_id TEXT NOT NULL,
  type        TEXT NOT NULL,
  amount      REAL NOT NULL DEFAULT 0,
  date        TEXT NOT NULL,
  mode        TEXT NOT NULL DEFAULT 'CASH',
  doc_id      TEXT,
  FOREIGN KEY (property_id) REFERENCES properties (id)
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

CREATE TABLE transactions (
  id          TEXT PRIMARY KEY NOT NULL,
  created_at  TEXT NOT NULL,
  created_by  TEXT NOT NULL DEFAULT 'local',
  project_id  TEXT NOT NULL,
  direction   TEXT NOT NULL,
  category_id TEXT,
  amount      REAL NOT NULL DEFAULT 0,
  date        TEXT NOT NULL,
  mode        TEXT NOT NULL DEFAULT 'CASH',
  party_id    TEXT,
  description TEXT,
  doc_id      TEXT,
  is_void     INTEGER NOT NULL DEFAULT 0,
  void_of_id  TEXT,
  FOREIGN KEY (project_id) REFERENCES projects (id),
  FOREIGN KEY (category_id) REFERENCES categories (id)
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
  id            TEXT PRIMARY KEY NOT NULL,
  created_at    TEXT NOT NULL,
  created_by    TEXT NOT NULL DEFAULT 'local',
  project_id    TEXT NOT NULL,
  buyer_party_id TEXT,
  agreed_price  REAL NOT NULL DEFAULT 0,
  completed_at  TEXT,
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
  mode       TEXT NOT NULL DEFAULT 'CASH',
  doc_id     TEXT,
  FOREIGN KEY (sale_id) REFERENCES sales (id)
);

CREATE INDEX idx_txn_project ON transactions (project_id);
CREATE INDEX idx_txn_category ON transactions (category_id);
CREATE INDEX idx_txn_void ON transactions (is_void);
CREATE INDEX idx_prop_project ON properties (project_id);
CREATE INDEX idx_pi_project ON project_investors (project_id);
CREATE INDEX idx_cap_pi ON capital_ledger (project_investor_id);
CREATE INDEX idx_ms_project ON milestones (project_id);
`;

/** Schema version 2 — records every project stage transition for audit. */
export const SCHEMA_V2 = `
CREATE TABLE project_stage_history (
  id         TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'local',
  project_id TEXT NOT NULL,
  from_stage TEXT,
  to_stage   TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects (id)
);

CREATE INDEX idx_stagehist_project ON project_stage_history (project_id);
`;

/** Schema version 3 — transfer deadline on properties (set when bayana paid). */
export const SCHEMA_V3 = `
ALTER TABLE properties ADD COLUMN transfer_deadline TEXT;
`;

/**
 * Schema version 4 — persisted app settings (key/value). Lets preferences such
 * as language, dark mode, and the default investor profit-share % survive
 * relaunches (the settings store hydrates from here on launch).
 */
export const SCHEMA_V4 = `
CREATE TABLE app_settings (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

/**
 * Schema version 5 — the buying pipeline dropped the NEGOTIATION/AGREEMENT
 * filler stages. Move any project still sitting on them back to DEAL_PIPELINE
 * so its stage stays a valid pipeline value.
 */
export const SCHEMA_V5 = `
UPDATE projects SET stage = 'DEAL_PIPELINE' WHERE stage IN ('NEGOTIATION', 'AGREEMENT');
`;

/**
 * Schema version 6 — the pre-token "deal/negotiation/agreement" stages are
 * gone; the pipeline now starts at TOKEN_PAID (the first thing you actually do).
 * Move any project still on a removed stage to the new start.
 */
export const SCHEMA_V6 = `
UPDATE projects SET stage = 'TOKEN_PAID' WHERE stage IN ('DEAL_PIPELINE', 'NEGOTIATION', 'AGREEMENT');
`;

/** Ordered list of migrations, applied by `PRAGMA user_version`. */
export const MIGRATIONS: { version: number; sql: string }[] = [
  { version: 1, sql: SCHEMA_V1 },
  { version: 2, sql: SCHEMA_V2 },
  { version: 3, sql: SCHEMA_V3 },
  { version: 4, sql: SCHEMA_V4 },
  { version: 5, sql: SCHEMA_V5 },
  { version: 6, sql: SCHEMA_V6 },
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

/** Seeded once on first run. Urdu names included for the bilingual UI. */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // Expenses
  { name_en: 'Plot Payment', name_ur: 'پلاٹ کی ادائیگی', type: 'EXPENSE', icon: 'home' },
  { name_en: 'Transfer Fees & Tax', name_ur: 'ٹرانسفر فیس و ٹیکس', type: 'EXPENSE', icon: 'receipt' },
  { name_en: 'Naqsha/Approval', name_ur: 'نقشہ/منظوری', type: 'EXPENSE', icon: 'project' },
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
  { name_en: 'Contractor', name_ur: 'ٹھیکیدار', type: 'EXPENSE', icon: 'tools' },
  { name_en: 'Utilities', name_ur: 'یوٹیلٹی بل', type: 'EXPENSE', icon: 'receipt' },
  { name_en: 'Misc', name_ur: 'متفرق', type: 'EXPENSE', icon: 'kharcha' },
  { name_en: 'Udhaar Payment', name_ur: 'ادھار کی واپسی', type: 'EXPENSE', icon: 'investor' },
  // Income
  { name_en: 'Investor Investment', name_ur: 'سرمایہ کاری', type: 'INCOME', icon: 'investor' },
  { name_en: 'Buyer Receipt', name_ur: 'خریدار کی رقم', type: 'INCOME', icon: 'aamdani' },
  { name_en: 'Other Income', name_ur: 'دیگر آمدنی', type: 'INCOME', icon: 'aamdani' },
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

/* -------------------------------------------------------------------------- */
/*  Legacy in-memory demo types                                               */
/*  (still used by useLedgerStore + the current Home UI — NOT persisted)      */
/* -------------------------------------------------------------------------- */

/** A construction project the user is managing money for (demo store). */
export interface ProjectRecord {
  id: string;
  name: string;
  location: string;
  /** One of the StageTracker stage keys. */
  stageKey: string;
  createdAt: string;
}

/** Money direction for a demo ledger entry. */
export type EntryType = 'kharcha' | 'aamdani' | 'material' | 'dehari' | 'investor';

/** A single demo ledger entry (money in or out) against a project. */
export interface EntryRecord {
  id: string;
  projectId: string;
  type: EntryType;
  amount: number;
  note: string;
  receiptUri: string | null;
  date: string;
  createdAt: string;
}

/** A person who invests money into projects (demo store). */
export interface InvestorRecord {
  id: string;
  name: string;
  phone: string;
  committed: number;
}
