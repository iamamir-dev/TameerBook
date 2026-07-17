import dayjs from 'dayjs';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Platform } from 'react-native';

import { SIZE_UNIT_LABEL_KEYS, type PlotRow, type Settlement } from '@/db';
import { useTranslation } from '@/i18n';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { swallow } from '@/utils/log';
import { createSettlementPdf } from '@/utils/settlementPdf';

export interface SettlementReportSource {
  projectName: string;
  settlement: Settlement | null;
  /** The project's plot — its address goes under the title. */
  plot?: PlotRow | null;
  /** Project timeline (start → settled); end falls back to today. */
  period?: { start: string | null; end: string | null } | null;
  payoutAccountName?: string | null;
}

export interface SettlementReportActions {
  /** True when a report can be generated (settlement + company present). */
  ready: boolean;
  busy: boolean;
  preview: () => void;
  download: () => void;
  share: () => void;
}

/**
 * The branded settlement-report actions (system print preview, save-to-folder,
 * share sheet) over ONE lazily built PDF. Used by the Settle Up wizard's
 * report step and by the Project Summary card after settlement.
 */
export function useSettlementReport(source: SettlementReportSource): SettlementReportActions {
  const { t } = useTranslation();
  const company = useCompanyStore((st) => st.companies.find((c) => c.id === st.activeCompanyId) ?? null);
  const fontFamily = useSettingsStore((st) => st.fontFamily);
  const [busy, setBusy] = useState(false);
  const cache = useRef<{ settlement: Settlement; pdf: { uri: string; html: string } } | null>(null);

  const ensurePdf = async (): Promise<{ uri: string; html: string } | null> => {
    if (!source.settlement || !company) return null;
    if (cache.current?.settlement === source.settlement) return cache.current.pdf;
    setBusy(true);
    try {
      const start = source.period?.start ? dayjs(source.period.start) : null;
      const end = dayjs(source.period?.end ?? undefined);
      const periodText = start
        ? `${start.format('DD MMM YYYY')} — ${end.format('DD MMM YYYY')} · ${Math.max(1, end.diff(start, 'day'))} ${t('daysLabel')}`
        : null;
      const p = source.plot;
      const sizeText = p?.size_value ? `${p.size_value} ${t(SIZE_UNIT_LABEL_KEYS[p.size_unit ?? 'MARLA'])}` : null;
      const plotAddress = p
        ? [p.society, p.block, p.plot_no, sizeText].filter(Boolean).join(' · ') || null
        : null;
      const pdf = await createSettlementPdf({
        company: {
          name: company.name,
          ownerName: company.owner_name,
          phone: company.phone,
          logoUri: company.logo_uri,
        },
        projectName: source.projectName,
        settlement: source.settlement,
        plotAddress,
        periodText,
        ruleLabel: t('ruleOwnerFirst'),
        ownerLabel: t('owner'),
        payoutAccountName: source.payoutAccountName ?? null,
        fontKey: fontFamily,
        L: {
          reportTitle: t('reportTitle'),
          revenue: t('revenue'),
          expenses: t('totalExpenses'),
          netProfit: t('netProfit'),
          netLoss: t('netLoss'),
          ownership: t('ownershipSection'),
          invested: t('investedLabel'),
          capitalBack: t('capitalBack'),
          profitShare: t('profitShare'),
          charity: t('donationLabel'),
          getsBack: t('payoutLabel'),
          total: t('totalLabel'),
          paidFrom: t('accountLabel'),
          madeWith: t('madeWith'),
          settled: t('settledStatus'),
          signatures: t('signaturesTitle'),
        },
      });
      cache.current = { settlement: source.settlement, pdf };
      return pdf;
    } catch (e) {
      swallow('settlementReport:build')(e);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const preview = () => {
    void ensurePdf().then((p) => p && Print.printAsync({ html: p.html }).catch(swallow('settlementReport:preview')));
  };

  const share = () => {
    void ensurePdf().then(async (p) => {
      if (p && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(p.uri, { mimeType: 'application/pdf', dialogTitle: t('reportTitle') }).catch(
          swallow('settlementReport:share')
        );
      }
    });
  };

  const download = () => {
    void ensurePdf().then(async (p) => {
      if (!p) return;
      try {
        if (Platform.OS === 'android') {
          const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (!perm.granted) return;
          const name = `TameerBook-${source.projectName.replace(/[^\w]+/g, '-')}.pdf`;
          const dest = await FileSystem.StorageAccessFramework.createFileAsync(perm.directoryUri, name, 'application/pdf');
          const b64 = await FileSystem.readAsStringAsync(p.uri, { encoding: 'base64' });
          await FileSystem.writeAsStringAsync(dest, b64, { encoding: 'base64' });
        } else if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(p.uri, { mimeType: 'application/pdf' });
        }
      } catch (e) {
        swallow('settlementReport:download')(e);
      }
    });
  };

  return { ready: !!source.settlement && !!company, busy, preview, download, share };
}
