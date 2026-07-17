import dayjs from 'dayjs';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';

import type { InvestorActivityRow, InvestorRow, InvestorSummary } from '@/db';
import { useTranslation } from '@/i18n';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { swallow } from '@/utils/log';
import { createReportPdf } from '@/utils/reportPdf';

import { entryLabelKey } from '../utils/investorActivity';
import { investorStatementDoc } from '../utils/investorStatement';

export interface InvestorStatementActions {
  ready: boolean;
  busy: boolean;
  share: () => void;
}

/**
 * The investor statement PDF (branded, via the shared report engine). Mirrors
 * `useSettlementReport`: reads the active company + font, builds the doc, prints,
 * and shares. Keeps the profile screen free of any PDF/Sharing code.
 */
export function useInvestorStatement(source: {
  investor: InvestorRow | null;
  summary: InvestorSummary | null;
  activity: InvestorActivityRow[];
}): InvestorStatementActions {
  const { t } = useTranslation();
  const company = useCompanyStore((st) => st.companies.find((c) => c.id === st.activeCompanyId) ?? null);
  const fontFamily = useSettingsStore((st) => st.fontFamily);
  const [busy, setBusy] = useState(false);

  const share = () => {
    void (async () => {
      const { investor, summary } = source;
      if (!investor || !company) return;
      setBusy(true);
      try {
        const doc = investorStatementDoc({
          company: { name: company.name, ownerName: company.owner_name, phone: company.phone },
          investorName: investor.name,
          invested: summary?.invested ?? 0,
          profit: summary?.profit ?? 0,
          total: summary?.total ?? 0,
          rows: source.activity.map((e) => ({
            date: e.date,
            label: t(entryLabelKey(e.entryType)),
            project: e.projectName,
            amount: e.amount,
            direction: e.direction,
          })),
          dateText: dayjs().format('DD MMM YYYY'),
          L: {
            statement: t('statement'),
            totalInvested: t('totalInvested'),
            profitEarned: t('profitEarned'),
            total: t('totalLabel'),
            date: t('date'),
            category: t('category'),
            projects: t('projects'),
            amount: t('amount'),
            madeWith: t('madeWith'),
          },
        });
        const { uri } = await createReportPdf(doc, fontFamily, company.logo_uri);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('statement') });
        }
      } catch (e) {
        swallow('investor:statement')(e);
      } finally {
        setBusy(false);
      }
    })();
  };

  return { ready: !!company, busy, share };
}
