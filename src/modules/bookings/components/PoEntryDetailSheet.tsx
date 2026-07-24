import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon, AppSheet, AppText, LabelValueRow } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatDisplayDate } from '@/utils/date';
import { formatRupees } from '@/utils/money';
import { formatSplitQty, type UnitDef } from '@/utils/units';

import type { PoHistoryEntry } from '../hooks/useBookings';

interface Props {
  visible: boolean;
  onClose: () => void;
  entry: PoHistoryEntry | null;
  unitFor: (bookingId: string) => UnitDef;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * One history batch, laid out like the shared transaction detail: an amount
 * hero, an accent "Details" section, then a per-item breakdown and any notes —
 * with compact Edit / Delete actions that apply to the whole entry.
 */
export function PoEntryDetailSheet({ visible, onClose, entry, unitFor, onEdit, onDelete }: Props): React.JSX.Element | null {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  if (!entry) return null;

  const title = entry.kind === 'both' ? t('receivedAndPaid') : entry.kind === 'delivery' ? t('receivedQty') : t('payBookingLabel');
  const deliveryNote = entry.deliveries.find((d) => d.note)?.note ?? null;
  const paymentNote = entry.payments.find((p) => p.description)?.description ?? null;
  const single = entry.itemCount === 1;
  const soleDelivery = single ? entry.deliveries[0] : null;

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      footer={
        <View style={styles.actions}>
          <Pressable onPress={onEdit} accessibilityRole="button" style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.pressed]}>
            <AppIcon name="edit" size={15} color="textPrimary" />
            <AppText size="sm" weight="bold">{t('edit')}</AppText>
          </Pressable>
          <Pressable onPress={onDelete} accessibilityRole="button" style={({ pressed }) => [styles.btn, styles.btnDanger, pressed && styles.pressed]}>
            <AppIcon name="trash" size={15} color="danger" />
            <AppText size="sm" weight="bold" color="danger">{t('delete')}</AppText>
          </Pressable>
        </View>
      }
    >
      {/* Amount hero — money when paid, else the received quantity. */}
      {entry.totalPaid > 0 ? (
        <AppText size="xxl" weight="bold" tabular color="danger">
          {`− ${formatRupees(entry.totalPaid)}`}
        </AppText>
      ) : soleDelivery ? (
        <AppText size="xxl" weight="bold" tabular color="success">
          {`+ ${formatSplitQty(soleDelivery.qty, unitFor(entry.bookingIds[0]))}`}
        </AppText>
      ) : (
        <AppText size="xxl" weight="bold" color="success">
          {`${entry.itemCount} ${t('items')}`}
        </AppText>
      )}
      <AppText size="md" weight="semibold">{title}</AppText>

      <View style={styles.divider} />

      {/* Details */}
      <AppText size="sm" weight="bold" color="accent">
        {t('detailsSection')}
      </AppText>
      <LabelValueRow label={t('date')} value={formatDisplayDate(entry.date)} />

      {single ? (
        // A single item reads as plain detail rows (the hero already leads).
        <>
          {soleDelivery ? (
            <LabelValueRow label={t('receivedQty')} value={formatSplitQty(soleDelivery.qty, unitFor(entry.bookingIds[0]))} valueColor="success" />
          ) : null}
          {entry.payments[0] ? (
            <LabelValueRow label={t('paidLabel')} value={formatRupees(entry.payments[0].amount)} valueColor="danger" />
          ) : null}
        </>
      ) : (
        // Multiple items: a dedicated section with a per-item card + total.
        <>
          <View style={styles.divider} />
          <View style={styles.sectionHead}>
            <AppText size="sm" weight="bold" color="accent">{t('items')}</AppText>
            <AppText size="xs" weight="semibold" color="textSecondary">{`${entry.itemCount}`}</AppText>
          </View>
          <View style={styles.card}>
            {entry.bookingIds.map((bid, idx) => {
              const d = entry.deliveries.find((x) => x.booking_id === bid) ?? null;
              const p = entry.payments.find((x) => x.booking_id === bid) ?? null;
              const name = d?.itemName ?? p?.itemName ?? '';
              const unit = unitFor(bid);
              return (
                <View key={bid} style={[styles.itemRow, idx > 0 && styles.ruled]}>
                  <AppText size="sm" weight="semibold" numberOfLines={1} style={styles.flex}>
                    {name}
                  </AppText>
                  <View style={styles.amounts}>
                    {d ? (
                      <AppText size="sm" weight="bold" color="success" tabular>
                        {`+ ${formatSplitQty(d.qty, unit)}`}
                      </AppText>
                    ) : null}
                    {p ? (
                      <AppText size="sm" weight="bold" color="danger" tabular>
                        {`− ${formatRupees(p.amount)}`}
                      </AppText>
                    ) : null}
                  </View>
                </View>
              );
            })}
            {/* Total sits inside the card so it lines up with the item amounts. */}
            {entry.totalPaid > 0 ? (
              <View style={[styles.itemRow, styles.ruled]}>
                <AppText size="md" weight="bold" style={styles.flex}>{t('totalLabel')}</AppText>
                <AppText size="lg" weight="bold" color="danger" tabular>{formatRupees(entry.totalPaid)}</AppText>
              </View>
            ) : null}
          </View>
        </>
      )}

      {/* Notes — each kept separate. */}
      {deliveryNote || paymentNote ? <View style={styles.divider} /> : null}
      {deliveryNote ? (
        <View style={styles.noteWrap}>
          <AppText size="xs" weight="semibold" color="textSecondary">{t('deliveryNote')}</AppText>
          <AppText size="sm">{deliveryNote}</AppText>
        </View>
      ) : null}
      {paymentNote ? (
        <View style={styles.noteWrap}>
          <AppText size="xs" weight="semibold" color="textSecondary">{t('paymentNote')}</AppText>
          <AppText size="sm">{paymentNote}</AppText>
        </View>
      ) : null}
    </AppSheet>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginVertical: theme.spacing.sm },
    sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    flex: { flex: 1 },
    card: { backgroundColor: theme.colors.background, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.sm },
    ruled: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
    amounts: { alignItems: 'flex-end', gap: 2 },
    noteWrap: { gap: theme.spacing.xs, marginTop: theme.spacing.xs },
    actions: { flexDirection: 'row', gap: theme.spacing.sm },
    btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs, height: 40, paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.sm },
    btnSecondary: { flex: 1, backgroundColor: theme.colors.card },
    btnDanger: { flex: 1, backgroundColor: theme.colors.dangerSoft },
    pressed: { opacity: 0.6 },
  });
