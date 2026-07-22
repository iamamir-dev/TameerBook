import React from 'react';
import { View } from 'react-native';

import { AppButton, AppSheet, AppText, LabelValueRow } from '@/components/ui';
import type { MaterialDeliveryRow } from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { formatDisplayDate } from '@/utils/date';
import { formatSplitQty, type UnitDef } from '@/utils/units';

interface Props {
  visible: boolean;
  onClose: () => void;
  delivery: MaterialDeliveryRow | null;
  unit: UnitDef;
  /** Receiving project name when the delivery went to a different project. */
  destinationName: string | null;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * One delivery's detail: quantity received, date, where it landed and any note —
 * with a Remove action for a wrong entry (mirrors the payment detail drawer).
 */
export function DeliveryDetailSheet({ visible, onClose, delivery, unit, destinationName, onEdit, onDelete }: Props): React.JSX.Element | null {
  const theme = useTheme();
  const { t } = useTranslation();
  if (!delivery) return null;

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title={t('receivedQty')}
      footer={
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <AppButton label={t('edit')} icon="edit" variant="secondary" onPress={onEdit} />
          </View>
          <View style={{ flex: 1 }}>
            <AppButton label={t('delete')} icon="trash" variant="danger" onPress={onDelete} />
          </View>
        </View>
      }
    >
      <LabelValueRow label={t('receivedQty')} value={formatSplitQty(delivery.qty, unit)} valueColor="success" />
      <LabelValueRow label={t('date')} value={formatDisplayDate(delivery.date)} />
      {destinationName ? <LabelValueRow label={t('deliverToProject')} value={destinationName} /> : null}
      {delivery.note ? (
        <View style={{ gap: theme.spacing.xs }}>
          <AppText size="xs" weight="semibold" color="textSecondary">
            {t('note')}
          </AppText>
          <AppText size="sm">{delivery.note}</AppText>
        </View>
      ) : null}
    </AppSheet>
  );
}
