import { matchName, type AnswerTarget, type ResolvedDraft } from '@/ai';
import {
  addAccount,
  addInvestor,
  addLaborer,
  addParty,
  addTransaction,
  attachLaborerToProject,
  createPlot,
  createProject,
  createUdhaar,
  giveUdhaar,
  listProjectLaborers,
  listUdhaar,
  markAllPresentForProject,
  markAttendance,
  payLaborer,
  returnUdhaar,
  transferBetween,
} from '@/db';
import { t } from '@/i18n';
import { todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';

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
    default:
      return none;
  }
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

    case 'createProject': {
      const project = await createProject({ name: need(d.name ?? c.name, 'name'), plotId: r.plot?.id ?? c.plotId ?? null });
      return { message: `${t('aiAdded')} · ${project.name}`, target: { screen: 'ProjectDetail', projectId: project.id } };
    }
  }
}
