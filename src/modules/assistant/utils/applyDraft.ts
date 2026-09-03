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
  accountId?: string | null;
  projectId?: string | null;
  /** payWorker: which participation (project) the payment settles. */
  projectLaborerId?: string | null;
}

/** What the sheet must ask for before it can save. */
export interface DraftNeeds {
  account: boolean;
  project: boolean;
  participation: boolean;
}

export function draftNeeds(r: ResolvedDraft): DraftNeeds {
  const d = r.draft;
  switch (d.kind) {
    case 'expense':
    case 'income':
      return { account: !r.account, project: false, participation: false };
    case 'material':
      return { account: !r.account, project: !r.project, participation: false };
    case 'payWorker':
    case 'udhaarGive':
    case 'udhaarReturn':
      return { account: !r.account, project: false, participation: d.kind === 'payWorker' };
    case 'attendance':
      return { account: false, project: !r.project, participation: false };
    default:
      return { account: false, project: false, participation: false };
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

export async function applyDraft(r: ResolvedDraft, c: DraftChoices): Promise<Applied> {
  const d = r.draft;
  const today = todayISO().slice(0, 10);
  switch (d.kind) {
    case 'expense':
    case 'income': {
      const accountId = need(r.account?.id ?? c.accountId, 'account');
      const projectId = r.project?.id ?? null;
      await addTransaction({
        direction: d.kind === 'expense' ? 'OUT' : 'IN',
        amount: d.amount,
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
        message: `${t('aiSaved')} · ${formatRupees(d.amount)}`,
        target: projectId ? { screen: 'ProjectDetail', projectId } : { screen: 'Cash' },
      };
    }

    case 'material': {
      const accountId = need(r.account?.id ?? c.accountId, 'account');
      const projectId = need(r.project?.id ?? c.projectId, 'project');
      const amount = d.amount ?? (d.qty && d.rate ? Math.round(d.qty * d.rate) : 0);
      if (amount <= 0) throw new Error('missing amount');
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
      await payLaborer({ projectLaborerId, amount: d.amount, date: d.date ?? today, accountId, note: d.note ?? null });
      return { message: `${t('aiSaved')} · ${formatRupees(d.amount)}`, target: { screen: 'LaborerDetail', laborerId: r.worker.id } };
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
      const move = { udhaarId, amount: d.amount, date: d.date ?? today, accountId };
      if (d.kind === 'udhaarGive') await giveUdhaar(move);
      else await returnUdhaar(move);
      return { message: `${t('aiSaved')} · ${formatRupees(d.amount)}`, target: { screen: 'UdhaarDetail', udhaarId } };
    }

    case 'transfer': {
      const fromAccountId = need(r.account?.id, 'from account');
      const toAccountId = need(r.accountTo?.id, 'to account');
      await transferBetween({ fromAccountId, toAccountId, amount: d.amount, date: d.date ?? today });
      return { message: `${t('aiSaved')} · ${formatRupees(d.amount)}`, target: { screen: 'Accounts' } };
    }

    case 'createWorker': {
      const w = await addLaborer({ name: d.name, phone: d.phone ?? null });
      if (r.project && d.wage && d.wage > 0) {
        await attachLaborerToProject({ projectId: r.project.id, laborerId: w.id, dailyWage: d.wage });
      }
      return { message: `${t('aiAdded')} · ${w.name}`, target: { screen: 'LaborerDetail', laborerId: w.id } };
    }

    case 'createParty': {
      const p = await addParty({ type: d.partyType, name: d.name, phone: d.phone ?? null });
      return { message: `${t('aiAdded')} · ${p.name}` };
    }

    case 'createInvestor': {
      const inv = await addInvestor({ name: d.name, phone: d.phone ?? null, committedAmount: d.amount ?? 0 });
      return { message: `${t('aiAdded')} · ${inv.name}`, target: { screen: 'InvestorProfile', investorId: inv.id } };
    }

    case 'createAccount': {
      await addAccount({ name: d.name, type: d.accountType, openingBalance: d.openingBalance ?? 0 });
      return { message: `${t('aiAdded')} · ${d.name}`, target: { screen: 'Accounts' } };
    }

    case 'createPlot': {
      const plot = await createPlot({
        name: d.name,
        society: d.society ?? null,
        plotNo: d.plotNo ?? null,
        dealPrice: d.dealPrice ?? 0,
        sellerName: d.seller ?? null,
      });
      return { message: `${t('aiAdded')} · ${plot.name}`, target: { screen: 'PlotDetail', plotId: plot.id } };
    }

    case 'createProject': {
      const project = await createProject({ name: d.name, plotId: r.plot?.id ?? null });
      return { message: `${t('aiAdded')} · ${project.name}`, target: { screen: 'ProjectDetail', projectId: project.id } };
    }
  }
}
