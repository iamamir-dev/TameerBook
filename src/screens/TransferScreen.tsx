import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import {
  AmountInput,
  AppButton,
  StickyFooter,
  AppHeader,
  AppIcon,
  AppText,
  SelectSheet,
  type IconKey,
  type SelectOption,
} from '@/components/ui';
import {
  listAccountsWithBalance,
  transferBetween,
  type AccountWithBalance,
} from '@/db';
import { useFocusReload, useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type TransferRoute = RouteProp<RootStackParamList, 'Transfer'>;

const accountIcon = (a: AccountWithBalance): IconKey =>
  a.type === 'BANK' ? 'bank' : a.type === 'CASH' ? 'rupee' : 'balance';

/**
 * Move money between two accounts. Neither income nor expense  the total
 * balance is unchanged; the ledger records a linked OUT + IN pair.
 */
export function TransferScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<TransferRoute>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  // Opened from a specific account? Start the transfer FROM that account.
  const [fromId, setFromId] = useState<string | null>(route.params?.fromAccountId ?? null);
  const [toId, setToId] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const [fromSheet, setFromSheet] = useState(false);
  const [toSheet, setToSheet] = useState(false);

  const date = todayISO().slice(0, 10);

  const load = useCallback(async () => {
    setAccounts(await listAccountsWithBalance());
  }, []);

  useFocusReload(load);
  const { saving, run: runSave } = useSaveAction();

  const accountOptions: SelectOption[] = useMemo(
    () =>
      accounts.map((a) => ({
        id: a.id,
        label: a.name,
        subtitle: formatRupees(a.balance),
        icon: accountIcon(a),
      })),
    [accounts]
  );

  const fromAccount = accounts.find((a) => a.id === fromId) ?? null;
  const toAccount = accounts.find((a) => a.id === toId) ?? null;

  const canSave = Boolean(
    fromId &&
    toId &&
    fromId !== toId &&
    amount > 0 &&
    (!fromAccount || amount <= fromAccount.balance)
  );

  const onSave = async () => {
    if (!canSave || !fromId || !toId) return;
    const ok = await runSave(async () => {
      await transferBetween({
        fromAccountId: fromId,
        toAccountId: toId,
        amount,
        date,
        note: note.trim() || null,
      });
    });
    if (!ok) return;
    navigation.goBack();
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={t('transferTitleV2')} onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: theme.spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* From account */}
          <Pressable onPress={() => setFromSheet(true)} style={styles.rowChip} accessibilityRole="button">
            <AppIcon name={fromAccount ? accountIcon(fromAccount) : 'moneyOut'} size={18} color="primary" />
            <AppText
              size="sm"
              weight="semibold"
              numberOfLines={1}
              style={styles.flex}
              color={fromAccount ? 'textPrimary' : 'textSecondary'}
            >
              {fromAccount ? `${fromAccount.name} · ${formatRupees(fromAccount.balance)}` : t('fromAccount')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          {/* To account */}
          <Pressable onPress={() => setToSheet(true)} style={styles.rowChip} accessibilityRole="button">
            <AppIcon name={toAccount ? accountIcon(toAccount) : 'moneyIn'} size={18} color="primary" />
            <AppText
              size="sm"
              weight="semibold"
              numberOfLines={1}
              style={styles.flex}
              color={toAccount ? 'textPrimary' : 'textSecondary'}
            >
              {toAccount ? `${toAccount.name} · ${formatRupees(toAccount.balance)}` : t('toAccount')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          {/* Amount */}
          <AmountInput value={amount} onChange={setAmount} autoFocus />

          {/* Note (optional) */}
          <FloatingLabelInput label={t('note')} value={note} onChangeText={setNote} />

        </ScrollView>

        <StickyFooter>
          <AppButton label={t('save')} icon="check" onPress={onSave} loading={saving} disabled={!canSave} />
        </StickyFooter>
      </KeyboardAvoidingView>

      {/* Sheets */}
      <SelectSheet
        visible={fromSheet}
        onClose={() => setFromSheet(false)}
        options={accountOptions}
        selectedId={fromId ?? undefined}
        title={t('fromAccount')}
        searchable={false}
        onSelect={(o) => setFromId(o.id)}
      />
      <SelectSheet
        visible={toSheet}
        onClose={() => setToSheet(false)}
        options={accountOptions}
        selectedId={toId ?? undefined}
        title={t('toAccount')}
        searchable={false}
        onSelect={(o) => setToId(o.id)}
      />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
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
  });
