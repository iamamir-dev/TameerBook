import {
  type RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import {
  AmountInput,
  AppButton,
  AppHeader,
  AppIcon,
  AppText,
  ICONS,
  SelectSheet,
  StickyFooter,
  type IconKey,
  type SelectOption,
} from '@/components/ui';
import {
  addDocument,
  addParty,
  addTransaction,
  type AccountWithBalance,
  type CategoryRow,
  type CategoryType,
  isInsufficientFunds,
  listAccountsWithBalance,
  listCategories,
  listParties,
  type PartyRow,
} from '@/db';
import { SYSTEM_CATEGORY_NAMES } from '@/db/schema';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useEntryStore } from '@/stores/useEntryStore';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';
import { captureReceipt } from '@/utils/photo';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type EntryRoute = RouteProp<RootStackParamList, 'Entry'>;

const ADD_PARTY_ID = '__add__';
const NO_PROJECT_ID = '__none__';
const SYSTEM_CATS = new Set<string>(SYSTEM_CATEGORY_NAMES);

/**
 * The generic income/expense entry. Every entry posts to an ACCOUNT (the
 * cash-flow source of truth); linking a project is optional  personal /
 * general money works too.
 */
export function EntryScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { direction, prefill } = useRoute<EntryRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const projects = useProjectsStore((s) => s.items);
  const refreshProjects = useProjectsStore((s) => s.refresh);
  const lastProjectId = useEntryStore((s) => s.lastProjectId);
  const setLastProjectId = useEntryStore((s) => s.setLastProjectId);
  const lastAccountId = useEntryStore((s) => s.lastAccountId);
  const setLastAccountId = useEntryStore((s) => s.setLastAccountId);

  const catType: CategoryType = direction === 'OUT' ? 'EXPENSE' : 'INCOME';

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);

  const [projectId, setProjectId] = useState<string | null>(prefill?.projectId ?? null);
  const [amount, setAmount] = useState(prefill?.amount ?? 0);
  const [categoryId, setCategoryId] = useState<string | null>(prefill?.categoryId ?? null);
  const [note, setNote] = useState(prefill?.note ?? '');
  const [partyId, setPartyId] = useState<string | null>(prefill?.partyId ?? null);
  const [accountId, setAccountId] = useState<string | null>(prefill?.accountId ?? null);
  const [date, setDate] = useState(todayISO().slice(0, 10));
  const [receiptUri, setReceiptUri] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [projectSheet, setProjectSheet] = useState(false);
  const [partySheet, setPartySheet] = useState(false);
  const [accountSheet, setAccountSheet] = useState(false);
  const [dateSheet, setDateSheet] = useState(false);
  const [addPartyOpen, setAddPartyOpen] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');

  const loadParties = useCallback(async () => {
    setParties(await listParties());
  }, []);

  useEffect(() => {
    listCategories(catType)
      // System categories are posted by business logic, not manual entry.
      .then((cats) => setCategories(cats.filter((c) => !SYSTEM_CATS.has(c.name_en))))
      .catch(() => undefined);
    loadParties().catch(() => undefined);
    listAccountsWithBalance().then(setAccounts).catch(() => undefined);
  }, [catType, loadParties]);

  useFocusEffect(
    useCallback(() => {
      refreshProjects().catch(() => undefined);
    }, [refreshProjects])
  );

  // Default the account to last-used (or the first account).
  useEffect(() => {
    if (accountId || accounts.length === 0) return;
    const fallback = accounts.find((a) => a.id === lastAccountId) ?? accounts[0];
    if (fallback) setAccountId(fallback.id);
  }, [accounts, lastAccountId, accountId]);

  // Default the project to last-used (project stays optional).
  useEffect(() => {
    if (projectId || prefill?.projectId) return;
    const fallback = projects.find((p) => p.project.id === lastProjectId);
    if (fallback) setProjectId(fallback.project.id);
  }, [projects, lastProjectId, projectId, prefill?.projectId]);

  const selectedProject = projects.find((p) => p.project.id === projectId)?.project ?? null;
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null;

  const catName = useCallback(
    (c: CategoryRow) => (language === 'ur' ? c.name_ur : c.name_en),
    [language]
  );

  const dateOptions: SelectOption[] = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const d = dayjs().subtract(i, 'day');
        const iso = d.format('YYYY-MM-DD');
        return { id: iso, label: i === 0 ? t('today') : d.format('DD MMM YYYY') };
      }),
    [t]
  );
  const dateLabel = date === todayISO().slice(0, 10) ? t('today') : dayjs(date).format('DD MMM YYYY');

  const partyOptions: SelectOption[] = useMemo(
    () => [
      { id: ADD_PARTY_ID, label: t('addNew'), icon: 'add' },
      ...parties.map((p) => ({ id: p.id, label: p.name, subtitle: p.phone ?? undefined, icon: 'investor' as IconKey })),
    ],
    [parties, t]
  );
  const selectedParty = parties.find((p) => p.id === partyId) ?? null;

  const accountOptions: SelectOption[] = useMemo(
    () =>
      accounts.map((a) => ({
        id: a.id,
        label: a.name,
        subtitle: formatRupees(a.balance),
        icon: (a.type === 'BANK' ? 'bank' : a.type === 'CASH' ? 'rupee' : 'balance') as IconKey,
      })),
    [accounts]
  );

  const projectOptions: SelectOption[] = useMemo(
    () => [
      { id: NO_PROJECT_ID, label: t('noProject'), icon: 'close' as IconKey },
      ...projects.map((p) => ({ id: p.project.id, label: p.project.name, icon: 'project' as IconKey })),
    ],
    [projects, t]
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  };

  const onSave = async () => {
    if (amount <= 0) {
      showToast(t('enterAmount'));
      return;
    }
    if (!accountId) {
      setAccountSheet(true);
      return;
    }
    setSaving(true);
    try {
      const txn = await addTransaction({
        direction,
        amount,
        date,
        accountId,
        projectId,
        phase: projectId ? 'GENERAL' : null,
        categoryId,
        partyId,
        description: note || null,
      });
      if (receiptUri) {
        await addDocument({
          entityType: 'transaction',
          entityId: txn.id,
          fileUri: receiptUri,
          mime: 'image/jpeg',
        });
      }
      if (projectId) setLastProjectId(projectId);
      setLastAccountId(accountId);
      await refreshProjects();
      setAccounts(await listAccountsWithBalance());
      showToast(t('savedToast'));
      // Reset for the next rapid entry (keep project + account).
      setAmount(0);
      setNote('');
      setCategoryId(null);
      setPartyId(null);
      setReceiptUri(null);
      setResetKey((k) => k + 1);
    } catch (e) {
      if (isInsufficientFunds(e)) Alert.alert(t('insufficientFunds'));
      else throw e;
    } finally {
      setSaving(false);
    }
  };

  const onPickReceipt = async () => {
    const uri = await captureReceipt();
    if (uri) setReceiptUri(uri);
  };

  const onAddParty = async () => {
    const name = newPartyName.trim();
    if (!name) return;
    const created = await addParty({ type: direction === 'OUT' ? 'SUPPLIER' : 'BUYER', name });
    await loadParties();
    setPartyId(created.id);
    setNewPartyName('');
    setAddPartyOpen(false);
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        title={t(direction === 'OUT' ? 'kharcha' : 'aamdani')}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: theme.spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Account chip  where the money moves */}
          <Pressable onPress={() => setAccountSheet(true)} style={styles.projectChip} accessibilityRole="button">
            <AppIcon name={selectedAccount?.type === 'BANK' ? 'bank' : 'balance'} size={18} color="primary" />
            <AppText size="sm" weight="bold" numberOfLines={1} style={styles.flex}>
              {selectedAccount ? `${selectedAccount.name} · ${formatRupees(selectedAccount.balance)}` : t('selectAccount')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          {/* Amount */}
          <AmountInput key={resetKey} value={amount} onChange={setAmount} autoFocus />

          {/* Category grid */}
          <AppText size="sm" weight="bold" color="textSecondary">
            {t('category')}
          </AppText>
          <View style={styles.grid}>
            {categories.map((c) => {
              const selected = c.id === categoryId;
              const iconKey = (c.icon && c.icon in ICONS ? c.icon : direction === 'OUT' ? 'kharcha' : 'aamdani') as IconKey;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCategoryId(selected ? null : c.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.catTile, selected && styles.catTileActive]}
                >
                  <View style={[styles.catIcon, selected && styles.catIconActive]}>
                    <AppIcon name={iconKey} size={22} color={selected ? 'onAccent' : 'primary'} />
                  </View>
                  <AppText size="xs" weight="semibold" center numberOfLines={2}>
                    {catName(c)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          {/* Note */}
          <FloatingLabelInput label={t('note')} value={note} onChangeText={setNote} />

          {/* Project (optional) */}
          <Pressable onPress={() => setProjectSheet(true)} style={styles.rowChip} accessibilityRole="button">
            <AppIcon name="project" size={18} color="primary" />
            <AppText
              size="sm"
              weight="semibold"
              numberOfLines={1}
              style={styles.flex}
              color={selectedProject ? 'textPrimary' : 'textSecondary'}
            >
              {selectedProject?.name ?? t('selectProject')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          {/* Party */}
          <Pressable onPress={() => setPartySheet(true)} style={styles.rowChip} accessibilityRole="button">
            <AppIcon name="investor" size={18} color="primary" />
            <AppText size="sm" weight="semibold" numberOfLines={1} style={styles.flex} color={selectedParty ? 'textPrimary' : 'textSecondary'}>
              {selectedParty?.name ?? t('party')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          {/* Date */}
          <Pressable onPress={() => setDateSheet(true)} style={styles.rowChip} accessibilityRole="button">
            <AppIcon name="today" size={18} color="primary" />
            <AppText size="sm" weight="semibold" style={styles.flex}>
              {dateLabel}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          {/* Receipt photo */}
          {receiptUri ? (
            <Pressable onPress={() => setReceiptUri(null)} style={styles.receiptRow} accessibilityRole="button">
              <Image source={{ uri: receiptUri }} style={styles.receiptThumb} />
              <AppText size="sm" weight="semibold" style={styles.flex}>
                {t('photoReceipt')}
              </AppText>
              <AppIcon name="close" size={20} color="danger" />
            </Pressable>
          ) : (
            <AppButton label={t('photoReceipt')} icon="camera" variant="secondary" onPress={onPickReceipt} />
          )}
        </ScrollView>

        {/* Save  pinned to the bottom, always in reach */}
        <StickyFooter>
          <AppButton
            label={t('save')}
            icon="check"
            onPress={onSave}
            loading={saving}
            disabled={
              amount <= 0 ||
              !accountId ||
              (direction === 'OUT' && !!selectedAccount && amount > selectedAccount.balance)
            }
          />
        </StickyFooter>
      </KeyboardAvoidingView>

      {/* Toast */}
      {toast ? (
        <Animated.View
          entering={FadeInDown}
          exiting={FadeOutDown}
          style={[styles.toast, { bottom: insets.bottom + theme.spacing.xl }]}
        >
          <AppIcon name="checkCircle" size={20} color="onPrimary" />
          <AppText size="sm" weight="bold" color="onPrimary">
            {toast}
          </AppText>
        </Animated.View>
      ) : null}

      {/* Sheets */}
      <SelectSheet
        visible={accountSheet}
        onClose={() => setAccountSheet(false)}
        options={accountOptions}
        selectedId={accountId ?? undefined}
        title={t('selectAccount')}
        searchable={false}
        onSelect={(o) => setAccountId(o.id)}
      />
      <SelectSheet
        visible={projectSheet}
        onClose={() => setProjectSheet(false)}
        options={projectOptions}
        selectedId={projectId ?? NO_PROJECT_ID}
        title={t('selectProject')}
        onSelect={(o) => setProjectId(o.id === NO_PROJECT_ID ? null : o.id)}
      />
      <SelectSheet
        visible={partySheet}
        onClose={() => setPartySheet(false)}
        options={partyOptions}
        selectedId={partyId ?? undefined}
        title={t('party')}
        onSelect={(o) => (o.id === ADD_PARTY_ID ? setAddPartyOpen(true) : setPartyId(o.id))}
      />
      <SelectSheet
        visible={dateSheet}
        onClose={() => setDateSheet(false)}
        options={dateOptions}
        selectedId={date}
        title={t('date')}
        searchable={false}
        onSelect={(o) => setDate(o.id)}
      />

      {/* Add-party modal */}
      <Modal visible={addPartyOpen} transparent animationType="fade" onRequestClose={() => setAddPartyOpen(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <Pressable style={styles.backdrop} onPress={() => setAddPartyOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText size="lg" weight="bold">
            {t('addNew')}
          </AppText>
          <FloatingLabelInput label={t('party')} value={newPartyName} onChangeText={setNewPartyName} />
          <AppButton label={t('save')} icon="check" onPress={onAddParty} />
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    projectChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.primarySoft,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.lg,
      minHeight: theme.touch.minTarget,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    catTile: {
      width: '31%',
      flexGrow: 1,
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    catTileActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft },
    catIcon: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.chip,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primarySoft,
    },
    catIconActive: { backgroundColor: theme.colors.accent },
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
    receiptRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      padding: theme.spacing.sm,
    },
    receiptThumb: { width: 44, height: 44, borderRadius: theme.radius.sm, backgroundColor: theme.colors.track },
    toast: {
      position: 'absolute',
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.success,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.md,
      ...theme.shadows.raised,
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
