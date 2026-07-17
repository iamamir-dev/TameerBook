import { useCallback, useEffect, useState } from 'react';

import {
  addInvestment,
  listAccountsWithBalance,
  listInvestors,
  type AccountWithBalance,
  type InvestorRow,
} from '@/db';
import { useSaveAction } from '@/hooks';
import { useEntryStore } from '@/stores/useEntryStore';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { todayISO } from '@/utils/date';
import { swallow } from '@/utils/log';

interface Form {
  investorId: string | null;
  projectId: string | null;
  amount: number;
  accountId: string | null;
  date: string;
}

/** Data + form + save for the standalone "Add investment" screen. */
export function useInvestmentEntry(routeInvestorId?: string | null) {
  const projects = useProjectsStore((s) => s.items);
  const refreshProjects = useProjectsStore((s) => s.refresh);
  const lastProjectId = useEntryStore((s) => s.lastProjectId);
  const setLastProjectId = useEntryStore((s) => s.setLastProjectId);
  const lastAccountId = useEntryStore((s) => s.lastAccountId);
  const setLastAccountId = useEntryStore((s) => s.setLastAccountId);

  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [form, setForm] = useState<Form>({
    investorId: routeInvestorId ?? null,
    projectId: null,
    amount: 0,
    accountId: null,
    date: todayISO().slice(0, 10),
  });
  const patch = useCallback((p: Partial<Form>) => setForm((s) => ({ ...s, ...p })), []);

  useEffect(() => {
    listInvestors().then(setInvestors).catch(swallow('investment:investors'));
    listAccountsWithBalance().then(setAccounts).catch(swallow('investment:accounts'));
    void refreshProjects().catch(swallow('investment:projects'));
  }, [refreshProjects]);

  // Default the project + account (last-used, else first).
  useEffect(() => {
    setForm((s) => {
      if (s.projectId || projects.length === 0) return s;
      const fb = projects.find((p) => p.project.id === lastProjectId) ?? projects[0];
      return fb ? { ...s, projectId: fb.project.id } : s;
    });
  }, [projects, lastProjectId]);
  useEffect(() => {
    setForm((s) => {
      if (s.accountId || accounts.length === 0) return s;
      const fb = accounts.find((a) => a.id === lastAccountId) ?? accounts[0];
      return fb ? { ...s, accountId: fb.id } : s;
    });
  }, [accounts, lastAccountId]);

  const { saving, run } = useSaveAction();
  const canSave = !!form.investorId && !!form.projectId && form.amount > 0 && !!form.accountId;

  const save = useCallback(
    async (onDone: () => void) => {
      if (!canSave) return;
      const ok = await run(async () => {
        await addInvestment({
          investorId: form.investorId!,
          projectId: form.projectId!,
          amount: form.amount,
          date: form.date,
          accountId: form.accountId!,
        });
        setLastProjectId(form.projectId!);
        setLastAccountId(form.accountId!);
        await refreshProjects();
      });
      if (ok) onDone();
    },
    [canSave, form, run, setLastProjectId, setLastAccountId, refreshProjects]
  );

  return { projects, investors, accounts, form, patch, saving, canSave, save };
}
