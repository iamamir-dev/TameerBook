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
import { addParty, createBooking, listParties, listProjects, updateBooking, type BookingSummary, type PartyRow, type ProjectRow } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { swallow } from '@/utils/log';
import { formatRupees } from '@/utils/money';
import type { UnitDef } from '@/utils/units';

import { makeStyles } from '../styled/NewBookingSheet.styles';

const EMPTY_UNIT: UnitDef = { primary: null, secondary: null, factor: null };

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Pass a booking to edit its record in place; omit/null to create a new one. */
  editing?: BookingSummary | null;
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
export function NewBookingSheet({ visible, onClose, editing, onSaved }: Props): React.JSX.Element {
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
    const b = editing?.booking;
    setForm(
      b
        ? {
            material: { categoryId: null, name: b.item_name, unit: { primary: b.unit, secondary: null, factor: null } },
            qty: b.qty,
            rate: b.rate,
            supplierName: b.supplier_name ?? '',
            supplierPhone: '',
            partyId: b.party_id,
            projectId: b.project_id,
          }
        : emptyForm()
    );
    listProjects().then((r) => setProjects(r.filter((p) => p.status === 'ACTIVE'))).catch(swallow('bookings:projects'));
    listParties('SUPPLIER').then(setParties).catch(swallow('bookings:parties'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // A booking with deliveries/payments can't move project or drop below what's
  // already received (cost is posted against the current project).
  const locked = !!editing && (editing.qtyReceived > 0.001 || editing.paid > 0.001);
  const minQty = editing?.qtyReceived ?? 0;

  const total = form.qty * form.rate;
  const selectedProject = projects.find((p) => p.id === form.projectId) ?? null;
  const projectOptions: SelectOption[] = projects.map((p) => ({ id: p.id, label: p.name, icon: 'project' as IconKey }));
  const hasSupplier = !!form.partyId || form.supplierName.trim().length > 0;
  const canSave =
    form.material.name.trim().length > 0 &&
    form.qty > 0 &&
    form.qty >= minQty - 0.001 &&
    form.rate > 0 &&
    form.qty * form.rate >= (editing?.paid ?? 0) - 0.001 &&
    !!form.projectId &&
    hasSupplier;

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
        const fields = {
          itemName: form.material.name.trim(),
          qty: form.qty,
          rate: form.rate,
          unit: form.material.unit.primary,
          secondaryUnit: form.material.unit.secondary,
          secondaryFactor: form.material.unit.factor,
          projectId: form.projectId,
          supplierName: name || null,
          partyId,
        };
        if (editing) {
          await updateBooking(editing.booking.id, fields);
        } else {
          await createBooking(fields);
        }
        await onSaved();
      });
      if (ok) onClose();
    })();
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title={editing ? t('editBooking') : t('newBooking')}
      footer={<AppButton label={t('save')} icon="check" onPress={onSave} loading={saving} disabled={!canSave} />}
    >
      <MaterialItemPicker value={form.material} onChange={(material) => patch({ material })} />

      <QtyUnitRow
        unit={form.material.unit}
        resetToken={visible}
        initialPrimary={editing?.booking.qty}
        onQty={(qty) => patch({ qty })}
        error={form.qty > 0 && form.qty < minQty - 0.001 ? `${t('receivedQty')}: ${minQty}` : null}
      />

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

      <Pressable
        onPress={() => !locked && setProjectSheet(true)}
        disabled={locked}
        style={styles.chip}
        accessibilityRole="button"
      >
        <AppIcon name="project" size={18} color="primary" />
        <AppText size="sm" weight="semibold" numberOfLines={1} style={styles.flex} color={selectedProject ? 'textPrimary' : 'textSecondary'}>
          {selectedProject?.name ?? t('selectProject')}
        </AppText>
        {!locked ? <AppIcon name="forward" size={18} color="textSecondary" /> : null}
      </Pressable>

      <SelectSheet
        visible={projectSheet}
        onClose={() => setProjectSheet(false)}
        options={projectOptions}
        selectedId={form.projectId ?? ''}
        title={t('selectProject')}
        searchable={false}
        onSelect={(o) => patch({ projectId: o.id })}
      />
    </AppSheet>
  );
}
