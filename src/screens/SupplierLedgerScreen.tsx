import { type RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppCard, AppHeader, AppListRow, AppText, type EntryDirection } from '@/components/ui';
import {
  type CategoryRow,
  getParty,
  getPayable,
  listCategories,
  listPartyTransactions,
  type PartyRow,
  type TransactionRow,
} from '@/db';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatPakistaniGrouping, formatRupees } from '@/utils/money';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type LedgerRoute = RouteProp<RootStackParamList, 'SupplierLedger'>;

const UDHAAR_PAYMENT_EN = 'Udhaar Payment';

export function SupplierLedgerScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { partyId } = useRoute<LedgerRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [party, setParty] = useState<PartyRow | null>(null);
  const [txns, setTxns] = useState<TransactionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [payable, setPayable] = useState(0);

  const load = useCallback(async () => {
    const [p, rows, cats, pay] = await Promise.all([
      getParty(partyId),
      listPartyTransactions(partyId),
      listCategories(),
      getPayable(partyId),
    ]);
    setParty(p);
    setTxns(rows);
    setCategories(cats);
    setPayable(pay);
  }, [partyId]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  const udhaarPaymentCatId = categories.find((c) => c.name_en === UDHAAR_PAYMENT_EN)?.id ?? null;
  const catName = (id: string | null) => {
    if (!id) return '';
    const c = categories.find((x) => x.id === id);
    return c ? (language === 'ur' ? c.name_ur : c.name_en) : '';
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={party?.name ?? t('supplierLedger')} onBack={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        {/* Payable balance */}
        <View style={styles.payableCard}>
          <AppText size="overline" weight="semibold" color="onPrimaryMuted" uppercase>
            {t('payable')}
          </AppText>
          <AppText size="display" weight="bold" color="onHero" tabular numberOfLines={1} adjustsFontSizeToFit>
            {formatRupees(payable)}
          </AppText>
        </View>

        <AppText size="lg" weight="bold">
          {t('purchases')} & {t('payments')}
        </AppText>
        <AppCard compact>
          {txns.map((txn, i) => {
            const isPayment = txn.category_id === udhaarPaymentCatId;
            const dir: EntryDirection = isPayment ? 'in' : 'out';
            return (
              <View key={txn.id}>
                {i > 0 ? <View style={styles.divider} /> : null}
                <AppListRow
                  title={isPayment ? t('payments') : catName(txn.category_id) || t('purchases')}
                  subtitle={`${txn.description ? `${txn.description} · ` : ''}${dayjs(txn.date).format('DD MMM')}`}
                  icon={isPayment ? 'aamdani' : 'material'}
                  amount={formatPakistaniGrouping(txn.amount)}
                  direction={dir}
                />
              </View>
            );
          })}
          {txns.length === 0 ? (
            <AppText size="sm" color="textSecondary" center style={styles.empty}>
              {t('noUdhaar')}
            </AppText>
          ) : null}
        </AppCard>
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    payableCard: {
      backgroundColor: theme.colors.heroBg,
      borderRadius: theme.radius.hero,
      padding: theme.spacing.xl,
      gap: theme.spacing.xs,
      ...theme.shadows.card,
    },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginLeft: 56 },
    empty: { paddingVertical: theme.spacing.xl },
  });
