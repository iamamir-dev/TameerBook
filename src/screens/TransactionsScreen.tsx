/**
 * The Transactions route renders THE money page (Cash & Accounts + the ledger,
 * merged into one screen with Summary | Transactions tabs). It opens on the
 * Transactions tab because the route name isn't 'Cash', and honors the
 * caller's accountId / projectId pre-filters.
 */
export { CashScreen as TransactionsScreen } from './CashScreen';
