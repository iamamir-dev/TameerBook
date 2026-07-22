import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import {
  AmountInput,
  AppButton,
  AppHeader,
  AppIcon,
  AppText,
  MaterialItemPicker,
  QtyUnitRow,
  SelectSheet,
  StickyFooter,
  type IconKey,
  type MaterialSelection,
  type SelectOption,
} from '@/components/ui';
import { addParty, createPurchaseOrder, listParties, listProjects, type PartyRow, type ProjectRow } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { swallow } from '@/utils/log';
import { formatRupees } from '@/utils/money';
import type { UnitDef } from '@/utils/units';

import { makeStyles } from '../styled/NewPurchaseOrderScreen.styles';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const EMPTY_UNIT: UnitDef = { primary: null, secondary: null, factor: null };

interface ItemRow {
  key: number;
  material: MaterialSelection;
  qty: number;
  rate: number;
}

/**
 * Create a purchase order — a full page (like New Project/Plot): one supplier +
 * project, then any number of material line-items added with "+ Add item". Each
 * item becomes its own booking, grouped under one PO.
 */
export function NewPurchaseOrderScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(theme);
  const { saving, run: runSave } = useSaveAction();

  const keyRef = useRef(1);
  const newRow = (): ItemRow => ({ key: keyRef.current++, material: { categoryId: null, name: '', unit: EMPTY_UNIT }, qty: 0, rate: 0 });

  const [items, setItems] = useState<ItemRow[]>([newRow()]);
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [partyId, setPartyId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectSheet, setProjectSheet] = useState(false);

  useEffect(() => {
    listProjects().then((r) => setProjects(r.filter((p) => p.status === 'ACTIVE'))).catch(swallow('po:projects'));
    listParties('SUPPLIER').then(setParties).catch(swallow('po:parties'));
  }, []);

  const patchItem = (key: number, p: Partial<ItemRow>) => setItems((l) => l.map((it) => (it.key === key ? { ...it, ...p } : it)));
  const removeItem = (key: number) => setItems((l) => (l.length > 1 ? l.filter((it) => it.key !== key) : l));
  const addItem = () => setItems((l) => [...l, newRow()]);

  const selectedProject = projects.find((p) => p.id === projectId) ?? null;
  const projectOptions: SelectOption[] = projects.map((p) => ({ id: p.id, label: p.name, icon: 'project' as IconKey }));
  const hasSupplier = !!partyId || supplierName.trim().length > 0;
  const grandTotal = items.reduce((s, it) => s + it.qty * it.rate, 0);
  const itemsValid = items.every((it) => it.material.name.trim().length > 0 && it.qty > 0 && it.rate > 0);
  const canSave = itemsValid && !!projectId && hasSupplier;

  const onSave = () => {
    if (!canSave || saving) return;
    void (async () => {
      const ok = await runSave(async () => {
        let pid = partyId;
        const name = supplierName.trim();
        if (!pid && name) {
          const existing = parties.find((p) => p.name.toLowerCase() === name.toLowerCase());
          pid = existing ? existing.id : (await addParty({ type: 'SUPPLIER', name, phone: supplierPhone.trim() || null })).id;
        }
        await createPurchaseOrder({
          projectId,
          partyId: pid,
          supplierName: name || null,
          items: items.map((it) => ({ itemName: it.material.name.trim(), qty: it.qty, rate: it.rate, unit: it.material.unit.primary })),
        });
      });
      if (ok) navigation.goBack();
    })();
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={t('newBooking')} onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Supplier + project apply to the whole order. */}
          <FloatingLabelInput label={t('supplier')} value={supplierName} onChangeText={(v) => { setSupplierName(v); setPartyId(null); }} />
          {!partyId && supplierName.trim() ? (
            <FloatingLabelInput label={`${t('phone')} (${t('optional')})`} value={supplierPhone} onChangeText={setSupplierPhone} mask="phone" />
          ) : null}
          {parties.length > 0 ? (
            <View style={styles.suggestWrap}>
              {parties.map((p) => {
                const on = partyId === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => { setPartyId(p.id); setSupplierName(p.name); setSupplierPhone(p.phone ?? ''); }}
                    accessibilityRole="button"
                    style={[styles.suggestChip, on && styles.suggestChipOn]}
                  >
                    <AppIcon name="investor" size={12} color={on ? 'accent' : 'textSecondary'} />
                    <AppText size="xs" weight="semibold" color={on ? 'accent' : 'textSecondary'}>
                      {p.name}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <Pressable onPress={() => setProjectSheet(true)} style={styles.chip} accessibilityRole="button">
            <AppIcon name="project" size={18} color="primary" />
            <AppText size="sm" weight="semibold" numberOfLines={1} style={styles.flexText} color={selectedProject ? 'textPrimary' : 'textSecondary'}>
              {selectedProject?.name ?? t('selectProject')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          <AppText size="overline" weight="bold" color="textSecondary" uppercase style={styles.sectionLabel}>
            {t('items')}
          </AppText>

          {items.map((it, i) => {
            const lineTotal = it.qty * it.rate;
            return (
              <View key={it.key} style={styles.itemCard}>
                <View style={styles.itemHead}>
                  <View style={styles.itemNo}>
                    <AppIcon name="material" size={16} color="accent" />
                    <AppText size="sm" weight="bold">{`${t('item')} ${i + 1}`}</AppText>
                  </View>
                  <View style={styles.itemNo}>
                    {lineTotal > 0 ? (
                      <AppText size="sm" weight="bold" color="primary" tabular>{formatRupees(lineTotal)}</AppText>
                    ) : null}
                    {items.length > 1 ? (
                      <Pressable onPress={() => removeItem(it.key)} accessibilityRole="button" accessibilityLabel={t('delete')} style={styles.trash}>
                        <AppIcon name="trash" size={18} color="danger" />
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <MaterialItemPicker value={it.material} onChange={(material) => patchItem(it.key, { material })} />
                <QtyUnitRow unit={it.material.unit} resetToken={it.key} onQty={(qty) => patchItem(it.key, { qty })} />
                <AmountInput label={t('rateLabel')} value={it.rate} onChange={(rate) => patchItem(it.key, { rate })} floating surface={theme.colors.card} />
              </View>
            );
          })}

          <Pressable onPress={addItem} style={styles.addItem} accessibilityRole="button">
            <AppIcon name="add" size={18} color="accent" />
            <AppText size="sm" weight="bold" color="accent">{t('addItem')}</AppText>
          </Pressable>

          <View style={styles.totalRow}>
            <AppText size="sm" color="textSecondary">{t('totalLabel')}</AppText>
            <AppText size="xl" weight="bold" color="primary" tabular>{formatRupees(grandTotal)}</AppText>
          </View>
        </ScrollView>

        <StickyFooter>
          <AppButton label={t('save')} icon="check" onPress={onSave} loading={saving} disabled={!canSave} />
        </StickyFooter>
      </KeyboardAvoidingView>

      <SelectSheet
        visible={projectSheet}
        onClose={() => setProjectSheet(false)}
        options={projectOptions}
        selectedId={projectId ?? ''}
        title={t('selectProject')}
        searchable={false}
        onSelect={(o) => setProjectId(o.id)}
      />
    </View>
  );
}
