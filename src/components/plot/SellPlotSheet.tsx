import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { AmountInput, AppButton, AppIcon, AppText, DateField, SelectSheet } from '@/components/ui';
import {
  addPlotSaleReceipt,
  PAY_TYPE_LABEL_KEYS,
  PAY_TYPES,
  setPlotSale,
  type AccountWithBalance,
  type PayType,
  type PlotSummary,
} from '@/db';
import { useAccountOptions, useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';

/** Which form the sheet shows: agree the deal, or receive buyer money. */
export type SellPlotSheetMode = 'price' | 'receipt';

interface SellPlotSheetProps {
  visible: boolean;
  mode: SellPlotSheetMode;
  onClose: () => void;
  /** The plot being flipped (must NOT belong to a project — repo guard). */
  summary: PlotSummary;
  accounts: AccountWithBalance[];
  /** Reload the screen's data after the write lands. */
  onSaved: () => Promise<void>;
}

/**
 * Bottom sheet for the STANDALONE plot sale (a flip without a project):
 * `price` mode records the agreed sale price + buyer via `setPlotSale`;
 * `receipt` mode posts buyer money via `addPlotSaleReceipt` (pay-type chips +
 * amount + receiving account). Receipts are capped at the outstanding amount;
 * the plot flips to SOLD automatically once fully received.
 */
export function SellPlotSheet({
  visible,
  mode,
  onClose,
  summary,
  accounts,
  onSaved,
}: SellPlotSheetProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const { saving, run: runSave } = useSaveAction();

  const { plot } = summary;

  // Price form
  const [price, setPrice] = useState(0);
  const [buyer, setBuyer] = useState('');

  // Receipt form
  const [amount, setAmount] = useState(0);
  const [payType, setPayType] = useState<PayType | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO().slice(0, 10));
  const [accountSheet, setAccountSheet] = useState(false);

  // Fresh form per open; the account keeps its last choice (default: first).
  const summaryRef = useRef(summary);
  summaryRef.current = summary;
  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;
  useEffect(() => {
    if (!visible) return;
    setPrice(summaryRef.current.salePrice);
    setBuyer(summaryRef.current.plot.buyer_name ?? '');
    setAmount(0);
    setPayType(null);
    setDate(todayISO().slice(0, 10));
    setAccountId((prev) => prev ?? accountsRef.current[0]?.id ?? null);
  }, [visible, mode]);

  const accountOptions = useAccountOptions(accounts);
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null;

  const onSavePrice = async () => {
    if (price <= 0 || saving) return;
    const ok = await runSave(async () => {
      await setPlotSale({ plotId: plot.id, salePrice: price, buyerName: buyer.trim() || null });
    });
    if (!ok) return;
    onClose();
    await onSaved();
  };

  const onSaveReceipt = async () => {
    if (amount <= 0 || !accountId || saving) return;
    const ok = await runSave(async () => {
      await addPlotSaleReceipt({
        plotId: plot.id,
        amount,
        date,
        accountId,
        payType,
      });
    });
    if (!ok) return;
    onClose();
    await onSaved();
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.backdrop} onPress={onClose} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
            <View style={styles.grabber} />
            <AppText size="lg" weight="bold">
              {mode === 'price' ? t('sellPlot') : t('addReceipt')}
            </AppText>

            {mode === 'price' ? (
              <>
                <AmountInput
                  label={t('salePriceLabel')}
                  value={price}
                  onChange={setPrice}
                  floating
                  surface={theme.colors.card}
                />
                <FloatingLabelInput label={t('buyerName')} value={buyer} onChangeText={setBuyer} />
                <AppButton
                  label={t('save')}
                  icon="check"
                  onPress={onSavePrice}
                  loading={saving}
                  disabled={price <= 0}
                />
              </>
            ) : (
              <>
                {/* Pay-type chips (optional tag on the receipt) */}
                <View style={styles.chipRow}>
                  {PAY_TYPES.map((pt) => {
                    const selected = payType === pt;
                    return (
                      <Pressable
                        key={pt}
                        onPress={() => setPayType(selected ? null : pt)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        style={[styles.modeBtn, selected && styles.modeBtnActive]}
                      >
                        <AppText
                          size="sm"
                          weight={selected ? 'bold' : 'semibold'}
                          color={selected ? 'accent' : 'textSecondary'}
                        >
                          {t(PAY_TYPE_LABEL_KEYS[pt])}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>

                <AmountInput value={amount} onChange={setAmount} floating surface={theme.colors.card} />

                <Pressable
                  onPress={() => setAccountSheet(true)}
                  style={styles.rowChip}
                  accessibilityRole="button"
                >
                  <AppIcon
                    name={selectedAccount?.type === 'BANK' ? 'bank' : 'balance'}
                    size={18}
                    color="primary"
                  />
                  <AppText
                    size="sm"
                    weight="semibold"
                    numberOfLines={1}
                    style={styles.flex}
                    color={selectedAccount ? 'textPrimary' : 'textSecondary'}
                  >
                    {selectedAccount
                      ? `${selectedAccount.name} · ${formatRupees(selectedAccount.balance)}`
                      : t('selectAccount')}
                  </AppText>
                  <AppIcon name="forward" size={18} color="textSecondary" />
                </Pressable>

                <DateField value={date} onChange={setDate} />

                <AppButton
                  label={t('save')}
                  icon="check"
                  onPress={onSaveReceipt}
                  loading={saving}
                  disabled={amount <= 0 || !accountId || amount > summary.saleOutstanding}
                />
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <SelectSheet
        visible={accountSheet}
        onClose={() => setAccountSheet(false)}
        options={accountOptions}
        selectedId={accountId ?? undefined}
        title={t('selectAccount')}
        searchable={false}
        onSelect={(o) => setAccountId(o.id)}
      />
    </>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    modeBtn: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    modeBtnActive: {
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.accentSoft,
    },
    rowChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.lg,
      minHeight: theme.touch.minTarget,
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.overlay,
    },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: theme.radius.hero,
      borderTopRightRadius: theme.radius.hero,
      padding: theme.spacing.xl,
      gap: theme.spacing.md,
      ...theme.shadows.raised,
    },
    grabber: {
      alignSelf: 'center',
      width: 44,
      height: 5,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.track,
    },
  });
