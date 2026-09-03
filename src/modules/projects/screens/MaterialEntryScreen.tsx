import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import {
  AddPartySheet,
  AmountInput,
  AppButton,
  AppHeader,
  AppIcon,
  AppText,
  DateField,
  MaterialItemPicker,
  QtyUnitRow,
  SelectSheet,
  StickyFooter,
  Toast,
  type IconKey,
  type MaterialSelection,
  type SelectOption,
} from '@/components/ui';
import {
  addDocument,
  addTransaction,
  getCategory,
  getLastMaterialRate,
  listAccountsWithBalance,
  listParties,
  type AccountWithBalance,
  type LastRate,
  type PartyRow,
} from '@/db';
import { useAccountOptions, useSaveAction, useToast } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useEntryStore } from '@/stores/useEntryStore';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatDisplayDate, todayISO } from '@/utils/date';
import { swallow } from '@/utils/log';
import { formatRupees } from '@/utils/money';
import { captureReceipt } from '@/utils/photo';
import type { UnitDef } from '@/utils/units';
import { PROVIDERS, billToMaterialPrefill, billToPurchaseOrderPrefill } from '@/ai';
import { AI_ERROR_KEY, useBillReader } from '@/modules/assistant';
import { useSettingsStore } from '@/stores/useSettingsStore';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type MaterialRoute = RouteProp<RootStackParamList, 'MaterialEntry'>;

const ADD_PARTY_ID = '__add__';
const EMPTY_MATERIAL: MaterialSelection = { categoryId: null, name: '', unit: { primary: null, secondary: null, factor: null } };

export function MaterialEntryScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  // Optional prefill (from the assistant's voice / bill drafts) — every field
  // is still shown and editable; nothing saves without the Save tap.
  const prefill = useRoute<MaterialRoute>().params?.prefill;
  const styles = makeStyles(theme);

  const projects = useProjectsStore((s) => s.items);
  const refreshProjects = useProjectsStore((s) => s.refresh);
  const lastProjectId = useEntryStore((s) => s.lastProjectId);
  const setLastProjectId = useEntryStore((s) => s.setLastProjectId);
  const lastAccountId = useEntryStore((s) => s.lastAccountId);
  const setLastAccountId = useEntryStore((s) => s.setLastAccountId);

  const [parties, setParties] = useState<PartyRow[]>([]);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [projectChoice, setProjectChoice] = useState<string | undefined>(prefill?.projectId);
  const [material, setMaterial] = useState<MaterialSelection>(
    prefill?.itemName ? { ...EMPTY_MATERIAL, name: prefill.itemName } : EMPTY_MATERIAL
  );
  const [qty, setQty] = useState(prefill?.qty ?? 0); // primary unit
  const [rate, setRate] = useState(prefill?.rate ? String(prefill.rate) : '');
  const [accountChoice, setAccountChoice] = useState<string | undefined>(prefill?.accountId);
  const [partyId, setPartyId] = useState<string | null>(prefill?.partyId ?? null);
  const [date, setDate] = useState(prefill?.date ?? todayISO().slice(0, 10));
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  // A prefilled total only when qty × rate can't produce it.
  const [totalOverride, setTotalOverride] = useState(prefill?.amount && !(prefill.qty && prefill.rate) ? prefill.amount : 0);

  // Resolve a prefilled material category into the picker's selection shape.
  useEffect(() => {
    const catId = prefill?.categoryId;
    if (!catId) return;
    getCategory(catId)
      .then((c) => {
        if (!c) return;
        setMaterial({
          categoryId: c.id,
          name: c.name_en,
          unit: { primary: c.default_unit, secondary: c.secondary_unit, factor: c.secondary_factor },
        });
      })
      .catch(swallow('material:prefill'));
  }, [prefill?.categoryId]);
  // Bumped after each save to reset the QtyUnitRow field (rapid-log).
  const [formNonce, setFormNonce] = useState(0);
  // Smart default: the last rate paid for this material (same supplier first).
  // Fills an EMPTY rate field so the user confirms instead of remembering.
  const [lastRate, setLastRate] = useState<LastRate | null>(null);
  useEffect(() => {
    if (!material.categoryId) {
      setLastRate(null);
      return;
    }
    let alive = true;
    getLastMaterialRate(material.categoryId, partyId)
      .then((r) => {
        if (!alive) return;
        setLastRate(r);
        if (r) setRate((cur) => (cur === '' ? String(r.rate) : cur));
      })
      .catch(swallow('material:lastRate'));
    return () => {
      alive = false;
    };
  }, [material.categoryId, partyId]);

  const [projectSheet, setProjectSheet] = useState(false);
  const [accountSheet, setAccountSheet] = useState(false);
  const [partySheet, setPartySheet] = useState(false);
  const [addPartyOpen, setAddPartyOpen] = useState(false);

  const { saving, run: runSave } = useSaveAction();
  const { toast, showToast } = useToast();

  // "Read this bill": vision model → prefilled fields (single line) or a
  // purchase order (many lines). Only offered when AI helpers are on.
  const aiReady = useSettingsStore((s) => {
    if (!s.aiEnabled) return false;
    const info = PROVIDERS[s.aiProvider];
    const key = s.aiKeys[s.aiProvider] ?? '';
    const url = s.aiProvider === 'proxy' ? s.aiProxyUrl : s.aiProvider === 'custom' ? s.aiCustomBaseUrl : info.baseUrl;
    return (!info.needsKey || !!key) && (!info.needsUrl || !!url);
  });
  const bill = useBillReader();
  const readBill = async () => {
    if (!receiptUri) return;
    const res = await bill.read(receiptUri);
    if (!res) {
      if (bill.error) showToast(t(AI_ERROR_KEY[bill.error]));
      return;
    }
    const { bill: b, world } = res;
    if (b.items.length === 0) {
      showToast(t('aiBillNothing'));
      return;
    }
    if (b.items.length > 1) {
      Alert.alert(`${b.items.length} ${t('aiBillItems')}`, b.items.map((i) => i.item).join(', '), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('aiBillOpenPo'),
          onPress: () => navigation.navigate('NewPurchaseOrder', { prefill: billToPurchaseOrderPrefill(b, world, projectId ?? undefined) }),
        },
      ]);
      return;
    }
    const p = billToMaterialPrefill(b, world);
    if (!p) return;
    if (p.categoryId) {
      const c = await getCategory(p.categoryId).catch(swallow('material:billCat'));
      if (c) setMaterial({ categoryId: c.id, name: c.name_en, unit: { primary: c.default_unit, secondary: c.secondary_unit, factor: c.secondary_factor } });
    } else if (p.itemName) {
      setMaterial({ ...EMPTY_MATERIAL, name: p.itemName });
    }
    if (p.qty) setQty(p.qty);
    if (p.rate) setRate(String(p.rate));
    if (p.amount && !(p.qty && p.rate)) setTotalOverride(p.amount);
    if (p.partyId) setPartyId(p.partyId);
    if (p.date) setDate(p.date);
    setBillQty(p.qty ?? null);
  };
  // Pushes a read quantity into QtyUnitRow (which owns its own text field).
  const [billQty, setBillQty] = useState<number | null>(null);

  const loadParties = useCallback(async () => setParties(await listParties()), []);

  useEffect(() => {
    loadParties().catch(swallow('material:parties'));
    listAccountsWithBalance().then(setAccounts).catch(swallow('material:accounts'));
  }, [loadParties]);

  useFocusEffect(
    useCallback(() => {
      refreshProjects().catch(swallow('material:projects'));
    }, [refreshProjects])
  );

  const projectId =
    projectChoice ??
    (projects.find((p) => p.project.id === lastProjectId) ?? projects[0])?.project.id ??
    null;
  const accountId =
    accountChoice ?? (accounts.some((a) => a.id === lastAccountId) ? lastAccountId : accounts[0]?.id ?? null);

  const computedTotal = qty * (Number(rate) || 0);
  const total = totalOverride > 0 ? totalOverride : computedTotal;
  const selectedProject = projects.find((p) => p.project.id === projectId)?.project ?? null;
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null;
  const selectedParty = parties.find((p) => p.id === partyId) ?? null;
  const unit: UnitDef = material.unit;

  const partyOptions: SelectOption[] = useMemo(
    () => [
      { id: ADD_PARTY_ID, label: t('addNew'), icon: 'add' },
      ...parties.map((p) => ({ id: p.id, label: p.name, icon: 'investor' as IconKey })),
    ],
    [parties, t]
  );
  const accountOptions = useAccountOptions(accounts);

  const onSave = async () => {
    if (!projectId || !material.categoryId || total <= 0) return;
    if (!accountId) {
      setAccountSheet(true);
      return;
    }
    const unitLabel = unit.primary ? ` ${unit.primary}` : '';
    const ok = await runSave(async () => {
      const desc = `${material.name} ${qty || ''}${unitLabel}${Number(rate) > 0 ? ` @ ${rate}` : ''}`.trim();
      const txn = await addTransaction({
        direction: 'OUT',
        amount: total,
        date,
        accountId,
        projectId,
        phase: 'CONSTRUCTION',
        categoryId: material.categoryId,
        partyId,
        qty: qty > 0 ? qty : null,
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
    // Rapid-log: keep project/supplier/account; reset the item fields.
    setMaterial(EMPTY_MATERIAL);
    setQty(0);
    setRate('');
    setTotalOverride(0);
    setReceiptUri(null);
    setFormNonce((n) => n + 1);
    showToast(t('savedToast'));
  };

  if (projects.length === 0) {
    return (
      <View style={styles.screen}>
        <AppHeader
          title={t('material')}
          onBack={() => navigation.goBack()}
          rightAction={{ icon: 'ledger', onPress: () => navigation.navigate('Bookings'), accessibilityLabel: t('bookingsTitle') }}
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
        rightAction={{ icon: 'ledger', onPress: () => navigation.navigate('Bookings'), accessibilityLabel: t('bookingsTitle') }}
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

          <MaterialItemPicker value={material} onChange={setMaterial} />

          <QtyUnitRow
            unit={unit}
            resetToken={billQty ?? formNonce}
            initialPrimary={billQty ?? (formNonce === 0 ? prefill?.qty : undefined)}
            onQty={(v) => { setQty(v); setTotalOverride(0); }}
          />

          <FloatingLabelInput
            label={t('rateLabel')}
            value={rate}
            onChangeText={(v) => { setRate(v); setTotalOverride(0); }}
            keyboardType="number-pad"
            hint={
              lastRate
                ? `${t('lastRateLabel')} ${formatRupees(lastRate.rate)} · ${[lastRate.partyName, formatDisplayDate(lastRate.date)].filter(Boolean).join(' · ')}`
                : undefined
            }
          />

          <AmountInput
            label={t('totalLabel')}
            value={total}
            onChange={setTotalOverride}
            floating
            surface={theme.colors.background}
            error={total > 0 && !!selectedAccount && total > selectedAccount.balance ? t('insufficientFunds') : null}
          />

          <Pressable onPress={() => setPartySheet(true)} style={styles.chip} accessibilityRole="button">
            <AppIcon name="investor" size={18} color="primary" />
            <AppText size="sm" weight="semibold" numberOfLines={1} style={styles.flex} color={selectedParty ? 'textPrimary' : 'textSecondary'}>
              {selectedParty?.name ?? t('supplier')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          <Pressable onPress={() => setAccountSheet(true)} style={styles.chip} accessibilityRole="button">
            <AppIcon name={selectedAccount?.type === 'BANK' ? 'bank' : 'balance'} size={18} color="primary" />
            <AppText size="sm" weight="bold" numberOfLines={1} style={styles.flex}>
              {selectedAccount ? `${selectedAccount.name} · ${formatRupees(selectedAccount.balance)}` : t('selectAccount')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          <DateField value={date} onChange={setDate} />

          {receiptUri ? (
            <>
              <Pressable onPress={() => setReceiptUri(null)} style={styles.chip} accessibilityRole="button">
                <Image source={{ uri: receiptUri }} style={styles.thumb} />
                <AppText size="sm" style={styles.flex}>
                  {t('billPhoto')}
                </AppText>
                <AppIcon name="close" size={18} color="danger" />
              </Pressable>
              {aiReady ? (
                <AppButton
                  label={bill.reading ? t('aiReadingBill') : t('aiReadBill')}
                  icon="assistant"
                  variant="secondary"
                  loading={bill.reading}
                  onPress={() => void readBill()}
                />
              ) : null}
            </>
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
            disabled={!projectId || !material.categoryId || total <= 0 || (!!selectedAccount && total > selectedAccount.balance)}
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
      <AddPartySheet
        visible={addPartyOpen}
        onClose={() => setAddPartyOpen(false)}
        label={t('supplier')}
        partyType="SUPPLIER"
        onCreated={(created) => {
          void loadParties().then(() => setPartyId(created.id));
        }}
      />

      <Toast message={toast} />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    content: { padding: theme.spacing.lg, paddingHorizontal: theme.spacing.page, gap: theme.spacing.md },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.lg, padding: theme.spacing.xl },
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
    thumb: { width: 40, height: 40, borderRadius: theme.radius.sm, backgroundColor: theme.colors.track },
  });
