import dayjs from 'dayjs';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';

import {
  PAY_TYPE_LABEL_KEYS,
  SIZE_UNIT_LABEL_KEYS,
  type CategoryRow,
  type PlotSummary,
  type ProjectRow,
  type TransactionRow,
} from '@/db';
import { useCategoryLabel } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { formatDisplayDate } from '@/utils/date';
import { swallow } from '@/utils/log';
import { formatRupees } from '@/utils/money';
import type { ReportBlock, ReportDoc } from '@/utils/reportHtml';
import { buildReportHtml, createReportPdf } from '@/utils/reportPdf';

import { plotStatusMeta } from '../utils/status';

export interface PlotReportActions {
  ready: boolean;
  busy: boolean;
  /** Native print preview (same as the project / PO reports). */
  preview: () => void;
  share: () => void;
}

interface PlotReportData {
  summary: PlotSummary | null;
  txns: TransactionRow[];
  categories: CategoryRow[];
  linkedProject: ProjectRow | null;
}

/**
 * The detailed plot PDF — purchase → sale — built through the shared report
 * engine and shown with the native print preview. Standalone plots include the
 * sale (buyer receipts + profit); a plot inside a project shows purchase +
 * expenses only (its sale/settlement live in the project report).
 */
export function usePlotReport({ summary, txns, categories, linkedProject }: PlotReportData): PlotReportActions {
  const { t, language } = useTranslation();
  const company = useCompanyStore((st) => st.companies.find((c) => c.id === st.activeCompanyId) ?? null);
  const fontFamily = useSettingsStore((st) => st.fontFamily);
  const catName = useCategoryLabel();
  const [busy, setBusy] = useState(false);

  const doc = useMemo<ReportDoc | null>(() => {
    if (!summary || !company) return null;
    const { plot } = summary;
    const catById = new Map(categories.map((c) => [c.id, c]));
    const sellerHeadingId = categories.find((c) => c.name_en === 'Seller Payment')?.id ?? null;

    const isReceipt = (txn: TransactionRow) => txn.phase === 'SALE';
    const isSeller = (txn: TransactionRow) => {
      const cat = txn.category_id ? catById.get(txn.category_id) : undefined;
      return cat?.name_en === 'Plot Payment' || (!!sellerHeadingId && cat?.parent_id === sellerHeadingId);
    };
    const typeLabel = (txn: TransactionRow) => {
      const cat = txn.category_id ? catById.get(txn.category_id) : undefined;
      if (cat && cat.name_en !== 'Plot Payment' && cat.name_en !== 'Plot Sale') return catName(cat);
      return txn.pay_type ? t(PAY_TYPE_LABEL_KEYS[txn.pay_type]) : catName(cat!);
    };

    // Oldest-first reads like a statement.
    const ordered = [...txns].sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));
    const sellerRows = ordered.filter(isSeller);
    const receiptRows = ordered.filter(isReceipt);
    const expenseRows = ordered.filter((x) => x.direction === 'OUT' && !isSeller(x));

    const money = (n: number) => formatRupees(n);
    const blocks: ReportBlock[] = [
      {
        kind: 'stats',
        items: [
          { label: t('totalCostLabel'), value: money(summary.totalCost), filled: 'accent' },
          { label: t('paidToSeller'), value: money(summary.paidToSeller) },
          { label: t('remaining'), value: money(summary.remaining) },
          { label: t('plotExpensesLabel'), value: money(summary.expenses), tone: 'danger' },
        ],
      },
      {
        kind: 'table',
        title: t('paidToSeller'),
        columns: [{ label: t('date') }, { label: t('category') }, { label: t('amount'), align: 'num' }],
        rows: sellerRows.map((x) => [{ text: formatDisplayDate(x.date) }, { text: typeLabel(x) }, { text: money(x.amount), tone: 'red' }]),
        totals: [{ text: '', tone: 'strong' }, { text: t('paidToSeller'), tone: 'strong' }, { text: money(summary.paidToSeller), tone: 'strong' }],
      },
      {
        kind: 'table',
        title: t('plotExpensesLabel'),
        columns: [{ label: t('date') }, { label: t('category') }, { label: t('amount'), align: 'num' }],
        rows: expenseRows.map((x) => {
          const cat = x.category_id ? catById.get(x.category_id) : undefined;
          return [{ text: formatDisplayDate(x.date) }, { text: cat ? catName(cat) : t('addExpense') }, { text: money(x.amount), tone: 'red' }];
        }),
        totals: [{ text: '', tone: 'strong' }, { text: t('plotExpensesLabel'), tone: 'strong' }, { text: money(summary.expenses), tone: 'strong' }],
      },
    ];

    // Standalone sale: buyer receipts + the flip's profit story.
    if (!plot.project_id && summary.salePrice > 0) {
      blocks.push({
        kind: 'table',
        title: t('sellPlot'),
        columns: [{ label: t('date') }, { label: t('category') }, { label: t('amount'), align: 'num' }],
        rows: receiptRows.map((x) => [{ text: formatDisplayDate(x.date) }, { text: typeLabel(x) }, { text: money(x.amount), tone: 'green' }]),
        summary: [
          { label: t('salePriceLabel'), value: money(summary.salePrice) },
          { label: t('buyerReceipts'), value: money(summary.saleReceived), tone: 'green' },
          { label: t('remaining'), value: money(summary.saleOutstanding) },
          { label: t('plotProfit'), value: money(summary.saleProfit), tone: summary.saleProfit >= 0 ? 'green' : 'red' },
        ],
      });
    }

    const notes: { label: string; value: string }[] = [];
    if (plot.seller_name) notes.push({ label: t('seller'), value: plot.seller_name });
    if (plot.seller_cnic) notes.push({ label: t('cnic'), value: plot.seller_cnic });
    if (plot.seller_phone) notes.push({ label: t('sellerPhone'), value: plot.seller_phone });
    if (plot.buyer_name) notes.push({ label: t('buyerName'), value: plot.buyer_name });
    if (plot.transfer_date) notes.push({ label: t('transferredOn'), value: formatDisplayDate(plot.transfer_date) });
    if (linkedProject) notes.push({ label: t('projectLabel'), value: linkedProject.name });
    if (notes.length) blocks.push({ kind: 'notes', lines: notes });

    const sizeText = plot.size_value ? `${plot.size_value} ${t(SIZE_UNIT_LABEL_KEYS[plot.size_unit ?? 'MARLA'])}` : null;
    return {
      company: { name: company.name, ownerName: company.owner_name, phone: company.phone },
      title: t('plotReport'),
      subject: plot.name,
      sublines: [sizeText, plot.seller_name ? `${t('seller')}: ${plot.seller_name}` : null],
      statusChip: t(plotStatusMeta(summary).labelKey),
      dateText: dayjs().format('DD MMM YYYY'),
      madeWith: t('madeWith'),
      blocks,
    };
  }, [summary, categories, txns, linkedProject, company, catName, t, language]);

  const preview = () => {
    if (!doc || !company) return;
    setBusy(true);
    void buildReportHtml(doc, fontFamily, company.logo_uri)
      .then((html) => Print.printAsync({ html }))
      .catch(swallow('plot:reportPreview'))
      .finally(() => setBusy(false));
  };

  const share = () => {
    if (!doc || !company) return;
    setBusy(true);
    void createReportPdf(doc, fontFamily, company.logo_uri)
      .then(async ({ uri }) => {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('plotReport') });
        }
      })
      .catch(swallow('plot:reportPdf'))
      .finally(() => setBusy(false));
  };

  return { ready: !!doc, busy, preview, share };
}
