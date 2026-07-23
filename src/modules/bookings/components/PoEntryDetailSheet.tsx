import React from 'react';
import { View } from 'react-native';

import { AppButton, AppSheet, AppText, LabelValueRow } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { formatDisplayDate } from '@/utils/date';
import { formatRupees } from '@/utils/money';
import { formatSplitQty, type UnitDef } from '@/utils/units';

import type { PoHistoryEntry } from '../hooks/useBookings';

interface Props {
  visible: boolean;
  onClose: () => void;
  entry: PoHistoryEntry | null;
  unit: UnitDef;
  /** Receiving project name when the delivery went to a different project. */
  destinationName: string | null;
  onEditDelivery: () => void;
  onEditPayment: () => void;
  onDelete: () => void;
}

/**
 * One history entry's detail: a delivery, a payment, or a combined receive-and-
 * pay (both, in one row). Each part is separately editable; a delivery / combined
 * entry can also be removed (a combined delete voids the paired payment too).
 */
export function PoEntryDetailSheet({ visible, onClose, entry, unit, destinationName, onEditDelivery, onEditPayment, onDelete }: Props): React.JSX.Element | null {
  const theme = useTheme();
  const { t } = useTranslation();
  if (!entry) return null;

  const { kind, delivery, payment, itemName } = entry;
  const title = kind === 'both' ? t('receivedAndPaid') : kind === 'delivery' ? t('receivedQty') : t('payBookingLabel');
  const note = delivery?.note ?? payment?.description ?? null;
  const canDelete = kind !== 'payment'; // a standalone payment is edited, not deleted

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={
        <View style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            {delivery ? (
              <View style={{ flex: 1 }}>
                <AppButton label={kind === 'both' ? t('editDelivery') : t('edit')} icon="edit" variant="secondary" onPress={onEditDelivery} />
              </View>
            ) : null}
            {payment ? (
              <View style={{ flex: 1 }}>
                <AppButton label={kind === 'both' ? t('editPayment') : t('edit')} icon="edit" variant="secondary" onPress={onEditPayment} />
              </View>
            ) : null}
          </View>
          {canDelete ? <AppButton label={t('delete')} icon="trash" variant="danger" onPress={onDelete} /> : null}
        </View>
      }
    >
      <LabelValueRow label={t('item')} value={itemName} />
      {delivery ? <LabelValueRow label={t('receivedQty')} value={formatSplitQty(delivery.qty, unit)} valueColor="success" /> : null}
      {payment ? <LabelValueRow label={t('paidLabel')} value={formatRupees(payment.amount)} valueColor="danger" /> : null}
      <LabelValueRow label={t('date')} value={formatDisplayDate(entry.date)} />
      {destinationName ? <LabelValueRow label={t('deliverToProject')} value={destinationName} /> : null}
      {note ? (
        <View style={{ gap: theme.spacing.xs }}>
          <AppText size="xs" weight="semibold" color="textSecondary">
            {t('note')}
          </AppText>
          <AppText size="sm">{note}</AppText>
        </View>
      ) : null}
    </AppSheet>
  );
}
