import dayjs from 'dayjs';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';

import type { LaborerKhata } from '@/db';
import { useTranslation } from '@/i18n';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { swallow } from '@/utils/log';
import type { ReportDoc } from '@/utils/reportHtml';
import { buildReportHtml, createReportPdf } from '@/utils/reportPdf';

import { laborKhataDoc } from '../utils/laborKhataDoc';

export interface KhataStatementActions {
  ready: boolean;
  busy: boolean;
  /** Native print preview (same as the project reports). */
  preview: () => void;
  share: () => void;
}

/**
 * The worker-khata PDF (branded, via the shared report engine). Reads the active
 * company + font, builds the doc, and offers a native print preview + share —
 * keeping the screen free of any PDF/Sharing code.
 */
export function useKhataStatement(khata: LaborerKhata | null): KhataStatementActions {
  const { t } = useTranslation();
  const company = useCompanyStore((st) => st.companies.find((c) => c.id === st.activeCompanyId) ?? null);
  const fontFamily = useSettingsStore((st) => st.fontFamily);
  const [busy, setBusy] = useState(false);

  const buildDoc = (): ReportDoc | null => {
    if (!khata || !company) return null;
    // One section per participation, each with its own entries + totals.
    const projects = khata.participations.map((p) => ({
      name: p.projectName,
      dailyWage: p.projectLaborer.daily_wage,
      daysFull: p.balance.daysFull,
      daysHalf: p.balance.daysHalf,
      daysAbsent: p.balance.daysAbsent,
      earned: p.balance.accrued,
      taken: p.balance.paid,
      balance: p.balance.balance,
      entries: khata.history.filter((e) => e.projectLaborerId === p.projectLaborer.id),
    }));
    return laborKhataDoc({
      company: { name: company.name, ownerName: company.owner_name, phone: company.phone },
      workerName: khata.laborer.name,
      earned: khata.totals.earned,
      taken: khata.totals.taken,
      balance: khata.totals.balance,
      totalPresentDays: projects.reduce((s, p) => s + p.daysFull + p.daysHalf, 0),
      totalAbsentDays: projects.reduce((s, p) => s + p.daysAbsent, 0),
      projects,
      dateText: dayjs().format('DD MMM YYYY'),
      L: {
        khataStatement: t('workerKhata'),
        earned: t('earnedLabel'),
        taken: t('takenLabel'),
        balance: t('wageBalance'),
        date: t('date'),
        type: t('category'),
        amount: t('amount'),
        note: t('note'),
        dailyWage: t('dailyWage'),
        present: t('present'),
        absent: t('absent'),
        day: t('day'),
        days: t('days'),
        madeWith: t('madeWith'),
        payment: t('takenLabel'),
        attendance: { FULL: t('attFull'), HALF: t('attHalf'), ABSENT: t('attAbsent') },
      },
    });
  };

  const preview = () => {
    const doc = buildDoc();
    if (!doc || !company) return;
    setBusy(true);
    void buildReportHtml(doc, fontFamily, company.logo_uri)
      .then((html) => Print.printAsync({ html }))
      .catch(swallow('labor:khataPreview'))
      .finally(() => setBusy(false));
  };

  const share = () => {
    const doc = buildDoc();
    if (!doc || !company) return;
    setBusy(true);
    void createReportPdf(doc, fontFamily, company.logo_uri)
      .then(async ({ uri }) => {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('workerKhata') });
        }
      })
      .catch(swallow('labor:khataPdf'))
      .finally(() => setBusy(false));
  };

  return { ready: !!company, busy, preview, share };
}
