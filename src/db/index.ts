/** Database layer barrel. */
export { getDatabase, initDatabase } from './database';
export { runMigrations, seedDefaults } from './migrations';
export { uuid, nowISO } from './uuid';
export * from './schema';
export * from './repositories';
export { clearAllData, getTableCounts, loadDemoData, TABLE_NAMES } from './demo';
export { runDbTests, type TestResult } from './tests';
