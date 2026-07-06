import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AmountInput,
  AppButton,
  AppCard,
  AppHeader,
  AppIcon,
  AppText,
  EmptyState,
} from '@/components/ui';
import {
  listSupplierPayables,
  type PaymentMode,
  recordUdhaarPayment,
  type SupplierPayable,
} from '@/db';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PAY_MODES: { mode: PaymentMode; labelKey: TranslationKey }[] = [
  { mode: 'CASH', labelKey: 'modeCash' },
  { mode: 'BANK', labelKey: 'modeBank' },
  { mode: 'JAZZCASH', labelKey: 'modeJazzcash' },
];

export function UdhaarScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const refreshProjects = useProjectsStore((s) => s.refresh);

  const [items, setItems] = useState<SupplierPayable[]>([]);
  const [paying, setPaying] = useState<SupplierPayable | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMode, setPayMode] = useState<PaymentMode>('CASH');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setItems(await listSupplierPayables());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  const openPay = (s: SupplierPayable) => {
    setPaying(s);
    setPayAmount(s.payable);
    setPayMode('CASH');
  };

  const onPay = async () => {
    if (!paying || payAmount <= 0) return;
    setBusy(true);
    try {
      await recordUdhaarPayment({
        partyId: paying.id,
        amount: payAmount,
        date: todayISO().slice(0, 10),
        mode: payMode,
      });
      await Promise.all([load(), refreshProjects()]);
      setPaying(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={t('udhaar')} onBack={() => navigation.goBack()} />

      {items.length === 0 ? (
        <EmptyState icon="investor" title={t('noUdhaar')} message={t('noUdhaarDetail')} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
        >
          {items.map((s) => (
            <AppCard key={s.id} style={styles.card} onPress={() => navigation.navigate('SupplierLedger', { partyId: s.id })}>
              <View style={styles.cardRow}>
                <View style={styles.iconChip}>
                  <AppIcon name="investor" size={22} color="danger" />
                </View>
                <View style={styles.flex}>
                  <AppText size="md" weight="bold" numberOfLines={1}>
                    {s.name}
                  </AppText>
                  {s.phone ? (
                    <AppText size="xs" color="textSecondary">
                      {s.phone}
                    </AppText>
                  ) : null}
                </View>
                <View style={styles.payableBox}>
                  <AppText size="xs" color="textSecondary">
                    {t('payable')}
                  </AppText>
                  <AppText size="md" weight="bold" color="danger" tabular>
                    {formatRupees(s.payable)}
                  </AppText>
                </View>
              </View>
              <AppButton label={t('payNow')} icon="moneyOut" onPress={() => openPay(s)} />
            </AppCard>
          ))}
        </ScrollView>
      )}

      {/* Payment sheet */}
      <Modal visible={paying !== null} transparent animationType="fade" onRequestClose={() => setPaying(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPaying(null)} />
        {paying ? (
          <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
            <View style={styles.grabber} />
            <AppText size="lg" weight="bold">
              {paying.name}
            </AppText>
            <AppText size="sm" color="textSecondary">
              {t('payable')}: {formatRupees(paying.payable)}
            </AppText>

            <AmountInput value={payAmount} onChange={setPayAmount} />

            <View style={styles.modeRow}>
              {PAY_MODES.map((m) => {
                const active = m.mode === payMode;
                return (
                  <Pressable
                    key={m.mode}
                    onPress={() => setPayMode(m.mode)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.modeBtn, active && styles.modeBtnActive]}
                  >
                    <AppText size="sm" weight="bold" color={active ? 'onPrimary' : 'textSecondary'}>
                      {t(m.labelKey)}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            <AppButton label={t('payNow')} icon="check" onPress={onPay} loading={busy} />
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    card: { gap: theme.spacing.md },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    iconChip: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.chip,
      backgroundColor: theme.colors.dangerSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    payableBox: { alignItems: 'flex-end' },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.overlay },
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
    grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: theme.radius.pill, backgroundColor: theme.colors.track },
    modeRow: { flexDirection: 'row', gap: theme.spacing.sm },
    modeBtn: {
      flex: 1,
      minHeight: theme.touch.minTarget,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.background,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
    },
    modeBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  });
