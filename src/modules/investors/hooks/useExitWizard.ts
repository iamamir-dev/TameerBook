import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useState } from 'react';

import type { SelectOption, IconKey } from '@/components/ui';
import {
  exitInvestor,
  getInvestor,
  getProjectCapitalSummary,
  listInvestorParticipations,
  listProjectInvestors,
  type ExitScenario,
  type InvestorParticipation,
  type InvestorRow,
  type OwnershipShare,
  type ProjectInvestorRow,
} from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { todayISO } from '@/utils/date';
import { computeExitPreview } from '@/utils/exitPreview';
import { swallow } from '@/utils/log';
import { createReportPdf } from '@/utils/reportPdf';

import { exitReceiptDoc } from '../utils/exitReceipt';

/** All state, derived data, and actions for the investor-exit wizard. */
export function useExitWizard(investorId: string) {
  const { t } = useTranslation();
  const refreshProjects = useProjectsStore((s) => s.refresh);
  const company = useCompanyStore((st) => st.companies.find((c) => c.id === st.activeCompanyId) ?? null);
  const fontFamily = useSettingsStore((st) => st.fontFamily);

  const [investor, setInvestor] = useState<InvestorRow | null>(null);
  const [parts, setParts] = useState<InvestorParticipation[]>([]);
  const [step, setStep] = useState(0);

  const [piId, setPiId] = useState<string | null>(null);
  const [shares, setShares] = useState<OwnershipShare[]>([]);
  const [pis, setPis] = useState<ProjectInvestorRow[]>([]);
  const [scenario, setScenario] = useState<ExitScenario | null>(null);
  const [valuation, setValuation] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [buyerPiId, setBuyerPiId] = useState<string | null>(null);
  /** The freshly-created investor for the NEW_INVESTOR scenario (from the shared
   *  person sheet — no more inline addInvestor). */
  const [newInvestor, setNewInvestor] = useState<InvestorRow | null>(null);
  const [portion, setPortion] = useState(0);

  const { saving, run: runSave } = useSaveAction();

  useEffect(() => {
    let cancelled = false;
    getInvestor(investorId).then((row) => !cancelled && setInvestor(row)).catch(swallow('exitWizard:investor'));
    listInvestorParticipations(investorId)
      .then((p) => {
        if (cancelled) return;
        setParts(p);
        if (p.length === 1) setPiId(p[0].id);
      })
      .catch(swallow('exitWizard:participations'));
    return () => {
      cancelled = true;
    };
  }, [investorId]);

  const selectedPart = parts.find((p) => p.id === piId) ?? null;
  const selectedProjectId = selectedPart?.project_id ?? null;

  useEffect(() => {
    if (!selectedProjectId) {
      setShares([]);
      setPis([]);
      return;
    }
    let cancelled = false;
    getProjectCapitalSummary(selectedProjectId).then((s) => !cancelled && setShares(s.shares)).catch(swallow('exitWizard:capital'));
    listProjectInvestors(selectedProjectId).then((rows) => !cancelled && setPis(rows)).catch(swallow('exitWizard:projectInvestors'));
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const leaverShare = shares.find((s) => s.projectInvestorId === piId) ?? null;
  const statusById = useMemo(() => new Map(pis.map((p) => [p.id, p.status])), [pis]);

  const partnerOptions: SelectOption[] = useMemo(
    () =>
      shares
        .filter((s) => s.projectInvestorId !== piId && statusById.get(s.projectInvestorId) === 'ACTIVE')
        .map((s) => ({ id: s.projectInvestorId, label: s.name, icon: 'investor' as IconKey })),
    [shares, piId, statusById]
  );

  const newName = newInvestor?.name ?? '';
  const { before, after } = useMemo(
    () =>
      computeExitPreview({
        shares,
        pis,
        leaverPiId: piId,
        scenario,
        portion,
        buyerPiId,
        newInvestorName: newName,
        ownerLabel: t('scOwnerBuy'),
        buyerFallbackLabel: t('buyer'),
      }),
    [shares, pis, piId, scenario, portion, buyerPiId, newName, t]
  );

  const canNext = useMemo((): boolean => {
    if (step === 0) return !!piId;
    if (step === 1) return !!scenario;
    if (step === 2) return valuation > 0 && agreed;
    if (step === 3) {
      if (scenario === 'PARTNER_BUY') return !!buyerPiId;
      if (scenario === 'NEW_INVESTOR') return !!newInvestor;
      if (scenario === 'PARTIAL') return portion > 0 && portion <= (leaverShare?.capital ?? 0);
      return true;
    }
    return true;
  }, [step, piId, scenario, valuation, agreed, buyerPiId, newInvestor, portion, leaverShare]);

  const shareReceipt = async (buyerName: string, amount: number) => {
    if (!investor || !selectedPart || !company) return;
    const doc = exitReceiptDoc({
      company: { name: company.name, ownerName: company.owner_name, phone: company.phone },
      projectName: selectedPart.projectName,
      investorName: investor.name,
      buyerName,
      amount,
      L: {
        title: t('exitReceipt'),
        who: t('exitWho'),
        buyer: t('buyer'),
        value: t('exitValue'),
        note: t('exitValueNote'),
        signatures: t('signaturesTitle'),
        madeWith: t('madeWith'),
      },
    });
    const { uri } = await createReportPdf(doc, fontFamily, company.logo_uri);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('exitReceipt') });
    }
  };

  const confirm = async (onDone: () => void) => {
    if (!selectedPart || !scenario || !leaverShare) return;
    let buyerName = t('scOwnerBuy');
    if (scenario === 'NEW_INVESTOR') buyerName = newName;
    else if (scenario === 'PARTNER_BUY') buyerName = shares.find((s) => s.projectInvestorId === buyerPiId)?.name ?? t('buyer');
    else if (scenario === 'PARTIAL' || scenario === 'COMMITTED_UNPAID') buyerName = '';
    const amount = scenario === 'PARTIAL' ? portion : leaverShare.capital;

    const ok = await runSave(async () => {
      await exitInvestor({
        projectId: selectedPart.project_id,
        projectInvestorId: selectedPart.id,
        scenario,
        valuationAmount: valuation,
        date: todayISO().slice(0, 10),
        portionAmount: portion,
        buyerProjectInvestorId: buyerPiId,
        newInvestorId: newInvestor?.id ?? null,
      });
      await refreshProjects();
    });
    if (!ok) return;
    // Committed — the receipt PDF is best-effort so a share cancel never looks
    // like a failed (double-)exit.
    await shareReceipt(buyerName, amount).catch(swallow('exitWizard:sharePdf'));
    onDone();
  };

  return {
    investor,
    parts,
    step,
    goNext: () => setStep((s) => Math.min(4, s + 1)),
    goBackStep: () => setStep((s) => Math.max(0, s - 1)),
    isFirstStep: step === 0,
    piId,
    setPiId,
    shares,
    leaverShare,
    partnerOptions,
    selectedPart,
    scenario,
    setScenario,
    valuation,
    setValuation,
    agreed,
    setAgreed,
    buyerPiId,
    setBuyerPiId,
    newInvestor,
    setNewInvestor,
    portion,
    setPortion,
    before,
    after,
    canNext,
    saving,
    confirm,
  };
}
