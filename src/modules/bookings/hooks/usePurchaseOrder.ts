import dayjs from 'dayjs';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';

import type { PurchaseOrderSummary } from '@/db';
import { useTranslation } from '@/i18n';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { swallow } from '@/utils/log';
import { formatRupees } from '@/utils/money';
import { buildPurchaseOrderHtml } from '@/utils/reportPdf';
import { formatSplitQty } from '@/utils/units';

import { bookingUnit } from '../utils/unit';

export interface PurchaseOrderPdfActions {
  ready: boolean;
  busy: boolean;
  /** Open the native print preview (same as the project/settlement report). */
  preview: () => void;
  /** Share the PDF via the OS share sheet. */
  share: () => void;
}

/**
 * The multi-item Purchase Order PDF — built via the shared engine and shown with
 * the NATIVE print preview (Print.printAsync), the same way the project reports
 * do. Payments are intentionally excluded (a PO is the order, not the ledger).
 */
export function usePurchaseOrder(po: PurchaseOrderSummary | null, supplierPhone: string | null): PurchaseOrderPdfActions {
  const { t } = useTranslation();
  const company = useCompanyStore((st) => st.companies.find((c) => c.id === st.activeCompanyId) ?? null);
  const fontFamily = useSettingsStore((st) => st.fontFamily);
  const [busy, setBusy] = useState(false);

  const build = async (): Promise<string | null> => {
    if (!po || !company) return null;
    const line = (s: PurchaseOrderSummary['items'][number]) => {
      const unit = bookingUnit(s.booking);
      return {
        name: s.booking.item_name,
        qtyText: formatSplitQty(s.booking.qty, unit),
        receivedText: formatSplitQty(s.qtyReceived, unit),
        rateText: formatRupees(s.booking.rate),
        amountText: formatRupees(s.booking.total),
        fullyReceived: s.qtyRemaining <= 0.001,
      };
    };
    return buildPurchaseOrderHtml(
      {
        company: { name: company.name, ownerName: company.owner_name, phone: company.phone },
        poNumber: po.poNumber,
        dateText: dayjs(po.createdAt).format('DD MMM YYYY'),
        statusLabel: t(po.status === 'CANCELLED' ? 'statusCancelled' : po.status === 'CLOSED' ? 'statusDone' : 'statusOrdered'),
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
          itemsLabel: t('items'),
          authorizedSignature: t('authorizedSignature'),
          madeWith: t('madeWith'),
        },
      },
      fontFamily,
      company.logo_uri
    );
  };

  const preview = () => {
    setBusy(true);
    void build()
      .then((html) => {
        if (html) return Print.printAsync({ html });
      })
      .catch(swallow('po:preview'))
      .finally(() => setBusy(false));
  };

  const share = () => {
    setBusy(true);
    void build()
      .then(async (html) => {
        if (!html) return;
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: po?.poNumber });
        }
      })
      .catch(swallow('po:share'))
      .finally(() => setBusy(false));
  };

  return { ready: !!po && !!company, busy, preview, share };
}
