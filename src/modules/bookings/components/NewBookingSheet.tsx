import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import {
  AmountInput,
  AppButton,
  AppIcon,
  AppSheet,
  AppText,
  MaterialItemPicker,
  QtyUnitRow,
  SelectSheet,
  type IconKey,
  type MaterialSelection,
  type SelectOption,
} from '@/components/ui';
import { addParty, createBooking, listParties, listProjects, type PartyRow, type ProjectRow } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { swallow } from '@/utils/log';
import { formatRupees } from '@/utils/money';
import type { UnitDef } from '@/utils/units';

import { makeStyles } from '../styled/NewBookingSheet.styles';

const NO_PROJECT_ID = '__none__';
const EMPTY_UNIT: UnitDef = { primary: null, secondary: null, factor: null };

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

interface Form {
  material: MaterialSelection;
  qty: number; // primary unit
  rate: number;
  supplierName: string;
  supplierPhone: string;
  partyId: string | null;
  projectId: string | null;
}
const emptyForm = (): Form => ({
  material: { categoryId: null, name: '', unit: EMPTY_UNIT },
  qty: 0,
  rate: 0,
  supplierName: '',
  supplierPhone: '',
  partyId: null,
  projectId: null,
});

/**
 * Book material ahead ("5000 bricks @ Rs 10"). A simple, single-item form on
 * the shared AppSheet: material (shared picker, carries the unit) + qty
 * (secondary-unit aware) + rate + supplier + project. A typed supplier is saved
 * so it's reusable next time.
 */
export function NewBookingSheet({ visible, onClose, onSaved }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { saving, run: runSave } = useSaveAction();

  const [form, setForm] = useState<Form>(emptyForm);
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectSheet, setProjectSheet] = useState(false);
  const patch = (p: Partial<Form>) => setForm((s) => ({ ...s, ...p }));

  useEffect(() => {
    if (!visible) return;
    setForm(emptyForm());
    listProjects().then((r) => setProjects(r.filter((p) => p.status === 'ACTIVE'))).catch(swallow('bookings:projects'));
    listParties('SUPPLIER').then(setParties).catch(swallow('bookings:parties'));
  }, [visible]);

  const total = form.qty * form.rate;
  const selectedProject = projects.find((p) => p.id === form.projectId) ?? null;
  const projectOptions: SelectOption[] = [
    { id: NO_PROJECT_ID, label: t('noProject'), icon: 'empty' as IconKey },
    ...projects.map((p) => ({ id: p.id, label: p.name, icon: 'project' as IconKey })),
  ];
  const canSave = form.material.name.trim().length > 0 && form.qty > 0 && form.rate >= 0;

  const onSave = () => {
    if (!canSave || saving) return;
    void (async () => {
      const ok = await runSave(async () => {
        // Persist a typed supplier (with phone) as a party so it's reusable and
        // callable next time.
        let partyId = form.partyId;
        const name = form.supplierName.trim();
        if (!partyId && name) {
          const existing = parties.find((p) => p.name.toLowerCase() === name.toLowerCase());
          partyId = existing
            ? existing.id
            : (await addParty({ type: 'SUPPLIER', name, phone: form.supplierPhone.trim() || null })).id;
        }
        await createBooking({
          itemName: form.material.name.trim(),
          qty: form.qty,
          rate: form.rate,
          unit: form.material.unit.primary,
          projectId: form.projectId,
          supplierName: name || null,
          partyId,
        });
        await onSaved();
      });
      if (ok) onClose();
    })();
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title={t('newBooking')}
      footer={<AppButton label={t('save')} icon="check" onPress={onSave} loading={saving} disabled={!canSave} />}
    >
      <MaterialItemPicker value={form.material} onChange={(material) => patch({ material })} />

      <QtyUnitRow unit={form.material.unit} resetToken={visible} onQty={(qty) => patch({ qty })} />

      <AmountInput label={t('rateLabel')} value={form.rate} onChange={(rate) => patch({ rate })} floating surface={theme.colors.card} />

      <View style={styles.totalRow}>
        <AppText size="sm" color="textSecondary">
          {t('totalLabel')}
        </AppText>
        <AppText size="xl" weight="bold" color="primary" tabular>
          {formatRupees(total)}
        </AppText>
      </View>

      {/* Supplier — a name field + saved-supplier quick-fill; a new supplier's
          phone is saved too so they're callable later. */}
      <FloatingLabelInput
        label={t('supplier')}
        value={form.supplierName}
        onChangeText={(v) => patch({ supplierName: v, partyId: null })}
      />
      {!form.partyId && form.supplierName.trim() ? (
        <FloatingLabelInput
          label={`${t('phone')} (${t('optional')})`}
          value={form.supplierPhone}
          onChangeText={(v) => patch({ supplierPhone: v })}
          mask="phone"
        />
      ) : null}
      {parties.length > 0 ? (
        <View style={styles.suggestWrap}>
          {parties.map((p) => {
            const on = form.partyId === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => patch({ partyId: p.id, supplierName: p.name, supplierPhone: p.phone ?? '' })}
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
        <AppText size="sm" weight="semibold" numberOfLines={1} style={styles.flex} color={selectedProject ? 'textPrimary' : 'textSecondary'}>
          {selectedProject?.name ?? t('noProject')}
        </AppText>
        <AppIcon name="forward" size={18} color="textSecondary" />
      </Pressable>

      <SelectSheet
        visible={projectSheet}
        onClose={() => setProjectSheet(false)}
        options={projectOptions}
        selectedId={form.projectId ?? NO_PROJECT_ID}
        title={t('selectProject')}
        searchable={false}
        onSelect={(o) => patch({ projectId: o.id === NO_PROJECT_ID ? null : o.id })}
      />
    </AppSheet>
  );
}
