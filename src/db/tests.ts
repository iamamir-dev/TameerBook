import { getDatabase } from './database';
import {
  addCapitalEntry,
  addInvestor,
  addProjectInvestor,
  addTransaction,
  createProject,
  getCashBankBalance,
  getProjectCapitalSummary,
  getProjectTotals,
  getTransaction,
  voidTransaction,
} from './repositories';

export interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
}

const near = (a: number, b: number, eps = 0.001) => Math.abs(a - b) < eps;

/** Remove all rows created under a test project (dev-only raw cleanup). */
async function cleanupProject(projectId: string, investorIds: string[]): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `DELETE FROM capital_ledger WHERE project_investor_id IN
       (SELECT id FROM project_investors WHERE project_id = ?)`,
    projectId
  );
  await db.runAsync('DELETE FROM project_investors WHERE project_id = ?', projectId);
  await db.runAsync('DELETE FROM transactions WHERE project_id = ?', projectId);
  await db.runAsync('DELETE FROM milestones WHERE project_id = ?', projectId);
  await db.runAsync('DELETE FROM projects WHERE id = ?', projectId);
  for (const id of investorIds) {
    await db.runAsync('DELETE FROM investors WHERE id = ?', id);
  }
}

/** Proves voidTransaction appends a reversal and excludes the original. */
async function testVoidCreatesReversal(): Promise<TestResult> {
  const name = 'void creates reversal (never deletes)';
  const project = await createProject({ name: 'DBTEST void' }, { withDefaultMilestones: false });
  try {
    const txn = await addTransaction({
      projectId: project.id,
      direction: 'OUT',
      amount: 1000,
      date: '2026-06-06',
      mode: 'CASH',
    });

    const before = await getProjectTotals(project.id);
    const reversal = await voidTransaction(txn.id);
    const original = await getTransaction(txn.id);
    const after = await getProjectTotals(project.id);

    const checks = [
      ['original out=1000', near(before.totalOut, 1000)],
      ['reversal links original', reversal.void_of_id === txn.id],
      ['reversal direction flipped', reversal.direction === 'IN'],
      ['original still exists', original !== null],
      ['original flagged void', original?.is_void === 1],
      ['out=0 after void', near(after.totalOut, 0)],
    ] as const;

    const failed = checks.filter(([, ok]) => !ok).map(([d]) => d);
    return {
      name,
      passed: failed.length === 0,
      detail: failed.length ? `failed: ${failed.join(', ')}` : 'reversal appended, original kept & excluded',
    };
  } finally {
    await cleanupProject(project.id, []);
  }
}

/** Proves cash/bank balances and project totals compute correctly. */
async function testBalancesCompute(): Promise<TestResult> {
  const name = 'balances compute correctly';
  const project = await createProject({ name: 'DBTEST bal' }, { withDefaultMilestones: false });
  try {
    await addTransaction({ projectId: project.id, direction: 'IN', amount: 5000, date: '2026-06-06', mode: 'CASH' });
    await addTransaction({ projectId: project.id, direction: 'OUT', amount: 2000, date: '2026-06-06', mode: 'BANK' });

    const bal = await getCashBankBalance(project.id);
    const totals = await getProjectTotals(project.id);

    const checks = [
      ['cash=5000', near(bal.cash, 5000)],
      ['bank=-2000', near(bal.bank, -2000)],
      ['total=3000', near(bal.total, 3000)],
      ['totalIn=5000', near(totals.totalIn, 5000)],
      ['totalOut=2000', near(totals.totalOut, 2000)],
      ['net=3000', near(totals.net, 3000)],
    ] as const;

    const failed = checks.filter(([, ok]) => !ok).map(([d]) => d);
    return {
      name,
      passed: failed.length === 0,
      detail: failed.length ? `failed: ${failed.join(', ')}` : 'cash 5000 / bank -2000 / total 3000',
    };
  } finally {
    await cleanupProject(project.id, []);
  }
}

/** Proves ownership percentages sum to 100. */
async function testOwnershipSumsTo100(): Promise<TestResult> {
  const name = 'ownership % sums to 100';
  const project = await createProject({ name: 'DBTEST own' }, { withDefaultMilestones: false });
  const invA = await addInvestor({ name: 'DBTEST A' });
  const invB = await addInvestor({ name: 'DBTEST B' });
  try {
    const piA = await addProjectInvestor({ projectId: project.id, investorId: invA.id, committedAmount: 600000 });
    const piB = await addProjectInvestor({ projectId: project.id, investorId: invB.id, committedAmount: 400000 });
    await addCapitalEntry({ projectInvestorId: piA.id, entryType: 'INITIAL', amount: 600000, date: '2026-06-06' });
    await addCapitalEntry({ projectInvestorId: piB.id, entryType: 'INITIAL', amount: 400000, date: '2026-06-06' });

    const summary = await getProjectCapitalSummary(project.id);
    const sumPct = summary.shares.reduce((s, x) => s + x.ownershipPct, 0);
    const shareA = summary.shares.find((s) => s.projectInvestorId === piA.id);
    const shareB = summary.shares.find((s) => s.projectInvestorId === piB.id);

    const checks = [
      ['total capital=1,000,000', near(summary.totalCapital, 1_000_000)],
      ['A owns 60%', near(shareA?.ownershipPct ?? 0, 60)],
      ['B owns 40%', near(shareB?.ownershipPct ?? 0, 40)],
      ['sum=100%', near(sumPct, 100)],
    ] as const;

    const failed = checks.filter(([, ok]) => !ok).map(([d]) => d);
    return {
      name,
      passed: failed.length === 0,
      detail: failed.length ? `failed: ${failed.join(', ')}` : '60% + 40% = 100%',
    };
  } finally {
    await cleanupProject(project.id, [invA.id, invB.id]);
  }
}

/** Run all DB self-tests in sequence and return their results. */
export async function runDbTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  for (const test of [testVoidCreatesReversal, testBalancesCompute, testOwnershipSumsTo100]) {
    try {
      results.push(await test());
    } catch (e) {
      results.push({ name: test.name, passed: false, detail: `threw: ${String(e)}` });
    }
  }
  return results;
}
