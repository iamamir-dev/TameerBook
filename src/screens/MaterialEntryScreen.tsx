import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
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
  DateField,
  SelectSheet,
  type IconKey,
  type SelectOption,
} from '@/components/ui';
import {
  addDocument,
  addParty,
  addTransaction,
  type AccountWithBalance,
  type CategoryRow,
  listAccountsWithBalance,
  listSubcategories,
  listParties,
  type PartyRow,
} from '@/db';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { useAccountOptions, useCategoryLabel, useSaveAction, useToast } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useEntryStore } from '@/stores/useEntryStore';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { todayISO } from '@/utils/date';
import { swallow } from '@/utils/log';
import { formatRupees } from '@/utils/money';
import { captureReceipt } from '@/utils/photo';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ADD_PARTY_ID = '__add__';

export function MaterialEntryScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const projects = useProjectsStore((s) => s.items);
  const refreshProjects = useProjectsStore((s) => s.refresh);
  const lastProjectId = useEntryStore((s) => s.lastProjectId);
  const setLastProjectId = useEntryStore((s) => s.setLastProjectId);
  const lastAccountId = useEntryStore((s) => s.lastAccountId);
  const setLastAccountId = useEntryStore((s) => s.setLastAccountId);

  const [items, setItems] = useState<CategoryRow[]>([]);
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  // `undefined` = user hasn't chosen yet (fall back to last-used below).
  // Keeping the distinction in state (instead of effects that write defaults
  // back) means a refresh can never clobber a deliberate selection.
  const [projectChoice, setProjectChoice] = useState<string | undefined>(undefined);
  const [itemId, setItemId] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');
  const [rate, setRate] = useState('');
  const [accountChoice, setAccountChoice] = useState<string | undefined>(undefined);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO().slice(0, 10));
  const [receiptUri, setReceiptUri] = useState<string | null>(null);

  const [projectSheet, setProjectSheet] = useState(false);
  const [itemSheet, setItemSheet] = useState(false);
  const [accountSheet, setAccountSheet] = useState(false);
  const [partySheet, setPartySheet] = useState(false);
  const [addPartyOpen, setAddPartyOpen] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');

  const { saving, run: runSave } = useSaveAction();
  const { toast, showToast } = useToast();

  const loadParties = useCallback(async () => setParties(await listParties()), []);

  useEffect(() => {
    // Materials are the sub-categories under the "Materials" heading (Settings
    // → Categories) — the single managed source.
    listSubcategories('Materials').then(setItems).catch(swallow('material:categories'));
    loadParties().catch(swallow('material:parties'));
    listAccountsWithBalance().then(setAccounts).catch(swallow('material:accounts'));
  }, [loadParties]);

  useFocusEffect(
    useCallback(() => {
      refreshProjects().catch(swallow('material:projects'));
    }, [refreshProjects])
  );

  // Defaults are computed, not written back by effects: last-used project (or
  // the first one), last-used account (or the first one).
  const projectId =
    projectChoice ??
    (projects.find((p) => p.project.id === lastProjectId) ?? projects[0])?.project.id ??
    null;
  const accountId =
    accountChoice ??
    (accounts.some((a) => a.id === lastAccountId) ? lastAccountId : accounts[0]?.id ?? null);

  // Total = qty × rate, OR typed directly (bills are often known as one figure
  // without a per-unit rate). Editing qty/rate clears a manual override.
  const [totalOverride, setTotalOverride] = useState(0);
  const computedTotal = (Number(qty) || 0) * (Number(rate) || 0);
  const total = totalOverride > 0 ? totalOverride : computedTotal;
  const selectedProject = projects.find((p) => p.project.id === projectId)?.project ?? null;
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null;
  const catName = useCategoryLabel();
  const itemLabel = (c: CategoryRow) => (c.name_en === 'Misc' ? t('feeOther') : catName(c));
  const selectedItem = items.find((c) => c.id === itemId) ?? null;
  const selectedParty = parties.find((p) => p.id === partyId) ?? null;

  const partyOptions: SelectOption[] = useMemo(
    () => [
      { id: ADD_PARTY_ID, label: t('addNew'), icon: 'add' },
      ...parties.map((p) => ({ id: p.id, label: p.name, icon: 'investor' as IconKey })),
    ],
    [parties, t]
  );

  const accountOptions = useAccountOptions(accounts);

  const onSave = async () => {
    if (!projectId || !itemId || total <= 0) return;
    if (!accountId) {
      setAccountSheet(true);
      return;
    }
    const ok = await runSave(async () => {
      const desc = `${selectedItem ? itemLabel(selectedItem) : ''} ${qty}${unit ? ' ' + unit : ''}${
        Number(rate) > 0 ? ` @ ${rate}` : ''
      }`.trim();
      const txn = await addTransaction({
        direction: 'OUT',
        amount: total,
        date,
        accountId,
        projectId,
        phase: 'CONSTRUCTION',
        categoryId: itemId,
        partyId,
        description: desc,
      });
      if (receiptUri) {
        await addDocument({ entityType: 'transaction', entityId: txn.id, fileUri: receiptUri, mime: 'image/jpeg' });
      }
      setLastProjectId(projectId);
      setLastAccountId(accountId);
      await refreshProjects();
    });
    if (!ok) return;
    // Rapid-log: stay open for the next item of the same bill — reset only the
    // item fields; project, supplier and account are kept.
    setItemId(null);
    setQty('');
    setUnit('');
    setRate('');
    setTotalOverride(0);
    setReceiptUri(null);
    showToast(t('savedToast'));
  };

  const onAddParty = async () => {
    const name = newPartyName.trim();
    if (!name) return;
    const ok = await runSave(async () => {
      const created = await addParty({ type: 'SUPPLIER', name });
      await loadParties();
      setPartyId(created.id);
    });
    if (!ok) return;
    setNewPartyName('');
    setAddPartyOpen(false);
  };

  if (projects.length === 0) {
    return (
      <View style={styles.screen}>
        <AppHeader
          title={t('material')}
          onBack={() => navigation.goBack()}
          rightAction={{
            icon: 'ledger',
            onPress: () => navigation.navigate('Bookings'),
            accessibilityLabel: t('bookingsTitle'),
          }}
        />
        <View style={styles.empty}>
          <AppText size="md" color="textSecondary" center>
            {t('noProjectsDetail')}
          </AppText>
          <AppButton label={t('newProject')} icon="add" fullWidth={false} onPress={() => navigation.navigate('NewProject')} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        title={t('material')}
        onBack={() => navigation.goBack()}
        rightAction={{
          icon: 'ledger',
          onPress: () => navigation.navigate('Bookings'),
          accessibilityLabel: t('bookingsTitle'),
        }}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: theme.spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => setProjectSheet(true)} style={styles.chip} accessibilityRole="button">
            <AppIcon name="project" size={18} color="primary" />
            <AppText size="sm" weight="bold" numberOfLines={1} style={styles.flex}>
              {selectedProject?.name ?? t('selectProject')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          <Pressable onPress={() => setItemSheet(true)} style={styles.chip} accessibilityRole="button">
            <AppIcon name="material" size={18} color="primary" />
            <AppText size="sm" weight="semibold" numberOfLines={1} style={styles.flex} color={selectedItem ? 'textPrimary' : 'textSecondary'}>
              {selectedItem ? itemLabel(selectedItem) : t('selectOne')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          <View style={styles.row}>
            <View style={styles.flex}>
              <FloatingLabelInput
                label={t('qtyLabel')}
                value={qty}
                onChangeText={(v) => {
                  setQty(v);
                  setTotalOverride(0);
                }}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.flex}>
              <FloatingLabelInput label={t('unitLabel')} value={unit} onChangeText={setUnit} />
            </View>
          </View>
          <FloatingLabelInput
            label={t('rateLabel')}
            value={rate}
            onChangeText={(v) => {
              setRate(v);
              setTotalOverride(0); // qty × rate takes over again
            }}
            keyboardType="number-pad"
          />

          {/* Total: auto from qty × rate, or typed directly (bill total). */}
          <AmountInput
            label={t('totalLabel')}
            value={total}
            onChange={setTotalOverride}
            floating
            surface={theme.colors.background}
            error={total > 0 && !!selectedAccount && total > selectedAccount.balance ? t('insufficientFunds') : null}
          />

          {/* Supplier */}
          <Pressable onPress={() => setPartySheet(true)} style={styles.chip} accessibilityRole="button">
            <AppIcon name="investor" size={18} color="primary" />
            <AppText size="sm" weight="semibold" numberOfLines={1} style={styles.flex} color={selectedParty ? 'textPrimary' : 'textSecondary'}>
              {selectedParty?.name ?? t('supplier')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          {/* Account  where the money moves */}
          <Pressable onPress={() => setAccountSheet(true)} style={styles.chip} accessibilityRole="button">
            <AppIcon name={selectedAccount?.type === 'BANK' ? 'bank' : 'balance'} size={18} color="primary" />
            <AppText size="sm" weight="bold" numberOfLines={1} style={styles.flex}>
              {selectedAccount ? `${selectedAccount.name} · ${formatRupees(selectedAccount.balance)}` : t('selectAccount')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          {/* Date */}
          <DateField value={date} onChange={setDate} />

          {/* Bill photo */}
          {receiptUri ? (
            <Pressable onPress={() => setReceiptUri(null)} style={styles.chip} accessibilityRole="button">
              <Image source={{ uri: receiptUri }} style={styles.thumb} />
              <AppText size="sm" style={styles.flex}>
                {t('billPhoto')}
              </AppText>
              <AppIcon name="close" size={18} color="danger" />
            </Pressable>
          ) : (
            <AppButton
              label={t('billPhoto')}
              icon="camera"
              variant="secondary"
              onPress={async () => {
                const uri = await captureReceipt().catch(swallow('material:receipt'));
                if (uri) setReceiptUri(uri);
              }}
            />
          )}

        </ScrollView>

        <StickyFooter>
          <AppButton
            label={t('save')}
            icon="check"
            onPress={onSave}
            loading={saving}
            disabled={
              !projectId ||
              !itemId ||
              total <= 0 ||
              (!!selectedAccount && total > selectedAccount.balance)
            }
          />
        </StickyFooter>
      </KeyboardAvoidingView>

      <SelectSheet
        visible={projectSheet}
        onClose={() => setProjectSheet(false)}
        options={projects.map((p) => ({ id: p.project.id, label: p.project.name, icon: 'project' as IconKey }))}
        selectedId={projectId ?? undefined}
        title={t('selectProject')}
        onSelect={(o) => setProjectChoice(o.id)}
      />
      <SelectSheet
        visible={itemSheet}
        onClose={() => setItemSheet(false)}
        options={items.map((c) => ({ id: c.id, label: itemLabel(c), icon: 'material' as IconKey }))}
        selectedId={itemId ?? undefined}
        title={t('material')}
        onSelect={(o) => {
          setItemId(o.id);
          const m = items.find((x) => x.id === o.id);
          if (m?.default_unit) setUnit(m.default_unit);
        }}
      />
      <SelectSheet
        visible={accountSheet}
        onClose={() => setAccountSheet(false)}
        options={accountOptions}
        selectedId={accountId ?? undefined}
        title={t('selectAccount')}
        searchable={false}
        onSelect={(o) => setAccountChoice(o.id)}
      />
      <SelectSheet
        visible={partySheet}
        onClose={() => setPartySheet(false)}
        options={partyOptions}
        selectedId={partyId ?? undefined}
        title={t('supplier')}
        onSelect={(o) => (o.id === ADD_PARTY_ID ? setAddPartyOpen(true) : setPartyId(o.id))}
      />
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
          <FloatingLabelInput label={t('supplier')} value={newPartyName} onChangeText={setNewPartyName} />
          <AppButton label={t('save')} icon="check" onPress={onAddParty} />
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Saved toast (rapid-log stays on this screen) */}
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
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.lg, padding: theme.spacing.xl },
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
    chip: {
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
    row: { flexDirection: 'row', gap: theme.spacing.md },
    totalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.primarySoft,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    thumb: { width: 40, height: 40, borderRadius: theme.radius.sm, backgroundColor: theme.colors.track },
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
