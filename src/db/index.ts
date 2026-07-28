/** Database layer barrel. */
export { getDatabase, initDatabase } from './database';
export { runMigrations, seedDefaults } from './migrations';
export { uuid, nowISO } from './uuid';
export * from './schema';
export * from './repositories';
export { clearAllData, clearPurchaseOrders, getTableCounts, loadDemoData, TABLE_NAMES } from './demo';
export {
  clearStressData,
  estimateAttendance,
  estimateTransactions,
  measureStorage,
  runDataAudit,
  runStressBenchmark,
  seedStressData,
  STRESS_PRESETS,
  type AuditRow,
  type BenchRow,
  type StorageReport,
  type StressPreset,
  type StressProgress,
  type StressReport,
} from './stress';
export { runDbTests, type TestResult } from './tests';
