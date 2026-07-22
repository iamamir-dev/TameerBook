import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';

import type { PurchaseOrderSummary } from '@/db';
import { useTranslation } from '@/i18n';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { swallow } from '@/utils/log';
import { formatQty, formatRupees } from '@/utils/money';
import { buildPurchaseOrderHtml } from '@/utils/reportPdf';

/**
 * Builds the modern multi-item Purchase Order PDF (html + csv) for the preview.
 * A PO is the ORDER, so payments are intentionally left out of the document.
 */
export function usePurchaseOrder(
  po: PurchaseOrderSummary | null,
  supplierPhone: string | null
): { html: string; csv: string; ready: boolean } {
  const { t } = useTranslation();
  const company = useCompanyStore((st) => st.companies.find((c) => c.id === st.activeCompanyId) ?? null);
  const fontFamily = useSettingsStore((st) => st.fontFamily);
  const [html, setHtml] = useState('');

  const line = (s: PurchaseOrderSummary['items'][number]) => {
    const unit = s.booking.unit ? ` ${s.booking.unit}` : '';
    return {
      name: s.booking.item_name,
      qtyText: `${formatQty(s.booking.qty)}${unit}`,
      receivedText: `${formatQty(s.qtyReceived)}${unit}`,
      rateText: formatRupees(s.booking.rate),
      amountText: formatRupees(s.booking.total),
      fullyReceived: s.qtyRemaining <= 0.001,
    };
  };

  const csv = useMemo(() => {
    if (!po) return '';
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
    return [
      [t('item'), t('qtyLabel'), t('receivedQty'), t('rateLabel'), t('totalLabel')].join(','),
      ...po.items.map((s) => {
        const l = line(s);
        return [l.name, l.qtyText, l.receivedText, l.rateText, l.amountText].map(q).join(',');
      }),
      ['', '', '', q(t('totalLabel')), q(formatRupees(po.total))].join(','),
    ].join('\n');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [po, t]);

  useEffect(() => {
    if (!po || !company) return;
    let alive = true;
    buildPurchaseOrderHtml(
      {
        company: { name: company.name, ownerName: company.owner_name, phone: company.phone },
        poNumber: po.poNumber,
        dateText: dayjs(po.createdAt).format('DD MMM YYYY'),
        statusLabel: t(
          po.status === 'CANCELLED' ? 'statusCancelled' : po.status === 'CLOSED' ? 'statusDone' : 'statusOrdered'
        ),
        vendorName: po.supplierName,
        vendorPhone: supplierPhone,
        deliverTo: po.projectName,
        items: po.items.map(line),
        totalText: formatRupees(po.total),
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
          total: t('totalLabel'),
          authorizedSignature: t('authorizedSignature'),
          madeWith: t('madeWith'),
        },
      },
      fontFamily,
      company.logo_uri
    )
      .then((h) => alive && setHtml(h))
      .catch(swallow('po:pdf'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [po, company, fontFamily, supplierPhone]);

  return { html, csv, ready: !!html };
}
