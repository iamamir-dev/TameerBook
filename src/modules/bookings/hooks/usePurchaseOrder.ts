import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/i18n';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { swallow } from '@/utils/log';
import { formatQty, formatRupees } from '@/utils/money';
import { buildPurchaseOrderHtml } from '@/utils/reportPdf';

import { bookingStatusMeta } from '../utils/status';
import type { BookingDetailData } from './useBookings';

/** A short, stable PO number derived from the booking id. */
const poNumberOf = (id: string) => `PO-${id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}`;

/**
 * Builds the modern Purchase Order PDF (html + csv) for a booking, so the detail
 * screen only wires the preview.
 */
export function usePurchaseOrder(data: BookingDetailData): { html: string; csv: string; ready: boolean } {
  const { t } = useTranslation();
  const company = useCompanyStore((st) => st.companies.find((c) => c.id === st.activeCompanyId) ?? null);
  const fontFamily = useSettingsStore((st) => st.fontFamily);
  const [html, setHtml] = useState('');

  const { summary, deliveries, payments, projects, supplierPhone } = data;
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? '';
  const unit = summary?.booking.unit ? ` ${summary.booking.unit}` : '';

  const csv = useMemo(() => {
    if (!summary) return '';
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
    return [
      [t('item'), t('qtyLabel'), t('rateLabel'), t('totalLabel')].join(','),
      [summary.booking.item_name, `${formatQty(summary.booking.qty)}${unit}`, formatRupees(summary.booking.rate), formatRupees(summary.booking.total)].map(q).join(','),
      '',
      [t('deliveries'), t('date'), t('qtyLabel')].join(','),
      ...deliveries.map((d) => ['', dayjs(d.date).format('YYYY-MM-DD'), `${formatQty(d.qty)}${unit}`].map(q).join(',')),
      '',
      [t('payments'), t('date'), t('amount')].join(','),
      ...payments.map((p) => ['', dayjs(p.date).format('YYYY-MM-DD'), formatRupees(p.amount)].map(q).join(',')),
    ].join('\n');
  }, [summary, deliveries, payments, unit, t]);

  useEffect(() => {
    if (!summary || !company) return;
    let alive = true;
    const b = summary.booking;
    buildPurchaseOrderHtml(
      {
        company: { name: company.name, ownerName: company.owner_name, phone: company.phone },
        poNumber: poNumberOf(b.id),
        dateText: dayjs().format('DD MMM YYYY'),
        statusLabel: t(bookingStatusMeta(summary).labelKey),
        vendorName: b.supplier_name,
        vendorPhone: supplierPhone,
        deliverTo: summary.projectName,
        item: {
          name: b.item_name,
          qtyText: `${formatQty(b.qty)}${unit}`,
          receivedText: `${formatQty(summary.qtyReceived)}${unit}`,
          rateText: formatRupees(b.rate),
          amountText: formatRupees(b.total),
          fullyReceived: summary.qtyReceived >= b.qty - 0.001,
        },
        subtotalText: formatRupees(b.total),
        paidText: formatRupees(summary.paid),
        balanceText: formatRupees(summary.payRemaining),
        balanceDue: summary.payRemaining > 0.001,
        deliveries: deliveries.map((d) => ({
          dateText: dayjs(d.date).format('DD MMM YYYY'),
          label: projectName(d.project_id ?? b.project_id),
          valueText: `${formatQty(d.qty)}${unit}`,
        })),
        payments: payments.map((p) => ({
          dateText: dayjs(p.date).format('DD MMM YYYY'),
          label: p.description ?? '',
          valueText: formatRupees(p.amount),
        })),
        L: {
          purchaseOrder: t('purchaseOrder'),
          poNo: t('poNo'),
          date: t('date'),
          vendor: t('vendor'),
          deliverTo: t('deliverTo'),
          item: t('item'),
          qty: t('qtyLabel'),
          received: t('receivedQty'),
          rate: t('rateLabel'),
          amount: t('amount'),
          subtotal: t('subtotal'),
          paid: t('paidLabel'),
          balanceDue: t('balanceDue'),
          deliveries: t('deliveries'),
          payments: t('payments'),
          authorizedSignature: t('authorizedSignature'),
          madeWith: t('madeWith'),
        },
      },
      fontFamily,
      company.logo_uri
    )
      .then((h) => alive && setHtml(h))
      .catch(swallow('booking:po'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, deliveries, payments, company, fontFamily, supplierPhone]);

  return { html, csv, ready: !!html };
}
