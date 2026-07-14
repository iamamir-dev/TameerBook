/**
 * Business-logic self-tests (run from DevTools). Implements the plan's test
 * matrix: accounts (T-ACC), entries (T-ENT), plots (T-PLOT), labor (T-LAB),
 * sale (T-SALE), project cost (T-PROJ), settlement + donation (T-SET),
 * udhaar (T-UDH) and the reconciliation invariant (T-REG).
 *
 * Tests run against the live dev DB; every row they create is tracked and
 * deleted afterwards, so they leave no residue.
 */
import { getDatabase } from './database';
import {
  addAccount,
  addCategory,
  deleteCategory,
  updateCategory,
  listCategoryTree,
  getCategory,
  getCategoryByNameEn,
  addInvestor,
  addLaborer,
  addPlotExpense,
  addPlotPayment,
  addProjectInvestor,
  addSaleCost,
  attachInvestorsToProject,
  getLaborerKhata,
  getProjectCapitalSummary,
  listInvestorsWithCapacity,
  markProjectCompleted,
  addSaleReceipt,
  addTransaction,
  attachLaborerToProject,
  computeSettlement,
  createPlot,
  createProject,
  createUdhaar,
  getAccountBalance,
  getConstructionSummary,
  getLaborBalance,
  getPlotSummary,
  getProjectCost,
  getProjectSettlementSummary,
  getSaleSummary,
  getTotalBalance,
  getTransaction,
  getUdhaarBalance,
  giveUdhaar,
  listAccountsWithBalance,
  markAttendance,
  payLaborer,
  returnUdhaar,
  settleProject,
  transferBetween,
  upsertSale,
  voidTransaction,
  addInvestment,
  addInvestorPayment,
  getInvestorSummary,
  getUdhaar,
  createCompany,
  getActiveCompanyId,
  getCompanyAssets,
  listPlots,
  listUdhaar,
  setActiveCompany,
} from './repositories';

export interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
}

const near = (a: number, b: number, eps = 0.01) => Math.abs(a - b) < eps;
const D = '2026-06-06';

type Check = readonly [string, boolean];

function report(name: string, checks: readonly Check[]): TestResult {
  const failed = checks.filter(([, ok]) => !ok).map(([d]) => d);
  return {
    name,
    passed: failed.length === 0,
    detail: failed.length ? `failed: ${failed.join(', ')}` : `${checks.length} checks ok`,
  };
}

/* -------------------------------------------------------------------------- */
/*  Tracked cleanup  every test registers what it creates                    */
/* -------------------------------------------------------------------------- */

class Cleanup {
  accounts: string[] = [];
  plots: string[] = [];
  projects: string[] = [];
  investors: string[] = [];
  laborers: string[] = [];
  udhaar: string[] = [];

  async run(): Promise<void> {
    const db = await getDatabase();
    for (const id of this.projects) {
      await db.runAsync(
        `DELETE FROM capital_ledger WHERE project_investor_id IN
           (SELECT id FROM project_investors WHERE project_id = ?)`,
        id
      );
      await db.runAsync('DELETE FROM project_investors WHERE project_id = ?', id);
      await db.runAsync(
        'DELETE FROM sale_receipts WHERE sale_id IN (SELECT id FROM sales WHERE project_id = ?)',
        id
      );
      await db.runAsync('DELETE FROM sales WHERE project_id = ?', id);
      // Transactions FIRST (they reference project_laborers via labor_id).
      await db.runAsync('DELETE FROM transactions WHERE project_id = ?', id);
      await db.runAsync(
        `DELETE FROM labor_attendance WHERE project_laborer_id IN
           (SELECT id FROM project_laborers WHERE project_id = ?)`,
        id
      );
      await db.runAsync('DELETE FROM project_laborers WHERE project_id = ?', id);
      await db.runAsync('DELETE FROM milestones WHERE project_id = ?', id);
      // Unlink any plot still pointing at this project before deleting it.
      await db.runAsync('UPDATE plots SET project_id = NULL WHERE project_id = ?', id);
      await db.runAsync('DELETE FROM projects WHERE id = ?', id);
    }
    for (const id of this.plots) {
      await db.runAsync('DELETE FROM transactions WHERE plot_id = ?', id);
      await db.runAsync('DELETE FROM plots WHERE id = ?', id);
    }
    for (const id of this.udhaar) {
      await db.runAsync('DELETE FROM transactions WHERE udhaar_id = ?', id);
      await db.runAsync('DELETE FROM udhaar WHERE id = ?', id);
    }
    for (const id of this.accounts) {
      await db.runAsync('DELETE FROM transactions WHERE account_id = ?', id);
      await db.runAsync('DELETE FROM accounts WHERE id = ?', id);
    }
    for (const id of this.laborers) await db.runAsync('DELETE FROM laborers WHERE id = ?', id);
    for (const id of this.investors) await db.runAsync('DELETE FROM investors WHERE id = ?', id);
  }
}

/* -------------------------------------------------------------------------- */
/*  T-ACC  accounts & cash flow                                              */
/* -------------------------------------------------------------------------- */

async function testAccountBalances(): Promise<TestResult> {
  const c = new Cleanup();
  try {
    const hbl = await addAccount({ name: 'DBTEST HBL', type: 'BANK', openingBalance: 100_000 });
    const cash = await addAccount({ name: 'DBTEST Cash', type: 'CASH', openingBalance: 0 });
    c.accounts.push(hbl.id, cash.id);

    const checks: Check[] = [];
    checks.push(['opening balance 100000', near(await getAccountBalance(hbl.id), 100_000)]);

    // Expense OUT 5000
    const exp = await addTransaction({ direction: 'OUT', amount: 5000, date: D, accountId: hbl.id });
    checks.push(['expense → 95000', near(await getAccountBalance(hbl.id), 95_000)]);

    // Income IN 20000
    await addTransaction({ direction: 'IN', amount: 20_000, date: D, accountId: hbl.id });
    checks.push(['income → 115000', near(await getAccountBalance(hbl.id), 115_000)]);

    // Transfer 10000 HBL → Cash: both move, total unchanged
    const totalBefore =
      (await getAccountBalance(hbl.id)) + (await getAccountBalance(cash.id));
    await transferBetween({ fromAccountId: hbl.id, toAccountId: cash.id, amount: 10_000, date: D });
    checks.push(['transfer: from 105000', near(await getAccountBalance(hbl.id), 105_000)]);
    checks.push(['transfer: to 10000', near(await getAccountBalance(cash.id), 10_000)]);
    const totalAfter = (await getAccountBalance(hbl.id)) + (await getAccountBalance(cash.id));
    checks.push(['transfer: total unchanged', near(totalBefore, totalAfter)]);

    // Isolation: an OUT on Cash doesn't touch HBL
    await addTransaction({ direction: 'OUT', amount: 500, date: D, accountId: cash.id });
    checks.push(['isolation: HBL still 105000', near(await getAccountBalance(hbl.id), 105_000)]);

    // Void restores balance
    await voidTransaction(exp.id);
    checks.push(['void restores → 110000', near(await getAccountBalance(hbl.id), 110_000)]);
    const original = await getTransaction(exp.id);
    checks.push(['void flags original', original?.is_void === 1]);

    return report('T-ACC accounts & transfers', checks);
  } finally {
    await c.run();
  }
}

/* -------------------------------------------------------------------------- */
/*  T-PLOT  the owner's exact example                                        */
/* -------------------------------------------------------------------------- */

async function testPlotMath(): Promise<TestResult> {
  const c = new Cleanup();
  try {
    const acc = await addAccount({ name: 'DBTEST P-Acc', type: 'CASH', openingBalance: 5000 });
    c.accounts.push(acc.id);
    const plot = await createPlot({ name: 'DBTEST Plot', dealPrice: 1000, sellerName: 'Saleem' });
    c.plots.push(plot.id);

    const checks: Check[] = [];
    let s = await getPlotSummary(plot.id);
    checks.push(['deal 1000 / paid 0 / remaining 1000', near(s.dealPrice, 1000) && near(s.paidToSeller, 0) && near(s.remaining, 1000)]);

    await addPlotPayment({ plotId: plot.id, payType: 'TOKEN', amount: 50, date: D, accountId: acc.id });
    s = await getPlotSummary(plot.id);
    checks.push(['token 50 → paid 50 / remaining 950', near(s.paidToSeller, 50) && near(s.remaining, 950)]);

    await addPlotPayment({ plotId: plot.id, payType: 'BAYANA', amount: 200, date: D, accountId: acc.id });
    s = await getPlotSummary(plot.id);
    checks.push(['bayana 200 → paid 250 / remaining 750', near(s.paidToSeller, 250) && near(s.remaining, 750)]);

    // Token / bayana are one-time — a second of either is blocked.
    checks.push([
      'second token blocked',
      await expectThrow(
        () => addPlotPayment({ plotId: plot.id, payType: 'TOKEN', amount: 10, date: D, accountId: acc.id }),
        'ONE_TIME_PAYMENT'
      ),
    ]);
    checks.push([
      'second bayana blocked',
      await expectThrow(
        () => addPlotPayment({ plotId: plot.id, payType: 'BAYANA', amount: 10, date: D, accountId: acc.id }),
        'ONE_TIME_PAYMENT'
      ),
    ]);

    // Expense before fully paid: tax 100 on top
    const db = await getDatabase();
    const taxCat = await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM categories WHERE name_en = 'Transfer Fees & Tax'"
    );
    await addPlotExpense({ plotId: plot.id, categoryId: taxCat!.id, amount: 100, date: D, accountId: acc.id });
    s = await getPlotSummary(plot.id);
    checks.push(['tax 100 → expenses 100 / total 350', near(s.expenses, 100) && near(s.totalCost, 350)]);
    checks.push(['remaining unaffected by expense', near(s.remaining, 750)]);

    await addPlotPayment({ plotId: plot.id, payType: 'FINAL', amount: 750, date: D, accountId: acc.id });
    s = await getPlotSummary(plot.id);
    checks.push(['final 750 → paid 1000 / remaining 0 / total 1100', near(s.paidToSeller, 1000) && near(s.remaining, 0) && near(s.totalCost, 1100)]);

    // Every rupee left the account: 5000 − 1100 = 3900
    checks.push(['account drained to 3900', near(await getAccountBalance(acc.id), 3900)]);

    return report('T-PLOT deal math (1000 → 1100)', checks);
  } finally {
    await c.run();
  }
}

/* -------------------------------------------------------------------------- */
/*  T-LAB  attendance accrual, payment, no double count                      */
/* -------------------------------------------------------------------------- */

async function testLaborAccrual(): Promise<TestResult> {
  const c = new Cleanup();
  try {
    const acc = await addAccount({ name: 'DBTEST L-Acc', type: 'CASH', openingBalance: 10_000 });
    c.accounts.push(acc.id);
    const project = await createProject({ name: 'DBTEST Labor' });
    c.projects.push(project.id);
    const worker = await addLaborer({ name: 'DBTEST Mazdoor' });
    c.laborers.push(worker.id);

    const pl = await attachLaborerToProject({ projectId: project.id, laborerId: worker.id, dailyWage: 1000 });

    const checks: Check[] = [];

    // A paid day with no dihari rate set is blocked (V-15).
    const noWage = await addLaborer({ name: 'DBTEST NoWage' });
    c.laborers.push(noWage.id);
    const plNoWage = await attachLaborerToProject({ projectId: project.id, laborerId: noWage.id, dailyWage: 0 });
    checks.push([
      'FULL day without wage blocked',
      await expectThrow(
        () => markAttendance({ projectLaborerId: plNoWage.id, date: '2026-06-01', status: 'FULL' }),
        'WAGE_NOT_SET'
      ),
    ]);

    await markAttendance({ projectLaborerId: pl.id, date: '2026-06-01', status: 'FULL' });
    await markAttendance({ projectLaborerId: pl.id, date: '2026-06-02', status: 'FULL' });
    await markAttendance({ projectLaborerId: pl.id, date: '2026-06-03', status: 'HALF' });
    await markAttendance({ projectLaborerId: pl.id, date: '2026-06-04', status: 'ABSENT' });

    let bal = await getLaborBalance(pl.id);
    checks.push(['2×full + half + absent = 2500', near(bal.accrued, 2500)]);
    checks.push(['day counts 2/1/1', bal.daysFull === 2 && bal.daysHalf === 1 && bal.daysAbsent === 1]);

    // Upsert same day: FULL → HALF replaces, no duplicate
    await markAttendance({ projectLaborerId: pl.id, date: '2026-06-02', status: 'HALF' });
    bal = await getLaborBalance(pl.id);
    checks.push(['re-mark 06-02 half → accrued 2000', near(bal.accrued, 2000)]);
    await markAttendance({ projectLaborerId: pl.id, date: '2026-06-02', status: 'FULL' }); // restore
    bal = await getLaborBalance(pl.id);
    checks.push(['restore → 2500', near(bal.accrued, 2500)]);

    // Construction expenses: cement 50, bajri 10
    const db = await getDatabase();
    const cat = async (n: string) =>
      (await db.getFirstAsync<{ id: string }>('SELECT id FROM categories WHERE name_en = ?', n))!.id;
    await addTransaction({ direction: 'OUT', amount: 50, date: D, accountId: acc.id, projectId: project.id, phase: 'CONSTRUCTION', categoryId: await cat('Cement') });
    await addTransaction({ direction: 'OUT', amount: 10, date: D, accountId: acc.id, projectId: project.id, phase: 'CONSTRUCTION', categoryId: await cat('Sand/Crush') });

    let constr = await getConstructionSummary(project.id, '2026-06');
    checks.push(['construction = 60 cash + 2500 accrued = 2560', near(constr.total, 2560)]);
    checks.push(['top category is Cement 50', constr.byCategory[0]?.nameEn === 'Cement' && near(constr.byCategory[0]?.total ?? 0, 50)]);

    // Pay the worker 1000  balance drops, account drops, construction total UNCHANGED
    await payLaborer({ projectLaborerId: pl.id, amount: 1000, date: D, accountId: acc.id });
    bal = await getLaborBalance(pl.id);
    constr = await getConstructionSummary(project.id, '2026-06');
    checks.push(['paid 1000 → balance 1500', near(bal.paid, 1000) && near(bal.balance, 1500)]);
    checks.push(['no double count: total still 2560', near(constr.total, 2560)]);
    checks.push(['labor outstanding 1500', near(constr.laborOutstanding, 1500)]);
    checks.push(['account: 10000−60−1000 = 8940', near(await getAccountBalance(acc.id), 8940)]);

    return report('T-LAB attendance & wages', checks);
  } finally {
    await c.run();
  }
}

/* -------------------------------------------------------------------------- */
/*  T-SALE + T-PROJ  sale flow and total project cost                        */
/* -------------------------------------------------------------------------- */

async function testSaleAndProjectCost(): Promise<TestResult> {
  const c = new Cleanup();
  try {
    const acc = await addAccount({ name: 'DBTEST S-Acc', type: 'BANK', openingBalance: 2000 });
    c.accounts.push(acc.id);
    const plot = await createPlot({ name: 'DBTEST S-Plot', dealPrice: 1000 });
    c.plots.push(plot.id);

    // Plot fully bought + tax before the project exists
    await addPlotPayment({ plotId: plot.id, payType: 'FINAL', amount: 1000, date: D, accountId: acc.id });
    const db = await getDatabase();
    const taxCat = (await db.getFirstAsync<{ id: string }>("SELECT id FROM categories WHERE name_en = 'Transfer Fees & Tax'"))!.id;
    await addPlotExpense({ plotId: plot.id, categoryId: taxCat, amount: 100, date: D, accountId: acc.id });

    // Project includes the plot → history backfills
    const project = await createProject({ name: 'DBTEST S-Proj', plotId: plot.id });
    c.projects.push(project.id);

    const checks: Check[] = [];
    const backfilled = await db.getFirstAsync<{ c: number }>(
      'SELECT COUNT(*) AS c FROM transactions WHERE plot_id = ? AND project_id = ?',
      plot.id,
      project.id
    );
    checks.push(['include-plot backfilled 2 txns', (backfilled?.c ?? 0) === 2]);
    const linked = await db.getFirstAsync<{ plot_id: string | null }>('SELECT plot_id FROM projects WHERE id = ?', project.id);
    checks.push(['project ↔ plot linked', linked?.plot_id === plot.id]);

    // Construction: cement 60 (no labor here)
    const cementCat = (await db.getFirstAsync<{ id: string }>("SELECT id FROM categories WHERE name_en = 'Cement'"))!.id;
    await addTransaction({ direction: 'OUT', amount: 60, date: D, accountId: acc.id, projectId: project.id, phase: 'CONSTRUCTION', categoryId: cementCat });

    // Sale: deal 3000, token 500, bayana 2500, cost 200
    const sale = await upsertSale(project.id, { agreedPrice: 3000, buyerName: 'Mr Tariq' });
    let ss = await getSaleSummary(project.id);
    checks.push(['sale 3000 / outstanding 3000', near(ss.outstanding, 3000)]);

    await addSaleReceipt({ saleId: sale.id, amount: 500, date: D, accountId: acc.id, payType: 'TOKEN' });
    ss = await getSaleSummary(project.id);
    checks.push(['token 500 → outstanding 2500', near(ss.receiptsTotal, 500) && near(ss.outstanding, 2500)]);

    await addSaleReceipt({ saleId: sale.id, amount: 2500, date: D, accountId: acc.id, payType: 'FINAL' });
    ss = await getSaleSummary(project.id);
    checks.push(['fully received → outstanding 0', near(ss.outstanding, 0)]);

    await addSaleCost({ projectId: project.id, name: 'Dealer commission', amount: 200, date: D, accountId: acc.id });
    ss = await getSaleSummary(project.id);
    checks.push(['sale costs 200', near(ss.costs, 200)]);
    checks.push(['receipts unaffected by cost', near(ss.receiptsTotal, 3000)]);

    // Project total cost: plot 1100 + construction 60 + sale 200 = 1360
    const cost = await getProjectCost(project.id);
    checks.push(['plot cost 1100', near(cost.plotCost, 1100)]);
    checks.push(['construction 60', near(cost.constructionCost, 60)]);
    checks.push(['sale cost 200', near(cost.saleCost, 200)]);
    checks.push(['total 1360', near(cost.totalCost, 1360)]);

    // Account: 2000 −1000 −100 −60 +500 +2500 −200 = 3640
    checks.push(['account nets to 3640', near(await getAccountBalance(acc.id), 3640)]);

    return report('T-SALE/T-PROJ sale & total cost', checks);
  } finally {
    await c.run();
  }
}

/* -------------------------------------------------------------------------- */
/*  T-SET  settlement, donation, loss incl. owner                            */
/* -------------------------------------------------------------------------- */

async function testSettlementProfitWithDonation(): Promise<TestResult> {
  const c = new Cleanup();
  try {
    // Opening balance = the owner's own money (the residual financier).
    const acc = await addAccount({ name: 'DBTEST Set-Acc', type: 'BANK', openingBalance: 1000 });
    c.accounts.push(acc.id);
    // A linked plot (no payments, so the PnL is untouched) — settlement must
    // flip it to SOLD so it can never be offered to a future project.
    const plot = await createPlot({ name: 'DBTEST Set-Plot', dealPrice: 0 });
    c.plots.push(plot.id);
    // donation 10% via per-project override (doesn't touch user settings)
    const project = await createProject({ name: 'DBTEST Set', donationPct: 10, plotId: plot.id });
    c.projects.push(project.id);

    const amir = await addInvestor({ name: 'DBTEST Amir' });
    const aman = await addInvestor({ name: 'DBTEST Amanullah' });
    c.investors.push(amir.id, aman.id);
    await addProjectInvestor({ projectId: project.id, investorId: amir.id, committedAmount: 200, profitPct: 20 });
    await addProjectInvestor({ projectId: project.id, investorId: aman.id, committedAmount: 300, profitPct: 30 });
    await addInvestment({ investorId: amir.id, projectId: project.id, amount: 200, date: D, accountId: acc.id });
    await addInvestment({ investorId: aman.id, projectId: project.id, amount: 300, date: D, accountId: acc.id });

    // Expenses 1000, revenue 1500 → net +500
    const db = await getDatabase();
    const miscCat = (await db.getFirstAsync<{ id: string }>("SELECT id FROM categories WHERE name_en = 'Misc'"))!.id;
    await addTransaction({ direction: 'OUT', amount: 1000, date: D, accountId: acc.id, projectId: project.id, phase: 'GENERAL', categoryId: miscCat });
    const sale = await upsertSale(project.id, { agreedPrice: 1500 });
    await addSaleReceipt({ saleId: sale.id, amount: 1500, date: D, accountId: acc.id });

    const s = await computeSettlement(project.id);
    const rAmir = s.rows.find((r) => r.name === 'DBTEST Amir');
    const rAman = s.rows.find((r) => r.name === 'DBTEST Amanullah');

    const checks: Check[] = [
      ['net +500', near(s.net, 500) && s.isProfit],
      ['Amir profit 100 (20%)', near(rAmir?.profitOrLoss ?? 0, 100)],
      ['Amanullah profit 150 (30%)', near(rAman?.profitOrLoss ?? 0, 150)],
      ['owner residual 250', near(s.owner.profitOrLoss, 250)],
      ['owner capital 500 (1000−500)', near(s.owner.capital, 500)],
      ['donations 10/15/25', near(rAmir?.donation ?? 0, 10) && near(rAman?.donation ?? 0, 15) && near(s.owner.donation, 25)],
      ['total donation 50', near(s.totalDonation, 50)],
      ['payouts 290 / 435', near(rAmir?.finalPayout ?? 0, 290) && near(rAman?.finalPayout ?? 0, 435)],
    ];

    // Commit and verify ledger writes
    await settleProject(project.id);
    const donationRows = await db.getFirstAsync<{ c: number; s: number }>(
      `SELECT COUNT(*) AS c, COALESCE(SUM(amount), 0) AS s FROM capital_ledger
       WHERE entry_type = 'DONATION' AND project_investor_id IN
         (SELECT id FROM project_investors WHERE project_id = ?)`,
      project.id
    );
    checks.push(['DONATION entries written (25)', (donationRows?.c ?? 0) === 2 && near(donationRows?.s ?? 0, 25)]);
    const proj = await db.getFirstAsync<{ status: string }>('SELECT status FROM projects WHERE id = ?', project.id);
    checks.push(['project COMPLETED', proj?.status === 'COMPLETED']);
    const plotRow = await db.getFirstAsync<{ status: string }>('SELECT status FROM plots WHERE id = ?', plot.id);
    checks.push(['plot SOLD on settlement', plotRow?.status === 'SOLD']);

    return report('T-SET profit + donation', checks);
  } finally {
    await c.run();
  }
}

async function testSettlementLossIncludesOwner(): Promise<TestResult> {
  const c = new Cleanup();
  try {
    // Opening balance = the owner's own money (the residual financier).
    const acc = await addAccount({ name: 'DBTEST Loss-Acc', type: 'BANK', openingBalance: 1000 });
    c.accounts.push(acc.id);
    const project = await createProject({ name: 'DBTEST Loss', donationPct: 10 });
    c.projects.push(project.id);

    const amir = await addInvestor({ name: 'DBTEST L-Amir' });
    const aman = await addInvestor({ name: 'DBTEST L-Aman' });
    c.investors.push(amir.id, aman.id);
    await addProjectInvestor({ projectId: project.id, investorId: amir.id, committedAmount: 200, profitPct: 20 });
    await addProjectInvestor({ projectId: project.id, investorId: aman.id, committedAmount: 300, profitPct: 30 });
    await addInvestment({ investorId: amir.id, projectId: project.id, amount: 200, date: D, accountId: acc.id });
    await addInvestment({ investorId: aman.id, projectId: project.id, amount: 300, date: D, accountId: acc.id });

    // Expenses 1000, revenue 800 → net −200. Capital: 500 investors + 500 owner.
    const db = await getDatabase();
    const miscCat = (await db.getFirstAsync<{ id: string }>("SELECT id FROM categories WHERE name_en = 'Misc'"))!.id;
    await addTransaction({ direction: 'OUT', amount: 1000, date: D, accountId: acc.id, projectId: project.id, phase: 'GENERAL', categoryId: miscCat });
    const sale = await upsertSale(project.id, { agreedPrice: 800 });
    await addSaleReceipt({ saleId: sale.id, amount: 800, date: D, accountId: acc.id });

    const s = await getProjectSettlementSummary(project.id);
    const rAmir = s.investors.find((r) => r.name === 'DBTEST L-Amir');
    const rAman = s.investors.find((r) => r.name === 'DBTEST L-Aman');

    const checks: Check[] = [
      ['net −200', near(s.net, -200) && !s.isProfit],
      ['owner invested 500', near(s.owner.invested, 500)],
      ['Amir loss −40 (200/1000)', near(rAmir?.profitOrLoss ?? 0, -40)],
      ['Amanullah loss −60 (300/1000)', near(rAman?.profitOrLoss ?? 0, -60)],
      ['owner loss −100 (NOT 0)', near(s.owner.profitOrLoss, -100)],
      ['losses sum to −200', near((rAmir?.profitOrLoss ?? 0) + (rAman?.profitOrLoss ?? 0) + s.owner.profitOrLoss, -200)],
      ['no donation on loss', near(s.totalDonation, 0)],
      ['payouts 160 / 240', near(rAmir?.finalPayout ?? 0, 160) && near(rAman?.finalPayout ?? 0, 240)],
    ];

    return report('T-SET loss by capital ratio (incl. owner)', checks);
  } finally {
    await c.run();
  }
}

/* -------------------------------------------------------------------------- */
/*  T-UDH  udhaar give / return / clear / void                               */
/* -------------------------------------------------------------------------- */

async function testUdhaarFlow(): Promise<TestResult> {
  const c = new Cleanup();
  try {
    const acc = await addAccount({ name: 'DBTEST U-Acc', type: 'CASH', openingBalance: 500 });
    c.accounts.push(acc.id);
    const u = await createUdhaar({ personName: 'DBTEST Bilal' }); // GIVEN, free-text person
    c.udhaar.push(u.id);

    const checks: Check[] = [];
    checks.push(['free-text person, no party', u.party_id === null && u.person_name === 'DBTEST Bilal']);

    await giveUdhaar({ udhaarId: u.id, amount: 100, date: D, accountId: acc.id });
    checks.push(['give 100 → account 400', near(await getAccountBalance(acc.id), 400)]);
    checks.push(['receivable 100', near(await getUdhaarBalance(u.id), 100)]);

    await returnUdhaar({ udhaarId: u.id, amount: 60, date: D, accountId: acc.id });
    checks.push(['return 60 → account 460', near(await getAccountBalance(acc.id), 460)]);
    checks.push(['receivable 40', near(await getUdhaarBalance(u.id), 40)]);
    checks.push(['still OPEN', (await getUdhaar(u.id))?.status === 'OPEN']);

    await returnUdhaar({ udhaarId: u.id, amount: 40, date: D, accountId: acc.id });
    checks.push(['cleared → balance 0', near(await getUdhaarBalance(u.id), 0)]);
    checks.push(['status CLEARED', (await getUdhaar(u.id))?.status === 'CLEARED']);

    return report('T-UDH give / return / clear', checks);
  } finally {
    await c.run();
  }
}

/* -------------------------------------------------------------------------- */
/*  T-INV  commitment is a promise; only cash given moves; auto-raise        */
/* -------------------------------------------------------------------------- */

async function testInvestorPayments(): Promise<TestResult> {
  const c = new Cleanup();
  try {
    const acc = await addAccount({ name: 'DBTEST IP-Acc', type: 'CASH', openingBalance: 0 });
    c.accounts.push(acc.id);
    // Investor pledges 4000 (their "deal"), pays nothing yet.
    const inv = await addInvestor({ name: 'DBTEST IP-Amir', committedAmount: 4000 });
    c.investors.push(inv.id);

    const checks: Check[] = [];
    let s = await getInvestorSummary(inv.id);
    checks.push(['committed 4000 / received 0 / remaining 4000', near(s.committed, 4000) && near(s.received, 0) && near(s.remaining, 4000)]);

    // Receives 2000 now → account rises, remaining 2000 (like a plot payment).
    await addInvestorPayment({ investorId: inv.id, amount: 2000, date: D, accountId: acc.id });
    s = await getInvestorSummary(inv.id);
    checks.push(['received 2000 / remaining 2000', near(s.received, 2000) && near(s.remaining, 2000)]);
    checks.push(['account holds the 2000', near(await getAccountBalance(acc.id), 2000)]);

    // The rest on a later date → fully received.
    await addInvestorPayment({ investorId: inv.id, amount: 2000, date: D, accountId: acc.id });
    s = await getInvestorSummary(inv.id);
    checks.push(['received 4000 / remaining 0', near(s.received, 4000) && near(s.remaining, 0)]);

    // Can't receive beyond the pledge.
    checks.push([
      'over-pledge payment blocked',
      await expectThrow(
        () => addInvestorPayment({ investorId: inv.id, amount: 100, date: D, accountId: acc.id }),
        'LIMIT_EXCEEDED'
      ),
    ]);

    return report('T-IPAY investor received vs committed', checks);
  } finally {
    await c.run();
  }
}

async function testAttachInvestors(): Promise<TestResult> {
  const c = new Cleanup();
  try {
    const project = await createProject({ name: 'DBTEST AT-Proj' });
    c.projects.push(project.id);
    // Pledges are required now: a stake must fit committed − staked (T-CAP).
    const a = await addInvestor({ name: 'DBTEST AT-A', committedAmount: 3000 });
    const b = await addInvestor({ name: 'DBTEST AT-B', committedAmount: 1000 });
    c.investors.push(a.id, b.id);

    // One atomic call: participation + INITIAL capital per investor.
    await attachInvestorsToProject(
      project.id,
      [
        { investorId: a.id, amount: 3000, profitPct: 40 },
        { investorId: b.id, amount: 1000, profitPct: 40 },
      ],
      { date: D }
    );

    const summary = await getProjectCapitalSummary(project.id);
    const shareA = summary.shares.find((s) => s.investorId === a.id);
    const shareB = summary.shares.find((s) => s.investorId === b.id);
    const checks: Check[] = [
      ['both participations created', summary.shares.length === 2],
      ['total capital 4000', near(summary.totalCapital, 4000)],
      ['A capital 3000 → 75%', near(shareA?.capital ?? 0, 3000) && near(shareA?.ownershipPct ?? 0, 75)],
      ['B capital 1000 → 25%', near(shareB?.capital ?? 0, 1000) && near(shareB?.ownershipPct ?? 0, 25)],
    ];
    return report('T-ATTACH investors attach atomically', checks);
  } finally {
    await c.run();
  }
}

async function testInvestorCapacity(): Promise<TestResult> {
  const c = new Cleanup();
  try {
    const pA = await createProject({ name: 'DBTEST Cap-A' });
    const pB = await createProject({ name: 'DBTEST Cap-B' });
    c.projects.push(pA.id, pB.id);
    const inv = await addInvestor({ name: 'DBTEST Cap-Inv', committedAmount: 5000 });
    c.investors.push(inv.id);

    const checks: Check[] = [];
    const capOf = async () =>
      (await listInvestorsWithCapacity()).find((i) => i.id === inv.id);

    // Pledge 5000, stake 3000 in A → 2000 left for everything else.
    await attachInvestorsToProject(pA.id, [{ investorId: inv.id, amount: 3000 }], { date: D });
    let cap = await capOf();
    checks.push(['staked 3000 / remaining 2000', near(cap?.staked ?? 0, 3000) && near(cap?.remaining ?? 0, 2000)]);

    // More than remaining is blocked; exactly remaining is fine.
    checks.push([
      'stake beyond remaining blocked',
      await expectThrow(
        () => attachInvestorsToProject(pB.id, [{ investorId: inv.id, amount: 2500 }], { date: D }),
        'LIMIT_EXCEEDED'
      ),
    ]);
    await attachInvestorsToProject(pB.id, [{ investorId: inv.id, amount: 2000 }], { date: D });
    cap = await capOf();
    checks.push(['fully staked → remaining 0', near(cap?.remaining ?? 0, 0)]);

    // Stale re-attach: silently skipped, never a duplicate row or an error.
    await attachInvestorsToProject(pA.id, [{ investorId: inv.id, amount: 1000 }], { date: D });
    const db = await getDatabase();
    const rows = await db.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM project_investors WHERE project_id = ? AND investor_id = ? AND status = 'ACTIVE'",
      pA.id,
      inv.id
    );
    checks.push(['re-attach skipped (1 participation)', (rows?.n ?? 0) === 1]);
    cap = await capOf();
    checks.push(['re-attach added no capital', near(cap?.staked ?? 0, 5000)]);

    return report('T-CAP investor capacity across projects', checks);
  } finally {
    await c.run();
  }
}

async function testLaborDayConflictAndOverpay(): Promise<TestResult> {
  const c = new Cleanup();
  try {
    const acc = await addAccount({ name: 'DBTEST Lab2-Acc', type: 'CASH', openingBalance: 5000 });
    c.accounts.push(acc.id);
    const pA = await createProject({ name: 'DBTEST Lab2-A' });
    const pB = await createProject({ name: 'DBTEST Lab2-B' });
    c.projects.push(pA.id, pB.id);
    const worker = await addLaborer({ name: 'DBTEST Lab2-W' });
    c.laborers.push(worker.id);

    const plA = await attachLaborerToProject({ projectId: pA.id, laborerId: worker.id, dailyWage: 1000 });
    const plB = await attachLaborerToProject({ projectId: pB.id, laborerId: worker.id, dailyWage: 800 });

    const checks: Check[] = [];
    // One dihari per day: FULL on A blocks earning on B the same date…
    await markAttendance({ projectLaborerId: plA.id, date: D, status: 'FULL' });
    checks.push([
      'second project same day blocked',
      await expectThrow(
        () => markAttendance({ projectLaborerId: plB.id, date: D, status: 'FULL' }),
        'ATTENDANCE_CONFLICT'
      ),
    ]);
    // …but ABSENT is a note, not an earning, and a different day is fine.
    await markAttendance({ projectLaborerId: plB.id, date: D, status: 'ABSENT' });
    await markAttendance({ projectLaborerId: plB.id, date: '2026-06-07', status: 'FULL' });
    const khata = await getLaborerKhata(worker.id);
    checks.push(['earned 1000 + 800 across projects', near(khata.totals.earned, 1800)]);

    // Pay only what is owed on that participation.
    checks.push([
      'overpay blocked',
      await expectThrow(
        () => payLaborer({ projectLaborerId: plA.id, amount: 1500, date: D, accountId: acc.id }),
        'LIMIT_EXCEEDED'
      ),
    ]);
    await payLaborer({ projectLaborerId: plA.id, amount: 600, date: D, accountId: acc.id });
    const bal = await getLaborBalance(plA.id);
    checks.push(['paid 600 → owed 400', near(bal.balance, 400)]);

    return report('T-LAB2 one dihari/day + overpay guard', checks);
  } finally {
    await c.run();
  }
}

async function testProjectCompletionGuards(): Promise<TestResult> {
  const c = new Cleanup();
  try {
    const p = await createProject({ name: 'DBTEST Done' });
    c.projects.push(p.id);
    const inv = await addInvestor({ name: 'DBTEST Done-Inv', committedAmount: 1000 });
    c.investors.push(inv.id);

    await markProjectCompleted(p.id);
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ status: string }>('SELECT status FROM projects WHERE id = ?', p.id);

    const checks: Check[] = [
      ['manual completion sets COMPLETED', row?.status === 'COMPLETED'],
      [
        'attach investor on closed project blocked',
        await expectThrow(
          () => attachInvestorsToProject(p.id, [{ investorId: inv.id, amount: 500 }], { date: D }),
          'PROJECT_CLOSED'
        ),
      ],
      [
        'settling a closed project blocked',
        await expectThrow(() => settleProject(p.id), 'PROJECT_CLOSED'),
      ],
    ];
    return report('T-DONE completed project is read-only', checks);
  } finally {
    await c.run();
  }
}

async function testInvestorCommitmentVsCash(): Promise<TestResult> {
  const c = new Cleanup();
  try {
    const acc = await addAccount({ name: 'DBTEST I-Acc', type: 'BANK', openingBalance: 0 });
    c.accounts.push(acc.id);
    const project = await createProject({ name: 'DBTEST I-Proj' });
    c.projects.push(project.id);
    const inv = await addInvestor({ name: 'DBTEST I-Amir' });
    c.investors.push(inv.id);

    const db = await getDatabase();
    const pi = await addProjectInvestor({
      projectId: project.id,
      investorId: inv.id,
      committedAmount: 50_000, // the PROMISE  no money moves
      profitPct: 20,
    });

    const checks: Check[] = [];
    checks.push(['commitment alone moves no cash', near(await getAccountBalance(acc.id), 0)]);

    // They hand over only 5,000 now  ONLY that hits the account.
    await addInvestment({ investorId: inv.id, projectId: project.id, amount: 5000, date: D, accountId: acc.id });
    checks.push(['given 5000 → account 5000 (not 50000)', near(await getAccountBalance(acc.id), 5000)]);
    let row = await db.getFirstAsync<{ committed_amount: number }>(
      'SELECT committed_amount FROM project_investors WHERE id = ?',
      pi.id
    );
    checks.push(['commitment still 50000', near(row?.committed_amount ?? 0, 50_000)]);

    // More instalments accumulate.
    await addInvestment({ investorId: inv.id, projectId: project.id, amount: 40_000, date: D, accountId: acc.id });
    checks.push(['given 45000 total → account 45000', near(await getAccountBalance(acc.id), 45_000)]);

    // Giving beyond the commitment auto-raises it (45k + 15k = 60k > 50k).
    await addInvestment({ investorId: inv.id, projectId: project.id, amount: 15_000, date: D, accountId: acc.id });
    row = await db.getFirstAsync<{ committed_amount: number }>(
      'SELECT committed_amount FROM project_investors WHERE id = ?',
      pi.id
    );
    checks.push(['over-give auto-raises commitment to 60000', near(row?.committed_amount ?? 0, 60_000)]);
    checks.push(['account holds all 60000', near(await getAccountBalance(acc.id), 60_000)]);

    return report('T-INV commitment vs cash given', checks);
  } finally {
    await c.run();
  }
}

/* -------------------------------------------------------------------------- */
/*  T-VAL  validation guards must BLOCK bad money movements                  */
/* -------------------------------------------------------------------------- */

async function expectThrow(fn: () => Promise<unknown>, marker: string): Promise<boolean> {
  try {
    await fn();
    return false; // should have thrown
  } catch (e) {
    return e instanceof Error && e.message === marker;
  }
}

async function testValidationGuards(): Promise<TestResult> {
  const c = new Cleanup();
  try {
    const acc = await addAccount({ name: 'DBTEST V-Acc', type: 'CASH', openingBalance: 100 });
    c.accounts.push(acc.id);
    const checks: Check[] = [];

    // Overdraft blocked: OUT 500 from an account holding 100.
    checks.push([
      'overdraft blocked',
      await expectThrow(
        () => addTransaction({ direction: 'OUT', amount: 500, date: D, accountId: acc.id }),
        'INSUFFICIENT_FUNDS'
      ),
    ]);
    checks.push(['balance untouched after block', near(await getAccountBalance(acc.id), 100)]);

    // Zero-balance account blocked outright.
    const empty = await addAccount({ name: 'DBTEST V-Empty', type: 'CASH', openingBalance: 0 });
    c.accounts.push(empty.id);
    checks.push([
      'zero-balance blocked',
      await expectThrow(
        () => addTransaction({ direction: 'OUT', amount: 1, date: D, accountId: empty.id }),
        'INSUFFICIENT_FUNDS'
      ),
    ]);

    // Transfer more than the source holds is blocked (and nothing moves).
    checks.push([
      'over-transfer blocked',
      await expectThrow(
        () => transferBetween({ fromAccountId: acc.id, toAccountId: empty.id, amount: 500, date: D }),
        'INSUFFICIENT_FUNDS'
      ),
    ]);
    checks.push(['transfer target unchanged', near(await getAccountBalance(empty.id), 0)]);

    // Seller can't be paid more than the deal remaining.
    const plot = await createPlot({ name: 'DBTEST V-Plot', dealPrice: 80 });
    c.plots.push(plot.id);
    checks.push([
      'plot overpay blocked (100 > deal 80)',
      await expectThrow(
        () => addPlotPayment({ plotId: plot.id, payType: 'TOKEN', amount: 100, date: D, accountId: acc.id }),
        'LIMIT_EXCEEDED'
      ),
    ]);
    await addPlotPayment({ plotId: plot.id, payType: 'TOKEN', amount: 80, date: D, accountId: acc.id });
    checks.push([
      'fully-paid plot blocks any further payment',
      await expectThrow(
        () => addPlotPayment({ plotId: plot.id, payType: 'FINAL', amount: 1, date: D, accountId: acc.id }),
        'LIMIT_EXCEEDED'
      ),
    ]);

    // Buyer can't pay more than outstanding.
    const project = await createProject({ name: 'DBTEST V-Proj' });
    c.projects.push(project.id);
    const sale = await upsertSale(project.id, { agreedPrice: 50 });
    checks.push([
      'sale over-receipt blocked (60 > 50)',
      await expectThrow(
        () => addSaleReceipt({ saleId: sale.id, amount: 60, date: D, accountId: acc.id }),
        'LIMIT_EXCEEDED'
      ),
    ]);

    // Udhaar: more can't come back than is outstanding.
    const u = await createUdhaar({ personName: 'DBTEST V-Person' });
    c.udhaar.push(u.id);
    await giveUdhaar({ udhaarId: u.id, amount: 10, date: D, accountId: acc.id });
    checks.push([
      'udhaar over-return blocked (25 > 10)',
      await expectThrow(
        () => returnUdhaar({ udhaarId: u.id, amount: 25, date: D, accountId: acc.id }),
        'LIMIT_EXCEEDED'
      ),
    ]);

    // Duplicate account names blocked (case-insensitive).
    checks.push([
      'duplicate account name blocked',
      await expectThrow(
        () => addAccount({ name: 'dbtest v-acc', type: 'BANK' }),
        'DUPLICATE_ACCOUNT'
      ),
    ]);

    return report('T-VAL guards block bad movements', checks);
  } finally {
    await c.run();
  }
}

/* -------------------------------------------------------------------------- */
/*  T-COM  switching companies isolates ALL data                             */
/* -------------------------------------------------------------------------- */

async function testCompanyIsolation(): Promise<TestResult> {
  const db = await getDatabase();
  const original = getActiveCompanyId();
  const checks: Check[] = [];
  let coA: string | null = null;
  let coB: string | null = null;
  try {
    // Company A with its own account + plot + udhaar.
    const a = await createCompany({ name: 'DBTEST CoA', openingCash: 9000 });
    coA = a.id;
    const plotA = await createPlot({ name: 'DBTEST A-Plot', dealPrice: 100 });
    const uA = await createUdhaar({ personName: 'DBTEST A-Person' });
    checks.push(['A: seeded Cash account visible', (await listAccountsWithBalance()).length === 1]);
    checks.push(['A: opening cash 9000', near(await getTotalBalance(), 9000)]);

    // Company B  a fresh world.
    const b = await createCompany({ name: 'DBTEST CoB', openingCash: 100 });
    coB = b.id;
    checks.push(['B: sees only its own account', (await listAccountsWithBalance()).length === 1]);
    checks.push(['B: total is ITS opening 100', near(await getTotalBalance(), 100)]);
    checks.push(['B: no plots from A', (await listPlots()).length === 0]);
    checks.push(['B: no udhaar from A', (await listUdhaar()).length === 0]);
    checks.push(['B: assets independent', near((await getCompanyAssets()).total, 100)]);

    // Switch back to A  everything is exactly as left.
    await setActiveCompany(a.id);
    checks.push(['back to A: plot visible again', (await listPlots()).some((p) => p.id === plotA.id)]);
    checks.push(['back to A: udhaar visible again', (await listUdhaar()).some((u) => u.id === uA.id)]);
    checks.push(['back to A: total still 9000', near(await getTotalBalance(), 9000)]);

    return report('T-COM company isolation', checks);
  } finally {
    for (const cid of [coA, coB]) {
      if (!cid) continue;
      await db.runAsync('DELETE FROM transactions WHERE company_id = ?', cid);
      await db.runAsync('DELETE FROM udhaar WHERE company_id = ?', cid);
      await db.runAsync('DELETE FROM plots WHERE company_id = ?', cid);
      await db.runAsync('DELETE FROM accounts WHERE company_id = ?', cid);
      await db.runAsync('DELETE FROM companies WHERE id = ?', cid);
    }
    if (original) await setActiveCompany(original);
  }
}

/* -------------------------------------------------------------------------- */
/*  T-REG  reconciliation invariant                                          */
/* -------------------------------------------------------------------------- */

async function testReconciliation(): Promise<TestResult> {
  // Total balance always equals the sum of per-account balances, and each
  // account's balance equals opening + signed sum of its live transactions.
  const accounts = await listAccountsWithBalance();
  const total = await getTotalBalance();
  const sum = accounts.reduce((s, a) => s + a.balance, 0);

  const db = await getDatabase();
  const checks: Check[] = [
    // Guard against a degenerate pass: with zero accounts the loop below adds
    // no checks and 0 === 0 would "pass" without reconciling anything.
    ['at least one account exists', accounts.length > 0],
    ['total = Σ account balances', near(total, sum)],
  ];
  for (const a of accounts) {
    const row = await db.getFirstAsync<{ s: number }>(
      `SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0) AS s
       FROM transactions WHERE account_id = ? AND is_void = 0`,
      a.id
    );
    checks.push([`${a.name} reconciles`, near(a.balance, a.opening_balance + (row?.s ?? 0))]);
  }
  return report('T-REG reconciliation', checks);
}

/* -------------------------------------------------------------------------- */

/** Run all DB self-tests in sequence and return their results. */
async function testCategoryManagement(): Promise<TestResult> {
  const checks: Check[] = [];
  const main = await addCategory({ nameEn: 'DBTEST CMain', nameUr: 'DBTEST CMain', type: 'EXPENSE' });
  const sub = await addCategory({
    nameEn: 'DBTEST CSub',
    nameUr: 'DBTEST CSub',
    type: 'EXPENSE',
    parentId: main.id,
    defaultUnit: 'bori',
  });

  const tree = await listCategoryTree('EXPENSE');
  const node = tree.find((n) => n.id === main.id);
  checks.push(['sub nested under main', !!node && node.children.some((ch) => ch.id === sub.id)]);
  checks.push(['default unit stored', sub.default_unit === 'bori']);
  checks.push([
    'delete main with child blocked',
    await expectThrow(() => deleteCategory(main.id), 'CATEGORY_IN_USE'),
  ]);

  await updateCategory(sub.id, { name: 'DBTEST CSub2' });
  checks.push(['sub renamed', (await getCategory(sub.id))?.name_en === 'DBTEST CSub2']);

  const plotPay = await getCategoryByNameEn('Plot Payment');
  checks.push([
    'system category delete locked',
    plotPay
      ? await expectThrow(() => deleteCategory(plotPay.id), 'deleteCategory: system category is locked')
      : true,
  ]);

  // Clean up (child first) — categories are global, so leave nothing behind.
  await deleteCategory(sub.id);
  await deleteCategory(main.id);
  checks.push([
    'cleaned up',
    (await getCategory(sub.id)) === null && (await getCategory(main.id)) === null,
  ]);

  return report('T-CAT category management', checks);
}

export async function runDbTests(): Promise<TestResult[]> {
  // Everything is company-scoped now  run the whole suite inside a throwaway
  // test company, then restore the user's active company and delete it.
  const previousCompanyId = getActiveCompanyId();
  const testCompany = await createCompany({ name: `DBTEST Co ${Date.now()}` });

  const tests = [
    testAccountBalances,
    testPlotMath,
    testLaborAccrual,
    testSaleAndProjectCost,
    testSettlementProfitWithDonation,
    testSettlementLossIncludesOwner,
    testUdhaarFlow,
    testInvestorPayments,
    testAttachInvestors,
    testInvestorCapacity,
    testLaborDayConflictAndOverpay,
    testProjectCompletionGuards,
    testInvestorCommitmentVsCash,
    testValidationGuards,
    testCategoryManagement,
    testCompanyIsolation,
    testReconciliation,
  ];
  const results: TestResult[] = [];
  try {
    for (const test of tests) {
      try {
        results.push(await test());
      } catch (e) {
        results.push({ name: test.name, passed: false, detail: `threw: ${String(e)}` });
      }
    }
  } finally {
    // Remove the test company (and its seeded Cash account), restore the user's.
    const db = await getDatabase();
    await db.runAsync('DELETE FROM transactions WHERE company_id = ?', testCompany.id);
    await db.runAsync('DELETE FROM accounts WHERE company_id = ?', testCompany.id);
    await db.runAsync('DELETE FROM companies WHERE id = ?', testCompany.id);
    if (previousCompanyId) await setActiveCompany(previousCompanyId);
  }
  return results;
}
