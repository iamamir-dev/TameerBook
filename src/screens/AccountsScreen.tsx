import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import {
  AccountCard,
  AmountInput,
  AppButton,
  AppHeader,
  AppText,
} from '@/components/ui';
import {
  addAccount,
  getTotalBalance,
  listAccountsWithBalance,
  type AccountType,
  type AccountWithBalance,
} from '@/db';
import { useFocusReload, useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatRupees } from '@/utils/money';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ACCOUNT_TYPES: AccountType[] = ['BANK', 'CASH', 'WALLET'];

/**
 * All the places money lives: every active account with its live balance,
 * the grand total up top, plus transfer + add-account actions.
 */
export function AccountsScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [total, setTotal] = useState(0);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<AccountType>('BANK');
  const [newOpening, setNewOpening] = useState(0);

  const loadData = useCallback(async () => {
    const [tot, accs] = await Promise.all([getTotalBalance(), listAccountsWithBalance()]);
    setTotal(tot);
    setAccounts(accs);
  }, []);

  const { reload } = useFocusReload(loadData);
  const { saving, run: runSave } = useSaveAction();

  const typeLabel = (type: AccountType) =>
    t(type === 'BANK' ? 'accountBank' : type === 'CASH' ? 'accountCash' : 'accountWallet');

  const onAddAccount = async () => {
    const name = newName.trim();
    if (!name) return;
    const ok = await runSave(async () => {
      await addAccount({ name, type: newType, openingBalance: newOpening });
    });
    if (!ok) return;
    await reload();
    setNewName('');
    setNewType('BANK');
    setNewOpening(0);
    setAddOpen(false);
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={t('accountsTitle')} onBack={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        {/* Grand total across every account */}
        <View style={styles.hero}>
          <AppText size="overline" weight="semibold" color="textSecondary" uppercase>
            {t('totalBalance')}
          </AppText>
          <AppText size="display" weight="bold" color="primary" tabular numberOfLines={1} adjustsFontSizeToFit>
            {formatRupees(total)}
          </AppText>
        </View>

        {/* Full-width account cards */}
        {accounts.map((a) => (
          <AccountCard
            key={a.id}
            name={a.name}
            type={a.type}
            balance={a.balance}
            typeLabel={typeLabel(a.type)}
            onPress={() => navigation.navigate('AccountDetail', { accountId: a.id })}
          />
        ))}

        <AppButton
          label={t('transferTitleV2')}
          icon="netFlow"
          variant="secondary"
          onPress={() => navigation.navigate('Transfer')}
        />
        <AppButton label={t('addAccount')} icon="add" onPress={() => setAddOpen(true)} />
      </ScrollView>

      {/* Add-account bottom sheet */}
      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <Pressable style={styles.backdrop} onPress={() => setAddOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText size="lg" weight="bold">
            {t('addAccount')}
          </AppText>

          <FloatingLabelInput label={t('accountName')} value={newName} onChangeText={setNewName} />

          {/* Account type chips */}
          <View style={styles.typeRow}>
            {ACCOUNT_TYPES.map((type) => {
              const selected = type === newType;
              return (
                <Pressable
                  key={type}
                  onPress={() => setNewType(type)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.typeChip, selected && styles.typeChipActive]}
                >
                  <AppText size="sm" weight="semibold" center color={selected ? 'accent' : 'textSecondary'}>
                    {typeLabel(type)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          <AmountInput
            floating
            surface={theme.colors.card}
            label={t('openingBalance')}
            value={newOpening}
            onChange={setNewOpening}
          />

          <AppButton
            label={t('save')}
            icon="check"
            onPress={onAddAccount}
            loading={saving}
            disabled={!newName.trim()}
          />
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    hero: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.hero,
      padding: theme.spacing.xl,
      gap: theme.spacing.xs,
      ...theme.shadows.card,
    },
    typeRow: { flexDirection: 'row', gap: theme.spacing.sm },
    typeChip: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: theme.touch.minTarget,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      paddingHorizontal: theme.spacing.sm,
    },
    typeChipActive: {
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.accentSoft,
    },
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
  });
