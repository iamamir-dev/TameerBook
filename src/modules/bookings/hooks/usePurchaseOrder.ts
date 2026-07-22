import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/i18n';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { swallow } from '@/utils/log';
import { formatQty, formatRupees } from '@/utils/money';
import { buildReportHtml } from '@/utils/reportPdf';

import { bookingStatusMeta } from '../utils/status';
import { purchaseOrderDoc } from '../utils/purchaseOrderDoc';
import type { BookingDetailData } from './useBookings';

/**
 * Builds the branded Purchase Order PDF (html + csv) for a booking via the
 * shared report engine, so the detail screen only wires the preview.
 */
export function usePurchaseOrder(data: BookingDetailData): { html: string; csv: string; ready: boolean } {
  const { t } = useTranslation();
  const company = useCompanyStore((st) => st.companies.find((c) => c.id === st.activeCompanyId) ?? null);
  const fontFamily = useSettingsStore((st) => st.fontFamily);
  const [html, setHtml] = useState('');

  const { summary, deliveries, payments, projects } = data;
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? '';
  const unitSuffix = summary?.booking.unit ? ` ${summary.booking.unit}` : '';

  const csv = useMemo(() => {
    if (!summary) return '';
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [
      [t('item'), t('qtyLabel'), t('rateLabel'), t('totalLabel')].join(','),
      [summary.booking.item_name, `${formatQty(summary.booking.qty)}${unitSuffix}`, formatRupees(summary.booking.rate), formatRupees(summary.booking.total)]
        .map(q)
        .join(','),
      '',
      [t('deliveries'), t('date'), t('qtyLabel')].join(','),
      ...deliveries.map((d) => ['', dayjs(d.date).format('YYYY-MM-DD'), `${formatQty(d.qty)}${unitSuffix}`].map(q).join(',')),
      '',
      [t('payments'), t('date'), t('amount')].join(','),
      ...payments.map((p) => ['', dayjs(p.date).format('YYYY-MM-DD'), formatRupees(p.amount)].map(q).join(',')),
    ];
    return lines.join('\n');
  }, [summary, deliveries, payments, unitSuffix, t]);

  useEffect(() => {
    if (!summary || !company) return;
    let alive = true;
    const doc = purchaseOrderDoc({
      company: { name: company.name, ownerName: company.owner_name, phone: company.phone },
      itemName: summary.booking.item_name,
      unit: summary.booking.unit,
      qty: summary.booking.qty,
      rate: summary.booking.rate,
      total: summary.booking.total,
      received: summary.qtyReceived,
      paid: summary.paid,
      payRemaining: summary.payRemaining,
      supplierName: summary.booking.supplier_name,
      projectName: summary.projectName,
      statusLabel: t(bookingStatusMeta(summary).labelKey),
      deliveries: deliveries.map((d) => ({
        date: d.date,
        projectName: projectName(d.project_id ?? summary.booking.project_id),
        qty: d.qty,
      })),
      payments: payments.map((p) => ({ date: p.date, amount: p.amount, note: p.description })),
      dateText: dayjs().format('DD MMM YYYY'),
      L: {
        purchaseOrder: t('purchaseOrder'),
        supplier: t('supplier'),
        project: t('projectLabel'),
        total: t('totalLabel'),
        paid: t('paidLabel'),
        toPay: t('payRemainingLabel'),
        item: t('item'),
        qty: t('qtyLabel'),
        rate: t('rateLabel'),
        received: t('receivedQty'),
        deliveries: t('deliveries'),
        payments: t('payments'),
        date: t('date'),
        note: t('note'),
        amount: t('amount'),
        madeWith: t('madeWith'),
      },
    });
    buildReportHtml(doc, fontFamily, company.logo_uri)
      .then((h) => alive && setHtml(h))
      .catch(swallow('booking:po'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, deliveries, payments, company, fontFamily]);

  return { html, csv, ready: !!html };
}
