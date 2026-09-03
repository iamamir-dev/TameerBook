import { matchName, type AnswerTarget, type ResolvedDraft } from '@/ai';
import {
  addAccount,
  addDelivery,
  addInvestment,
  addInvestor,
  addInvestorPayment,
  addLaborer,
  addParty,
  addPlotExpense,
  addPlotPayment,
  addSaleCost,
  addSaleReceipt,
  addTransaction,
  attachLaborerToProject,
  createPlot,
  createProject,
  createPurchaseOrder,
  createUdhaar,
  getProjectSale,
  giveUdhaar,
  listCategories,
  listProjectLaborers,
  listPurchaseOrders,
  listUdhaar,
  markAllPresentForProject,
  markAttendance,
  markPlotTransferred,
  payBooking,
  payLaborer,
  returnUdhaar,
  transferBetween,
  upsertSale,
  type PurchaseOrderSummary,
} from '@/db';
import { t } from '@/i18n';
import { todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';

const money = formatRupees;

/**
 * Write a CONFIRMED draft to the ledger using the same repository functions
 * the forms use — every guard (no overdraft, no overpay, one paid day per
 * worker) still applies. Called only from the confirmation sheet.
 */

/** Choices the sheet collects when the draft did not name them. */
export interface DraftChoices {
  /** Typed in the sheet when the sentence had no amount. */
  amount?: number | null;
  /** Typed in the sheet when an add_* draft had no name. */
  name?: string | null;
  /** createWorker: daily wage typed in the sheet. */
  wage?: number | null;
  /** createProject: plot picked in the sheet. */
  plotId?: string | null;
  accountId?: string | null;
  projectId?: string | null;
  /** payWorker: which participation (project) the payment settles. */
  projectLaborerId?: string | null;
}

/** What the sheet must ask for before it can save. */
export interface DraftNeeds {
  amount: boolean;
  account: boolean;
  project: boolean;
  participation: boolean;
  /** add_* drafts without a name. */
  name: boolean;
  /** createProject: offer a plot when none was named. */
  plot: boolean;
  /** createWorker: offer a project + wage when none was named. */
  workerProject: boolean;
}

export function draftNeeds(r: ResolvedDraft): DraftNeeds {
  const d = r.draft;
  const none: DraftNeeds = { amount: false, account: false, project: false, participation: false, name: false, plot: false, workerProject: false };
  switch (d.kind) {
    case 'expense':
    case 'income':
      return { ...none, amount: !d.amount, account: !r.account };
    case 'material':
      return { ...none, amount: !(d.amount ?? (d.qty && d.rate)), account: !r.account, project: !r.project };
    case 'payWorker':
      return { ...none, amount: !d.amount, account: !r.account, participation: true };
    case 'udhaarGive':
    case 'udhaarReturn':
      return { ...none, amount: !d.amount, account: !r.account };
    case 'transfer':
      return { ...none, amount: !d.amount };
    case 'attendance':
      return { ...none, project: !r.project };
    case 'createProject':
      return { ...none, name: !d.name, plot: !r.plot };
    case 'createWorker':
      return { ...none, name: !d.name, workerProject: !r.project };
    case 'createParty':
    case 'createInvestor':
    case 'createAccount':
    case 'createPlot':
      return { ...none, name: !d.name };
    case 'createPurchaseOrder':
      return { ...none, project: !r.project };
    case 'payPurchaseOrder':
      return { ...none, amount: !d.amount, account: !r.account };
    case 'plotPayment':
    case 'plotExpense':
      return { ...none, amount: !d.amount, account: !r.account };
    case 'saleReceipt':
    case 'saleCost':
      return { ...none, amount: !d.amount, account: !r.account, project: !r.project };
    case 'investorPayment':
      return { ...none, amount: !d.amount, account: !r.account };
    case 'setSale':
      return { ...none, amount: !d.price, project: !r.project };
    default:
      return none;
  }
}

/** Find the purchase order the user meant by number ("PO-0015") or supplier name. */
async function findPo(q: string | undefined): Promise<PurchaseOrderSummary | null> {
  const pos = (await listPurchaseOrders()).filter((p) => p.status === 'OPEN');
  if (pos.length === 0) return null;
  if (!q) return pos.length === 1 ? pos[0] : null;
  const byNumber = pos.find((p) => p.poNumber.toLowerCase().replace(/\s+/g, '') === q.toLowerCase().replace(/\s+/g, ''));
  if (byNumber) return byNumber;
  const m = matchName(q, pos.map((p) => ({ id: p.poId, name: p.supplierName ?? p.poNumber, alt: [p.poNumber] })));
  return m ? pos.find((p) => p.poId === m.item.id) ?? null : null;
}

export interface Applied {
  message: string;
  target?: AnswerTarget;
}

const need = (v: string | null | undefined, what: string): string => {
  if (!v) throw new Error(`missing ${what}`);
  return v;
};
const needAmount = (v: number | null | undefined): number => {
  if (!v || v <= 0) throw new Error('missing amount');
  return v;
};

export async function applyDraft(r: ResolvedDraft, c: DraftChoices): Promise<Applied> {
  const d = r.draft;
  const today = todayISO().slice(0, 10);
  switch (d.kind) {
    case 'expense':
    case 'income': {
      const accountId = need(r.account?.id ?? c.accountId, 'account');
      const projectId = r.project?.id ?? null;
      const amount = needAmount(d.amount ?? c.amount);
      await addTransaction({
        direction: d.kind === 'expense' ? 'OUT' : 'IN',
        amount,
        date: d.date ?? today,
        accountId,
        projectId,
        phase: projectId ? 'CONSTRUCTION' : 'GENERAL',
        categoryId: r.category?.id ?? null,
        partyId: r.party?.id ?? null,
        counterpartyName: !r.party && d.party ? d.party : null,
        description: d.note ?? null,
      });
      return {
        message: `${t('aiSaved')} · ${formatRupees(amount)}`,
        target: projectId ? { screen: 'ProjectDetail', projectId } : { screen: 'Cash' },
      };
    }

    case 'material': {
      const accountId = need(r.account?.id ?? c.accountId, 'account');
      const projectId = need(r.project?.id ?? c.projectId, 'project');
      const amount = needAmount(d.amount ?? (d.qty && d.rate ? Math.round(d.qty * d.rate) : undefined) ?? c.amount);
      const desc = `${r.category?.name ?? d.item} ${d.qty ?? ''}${d.unit ? ` ${d.unit}` : ''}${d.rate ? ` @ ${d.rate}` : ''}`.trim();
      await addTransaction({
        direction: 'OUT',
        amount,
        date: d.date ?? today,
        accountId,
        projectId,
        phase: 'CONSTRUCTION',
        categoryId: r.category?.id ?? null,
        partyId: r.party?.id ?? null,
        counterpartyName: !r.party && d.party ? d.party : null,
        qty: d.qty && d.qty > 0 ? d.qty : null,
        description: desc,
      });
      return { message: `${t('aiSaved')} · ${formatRupees(amount)}`, target: { screen: 'ConstructionDetail', projectId } };
    }

    case 'payWorker': {
      if (!r.worker) throw new Error(t('aiNoWorkerFound'));
      const accountId = need(r.account?.id ?? c.accountId, 'account');
      const projectLaborerId = need(c.projectLaborerId, 'participation');
      const amount = needAmount(d.amount ?? c.amount);
      await payLaborer({ projectLaborerId, amount, date: d.date ?? today, accountId, note: d.note ?? null });
      return { message: `${t('aiSaved')} · ${formatRupees(amount)}`, target: { screen: 'LaborerDetail', laborerId: r.worker.id } };
    }

    case 'attendance': {
      const projectId = need(r.project?.id ?? c.projectId, 'project');
      const date = d.date ?? today;
      let n = 0;
      if (d.allPresent) n += await markAllPresentForProject(projectId, date);
      const pls = await listProjectLaborers(projectId);
      for (const m of r.marks) {
        if (!m.worker) continue;
        const pl = pls.find((p) => p.laborer.id === m.worker!.id);
        if (!pl) continue;
        await markAttendance({ projectLaborerId: pl.projectLaborer.id, date, status: m.mark.status });
        n++;
      }
      return { message: `${n} · ${t('aiAttendanceDone')}`, target: { screen: 'ProjectDetail', projectId } };
    }

    case 'udhaarGive':
    case 'udhaarReturn': {
      const accountId = need(r.account?.id ?? c.accountId, 'account');
      const open = (await listUdhaar('OPEN')).filter((u) => u.direction === 'GIVEN');
      const hit = matchName(d.person, open.map((u) => ({ id: u.id, name: u.person_name })))?.item;
      let udhaarId = hit?.id;
      if (!udhaarId) {
        if (d.kind === 'udhaarReturn') throw new Error(t('aiNoLoanFound'));
        const created = await createUdhaar({ personName: r.party?.name ?? d.person, partyId: r.party?.id ?? null, direction: 'GIVEN' });
        udhaarId = created.id;
      }
      const amount = needAmount(d.amount ?? c.amount);
      const move = { udhaarId, amount, date: d.date ?? today, accountId };
      if (d.kind === 'udhaarGive') await giveUdhaar(move);
      else await returnUdhaar(move);
      return { message: `${t('aiSaved')} · ${formatRupees(amount)}`, target: { screen: 'UdhaarDetail', udhaarId } };
    }

    case 'transfer': {
      const fromAccountId = need(r.account?.id, 'from account');
      const toAccountId = need(r.accountTo?.id, 'to account');
      const amount = needAmount(d.amount ?? c.amount);
      await transferBetween({ fromAccountId, toAccountId, amount, date: d.date ?? today });
      return { message: `${t('aiSaved')} · ${formatRupees(amount)}`, target: { screen: 'Accounts' } };
    }

    case 'createWorker': {
      const name = need(d.name ?? c.name, 'name');
      const w = await addLaborer({ name, phone: d.phone ?? null });
      const projectId = r.project?.id ?? c.projectId;
      const wage = d.wage ?? c.wage ?? 0;
      if (projectId && wage > 0) {
        await attachLaborerToProject({ projectId, laborerId: w.id, dailyWage: wage });
      }
      return { message: `${t('aiAdded')} · ${w.name}`, target: { screen: 'LaborerDetail', laborerId: w.id } };
    }

    case 'createParty': {
      const p = await addParty({ type: d.partyType, name: need(d.name ?? c.name, 'name'), phone: d.phone ?? null });
      return { message: `${t('aiAdded')} · ${p.name}` };
    }

    case 'createInvestor': {
      const inv = await addInvestor({ name: need(d.name ?? c.name, 'name'), phone: d.phone ?? null, committedAmount: d.amount ?? 0 });
      return { message: `${t('aiAdded')} · ${inv.name}`, target: { screen: 'InvestorProfile', investorId: inv.id } };
    }

    case 'createAccount': {
      const name = need(d.name ?? c.name, 'name');
      await addAccount({ name, type: d.accountType, openingBalance: d.openingBalance ?? 0 });
      return { message: `${t('aiAdded')} · ${name}`, target: { screen: 'Accounts' } };
    }

    case 'createPlot': {
      const plot = await createPlot({
        name: need(d.name ?? c.name, 'name'),
        society: d.society ?? null,
        plotNo: d.plotNo ?? null,
        dealPrice: d.dealPrice ?? 0,
        sellerName: d.seller ?? null,
      });
      return { message: `${t('aiAdded')} · ${plot.name}`, target: { screen: 'PlotDetail', plotId: plot.id } };
    }

    case 'createPurchaseOrder': {
      const projectId = need(r.project?.id ?? c.projectId, 'project');
      if (d.items.length === 0) throw new Error('missing items');
      await createPurchaseOrder({
        projectId,
        partyId: r.party?.id ?? null,
        supplierName: r.party ? null : d.supplier ?? null,
        items: d.items.map((i) => ({ itemName: i.item, qty: i.qty, rate: i.rate, unit: i.unit ?? null })),
      });
      const total = d.items.reduce((s2, i) => s2 + i.qty * i.rate, 0);
      return { message: `${t('aiAdded')} · ${money(total)}`, target: { screen: 'Bookings' } };
    }

    case 'receiveDelivery': {
      const po = await findPo(d.po);
      if (!po) throw new Error(t('aiNoPoFound'));
      const date = d.date ?? today;
      let n = 0;
      if (d.all || !d.item) {
        for (const it of po.items) {
          if (it.qtyRemaining > 0.001) {
            await addDelivery({ bookingId: it.booking.id, qty: d.qty && po.items.length === 1 ? Math.min(d.qty, it.qtyRemaining) : it.qtyRemaining, date });
            n++;
          }
        }
      } else {
        const m = matchName(d.item, po.items.map((it) => ({ id: it.booking.id, name: it.booking.item_name })));
        const it = m ? po.items.find((x) => x.booking.id === m.item.id) : undefined;
        if (!it) throw new Error(t('aiNoPoFound'));
        await addDelivery({ bookingId: it.booking.id, qty: Math.min(d.qty ?? it.qtyRemaining, it.qtyRemaining), date });
        n = 1;
      }
      return { message: `${t('aiSaved')} · ${po.poNumber} · ${n} ${t('items').toLowerCase()}`, target: { screen: 'PurchaseOrderDetail', poId: po.poId } };
    }

    case 'payPurchaseOrder': {
      const po = await findPo(d.po);
      if (!po) throw new Error(t('aiNoPoFound'));
      const accountId = need(r.account?.id ?? c.accountId, 'account');
      let left = needAmount(d.amount ?? c.amount);
      const date = d.date ?? today;
      // Allocate across the order's lines, oldest first, never over what is owed.
      for (const it of po.items) {
        if (left <= 0) break;
        const part = Math.min(left, it.payRemaining);
        if (part < 1) continue;
        await payBooking({ bookingId: it.booking.id, amount: part, date, accountId });
        left -= part;
      }
      return { message: `${t('aiSaved')} · ${money((d.amount ?? c.amount ?? 0) - left)}`, target: { screen: 'PurchaseOrderDetail', poId: po.poId } };
    }

    case 'plotPayment': {
      const plotId = need(r.plot?.id, 'plot');
      const accountId = need(r.account?.id ?? c.accountId, 'account');
      const amount = needAmount(d.amount ?? c.amount);
      await addPlotPayment({ plotId, payType: d.payType ?? 'INSTALLMENT', amount, date: d.date ?? today, accountId });
      return { message: `${t('aiSaved')} · ${money(amount)}`, target: { screen: 'PlotDetail', plotId } };
    }

    case 'plotExpense': {
      const plotId = need(r.plot?.id, 'plot');
      const accountId = need(r.account?.id ?? c.accountId, 'account');
      const amount = needAmount(d.amount ?? c.amount);
      // Category: the matched one, else the first plot-expense category (never invent one).
      let categoryId = r.category?.id;
      if (!categoryId) {
        const cats = await listCategories('EXPENSE');
        const plotSection = cats.find((x) => x.name_en === 'Plot' && !x.parent_id);
        const fallback = cats.find((x) => x.parent_id === plotSection?.id && x.is_system === 0) ?? cats.find((x) => x.parent_id === plotSection?.id);
        categoryId = need(fallback?.id, 'category');
      }
      await addPlotExpense({ plotId, categoryId, amount, date: d.date ?? today, accountId, note: d.note ?? null });
      return { message: `${t('aiSaved')} · ${money(amount)}`, target: { screen: 'PlotDetail', plotId } };
    }

    case 'setSale': {
      const projectId = need(r.project?.id ?? c.projectId, 'project');
      const price = needAmount(d.price ?? c.amount);
      await upsertSale(projectId, { buyerPartyId: r.party?.id ?? null, buyerName: r.party ? null : d.buyer ?? null, agreedPrice: price });
      return { message: `${t('aiSaved')} · ${money(price)}`, target: { screen: 'SaleDetail', projectId } };
    }

    case 'saleReceipt': {
      const projectId = need(r.project?.id ?? c.projectId, 'project');
      const accountId = need(r.account?.id ?? c.accountId, 'account');
      const amount = needAmount(d.amount ?? c.amount);
      const sale = await getProjectSale(projectId);
      if (!sale) throw new Error(t('aiNoSaleYet'));
      await addSaleReceipt({ saleId: sale.id, amount, date: d.date ?? today, accountId, payType: d.payType ?? null });
      return { message: `${t('aiSaved')} · ${money(amount)}`, target: { screen: 'SaleDetail', projectId } };
    }

    case 'saleCost': {
      const projectId = need(r.project?.id ?? c.projectId, 'project');
      const accountId = need(r.account?.id ?? c.accountId, 'account');
      const amount = needAmount(d.amount ?? c.amount);
      await addSaleCost({ projectId, name: d.note ?? null, amount, date: d.date ?? today, accountId });
      return { message: `${t('aiSaved')} · ${money(amount)}`, target: { screen: 'SaleDetail', projectId } };
    }

    case 'investorPayment': {
      const investorId = need(r.investor?.id, 'investor');
      const accountId = need(r.account?.id ?? c.accountId, 'account');
      const amount = needAmount(d.amount ?? c.amount);
      const date = d.date ?? today;
      if (r.project) await addInvestment({ investorId, projectId: r.project.id, amount, date, accountId });
      else await addInvestorPayment({ investorId, amount, date, accountId });
      return { message: `${t('aiSaved')} · ${money(amount)}`, target: { screen: 'InvestorProfile', investorId } };
    }

    case 'markTransferred': {
      const plotId = need(r.plot?.id, 'plot');
      await markPlotTransferred(plotId, d.date ?? today);
      return { message: t('aiSaved'), target: { screen: 'PlotDetail', plotId } };
    }

    case 'createProject': {
      if (r.issues.some((i) => i.code === 'plotTaken')) throw new Error(t('aiPlotTaken'));
      // Investors named in the sentence: existing ones attach by id, new ones are
      // created first (pledge = their stake) so the capacity guard passes.
      const investors: { investorId: string; amount: number }[] = [];
      for (const inv of r.investors) {
        const amount = inv.draft.amount ?? 0;
        const id = inv.ref?.id ?? (await addInvestor({ name: inv.draft.name, committedAmount: amount })).id;
        investors.push({ investorId: id, amount });
      }
      const project = await createProject({ name: need(d.name ?? c.name, 'name'), plotId: r.plot?.id ?? c.plotId ?? null, investors });
      return { message: `${t('aiAdded')} · ${project.name}`, target: { screen: 'ProjectDetail', projectId: project.id } };
    }
  }
}
