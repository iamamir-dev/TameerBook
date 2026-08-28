import dayjs from 'dayjs';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';

import type {
  ConstructionSummary,
  PlotSummary,
  ProjectCost,
  ProjectRow,
  SaleSummary,
  SettlementSummary,
} from '@/db';
import { useTranslation } from '@/i18n';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { formatDisplayDate } from '@/utils/date';
import { swallow } from '@/utils/log';
import { formatRupees } from '@/utils/money';
import type { ReportBlock, ReportDoc } from '@/utils/reportHtml';
import { buildReportHtml, createReportPdf } from '@/utils/reportPdf';

import { projectStatusMeta } from '../utils/status';

export interface ProjectReportActions {
  ready: boolean;
  busy: boolean;
  preview: () => void;
  share: () => void;
}

interface ProjectReportData {
  project: ProjectRow | null;
  cost: ProjectCost | null;
  plotSum: PlotSummary | null;
  constr: ConstructionSummary | null;
  saleSum: SaleSummary | null;
  settlement: SettlementSummary | null;
  progressPercent: number;
  saleDeal: number;
  saleReceived: number;
}

/**
 * The full project PDF — plot + construction (by category + labor) + sale +
 * investors — via the shared branded report engine, shown with the native print
 * preview (like the settlement / PO / plot reports). Built from already-loaded
 * data so it fires no extra queries.
 */
export function useProjectReport(data: ProjectReportData): ProjectReportActions {
  const { t, language } = useTranslation();
  const company = useCompanyStore((st) => st.companies.find((c) => c.id === st.activeCompanyId) ?? null);
  const fontFamily = useSettingsStore((st) => st.fontFamily);
  const [busy, setBusy] = useState(false);

  const doc = useMemo<ReportDoc | null>(() => {
    const { project, cost, constr, saleSum, settlement } = data;
    if (!project || !cost || !company) return null;
    const money = (n: number) => formatRupees(n);
    const catName = (c: { nameEn: string; nameUr: string }) => (language === 'ur' ? c.nameUr : c.nameEn);

    const blocks: ReportBlock[] = [
      {
        kind: 'stats',
        items: [
          { label: t('projectTotalCost'), value: money(cost.totalCost), filled: 'accent' },
          { label: t('phasePlot'), value: money(cost.plotCost) },
          { label: t('phaseConstruction'), value: money(cost.constructionCost) },
          { label: t('buyerReceipts'), value: money(data.saleReceived), tone: 'accent' },
        ],
      },
    ];

    // Construction by category (+ accrued labor as its own line).
    const constrRows = (constr?.byCategory ?? []).map((c) => [
      { text: catName(c) },
      { text: c.qty > 0 ? `${c.qty}${c.unit ? ` ${c.unit}` : ''}` : '' },
      { text: money(c.total), tone: 'red' as const },
    ]);
    if ((constr?.laborAccrued ?? 0) > 0) {
      constrRows.push([{ text: t('laborTitle') }, { text: '' }, { text: money(constr!.laborAccrued), tone: 'red' as const }]);
    }
    if (constrRows.length > 0) {
      blocks.push({
        kind: 'table',
        title: t('phaseConstruction'),
        columns: [{ label: t('category') }, { label: t('qtyLabel') }, { label: t('amount'), align: 'num' }],
        rows: constrRows,
        totals: [{ text: t('projectTotalCost'), tone: 'strong' }, { text: '', tone: 'strong' }, { text: money(cost.constructionCost), tone: 'strong' }],
      });
    }

    // Sale.
    if (saleSum?.sale) {
      blocks.push({
        kind: 'notes',
        lines: [
          { label: t('salePriceLabel'), value: money(data.saleDeal) },
          { label: t('buyerReceipts'), value: money(data.saleReceived) },
          { label: t('outstanding'), value: money(saleSum.outstanding) },
          ...(saleSum.sale.buyer_name ? [{ label: t('buyerName'), value: saleSum.sale.buyer_name }] : []),
        ],
      });
    }

    // Investors + settlement projection.
    if (settlement && settlement.investors.length > 0) {
      blocks.push({
        kind: 'table',
        title: t('tabInvestors'),
        columns: [{ label: t('personName') }, { label: t('invested'), align: 'num' }, { label: t('profitShare'), align: 'num', highlight: true }],
        rows: settlement.investors.map((r) => [
          { text: r.name, tag: `${Math.round(r.ownershipPct)}%` },
          { text: money(r.invested) },
          { text: money(r.profitOrLoss), tone: r.profitOrLoss >= 0 ? ('green' as const) : ('red' as const) },
        ]),
        summary: [
          { label: settlement.isProfit ? t('netProfit') : t('netLoss'), value: money(settlement.net), tone: settlement.isProfit ? 'green' : 'red' },
        ],
      });
    }

    const startEnd = [
      project.start_date ? `${t('projectStartDate')}: ${formatDisplayDate(project.start_date)}` : null,
      project.settled_at ? `${t('settledOn')}: ${formatDisplayDate(project.settled_at)}` : null,
    ];

    return {
      company: { name: company.name, ownerName: company.owner_name, phone: company.phone },
      title: t('projects'),
      subject: project.name,
      sublines: startEnd,
      statusChip: t(projectStatusMeta({
        project, cost, saleDeal: data.saleDeal, saleReceived: data.saleReceived,
        progressPercent: data.progressPercent, totalIn: 0, totalOut: 0,
      }).labelKey),
      dateText: dayjs().format('DD MMM YYYY'),
      madeWith: t('madeWith'),
      blocks,
    };
  }, [data, company, t, language]);

  const preview = () => {
    if (!doc || !company) return;
    setBusy(true);
    void buildReportHtml(doc, fontFamily, company.logo_uri)
      .then((html) => Print.printAsync({ html }))
      .catch(swallow('project:reportPreview'))
      .finally(() => setBusy(false));
  };

  const share = () => {
    if (!doc || !company) return;
    setBusy(true);
    void createReportPdf(doc, fontFamily, company.logo_uri)
      .then(async ({ uri }) => {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: doc.subject });
        }
      })
      .catch(swallow('project:reportPdf'))
      .finally(() => setBusy(false));
  };

  return { ready: !!doc, busy, preview, share };
}
