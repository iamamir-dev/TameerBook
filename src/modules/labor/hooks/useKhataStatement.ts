import dayjs from 'dayjs';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';

import type { LaborerKhata } from '@/db';
import { useTranslation } from '@/i18n';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { swallow } from '@/utils/log';
import { createReportPdf } from '@/utils/reportPdf';

import { laborKhataDoc } from '../utils/laborKhataDoc';

export interface KhataStatementActions {
  ready: boolean;
  busy: boolean;
  share: () => void;
}

/**
 * The worker-khata PDF (branded, via the shared report engine). Mirrors
 * `useInvestorStatement`: reads the active company + font, builds the doc,
 * prints, and shares — keeping the screen free of any PDF/Sharing code.
 */
export function useKhataStatement(khata: LaborerKhata | null): KhataStatementActions {
  const { t } = useTranslation();
  const company = useCompanyStore((st) => st.companies.find((c) => c.id === st.activeCompanyId) ?? null);
  const fontFamily = useSettingsStore((st) => st.fontFamily);
  const [busy, setBusy] = useState(false);

  const share = () => {
    void (async () => {
      if (!khata || !company) return;
      setBusy(true);
      try {
        const doc = laborKhataDoc({
          company: { name: company.name, ownerName: company.owner_name, phone: company.phone },
          workerName: khata.laborer.name,
          earned: khata.totals.earned,
          taken: khata.totals.taken,
          balance: khata.totals.balance,
          history: khata.history,
          dateText: dayjs().format('DD MMM YYYY'),
          L: {
            khataStatement: t('workerKhata'),
            earned: t('earnedLabel'),
            taken: t('takenLabel'),
            balance: t('wageBalance'),
            date: t('date'),
            type: t('category'),
            projects: t('projects'),
            amount: t('amount'),
            madeWith: t('madeWith'),
            payment: t('takenLabel'),
            attendance: { FULL: t('attFull'), HALF: t('attHalf'), ABSENT: t('attAbsent') },
          },
        });
        const { uri } = await createReportPdf(doc, fontFamily, company.logo_uri);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('workerKhata') });
        }
      } catch (e) {
        swallow('labor:khataPdf')(e);
      } finally {
        setBusy(false);
      }
    })();
  };

  return { ready: !!company, busy, share };
}
