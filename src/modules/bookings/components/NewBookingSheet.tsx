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
import { createBookings, listParties, listProjects, type PartyRow, type ProjectRow } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { swallow } from '@/utils/log';
import { formatRupees } from '@/utils/money';
import { formatQty, type UnitDef } from '@/utils/units';

import { makeStyles } from '../styled/NewBookingSheet.styles';

const NO_PROJECT_ID = '__none__';
const EMPTY_UNIT: UnitDef = { primary: null, secondary: null, factor: null };

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

/** One material line to book. */
interface Line {
  material: MaterialSelection;
  qty: number; // primary unit
  rate: number;
}

interface Draft {
  material: MaterialSelection;
  qty: number;
  rate: number;
}
const emptyDraft = (): Draft => ({ material: { categoryId: null, name: '', unit: EMPTY_UNIT }, qty: 0, rate: 0 });

/**
 * Book material ahead — several items from the SAME supplier in one go. Set the
 * supplier + project once, add each item (material + qty + rate) to the list,
 * then Save books them all atomically (one booking per item). On the shared
 * AppSheet with the shared MaterialItemPicker + QtyUnitRow.
 */
export function NewBookingSheet({ visible, onClose, onSaved }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { saving, run: runSave } = useSaveAction();

  const [supplierName, setSupplierName] = useState('');
  const [partyId, setPartyId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [draftNonce, setDraftNonce] = useState(0);

  const [parties, setParties] = useState<PartyRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectSheet, setProjectSheet] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSupplierName('');
    setPartyId(null);
    setProjectId(null);
    setLines([]);
    setDraft(emptyDraft());
    setDraftNonce((n) => n + 1);
    listProjects().then((r) => setProjects(r.filter((p) => p.status === 'ACTIVE'))).catch(swallow('bookings:projects'));
    listParties('SUPPLIER').then(setParties).catch(swallow('bookings:parties'));
  }, [visible]);

  const selectedProject = projects.find((p) => p.id === projectId) ?? null;
  const projectOptions: SelectOption[] = [
    { id: NO_PROJECT_ID, label: t('noProject'), icon: 'empty' as IconKey },
    ...projects.map((p) => ({ id: p.id, label: p.name, icon: 'project' as IconKey })),
  ];

  const draftValid = draft.material.name.trim().length > 0 && draft.qty > 0 && draft.rate >= 0;
  const allLines: Line[] = [...lines, ...(draftValid ? [draft] : [])];
  const grandTotal = allLines.reduce((s, l) => s + l.qty * l.rate, 0);
  const canSave = allLines.length > 0;

  const addLine = () => {
    if (!draftValid) return;
    setLines((ls) => [...ls, draft]);
    setDraft(emptyDraft());
    setDraftNonce((n) => n + 1);
  };
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  const onSave = () => {
    if (!canSave || saving) return;
    void (async () => {
      const ok = await runSave(async () => {
        await createBookings(
          allLines.map((l) => ({
            itemName: l.material.name.trim(),
            qty: l.qty,
            rate: l.rate,
            unit: l.material.unit.primary,
            projectId,
            supplierName: supplierName.trim() || null,
            partyId,
          }))
        );
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
      subtitle={allLines.length > 1 ? `${allLines.length} ${t('items')}` : undefined}
      footer={<AppButton label={t('save')} icon="check" onPress={onSave} loading={saving} disabled={!canSave} />}
    >
      {/* Supplier — one control: name field + saved-supplier quick-fill. */}
      <FloatingLabelInput label={t('supplier')} value={supplierName} onChangeText={(v) => { setSupplierName(v); setPartyId(null); }} />
      {parties.length > 0 ? (
        <View style={styles.suggestWrap}>
          {parties.map((p) => {
            const on = partyId === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => { setPartyId(p.id); setSupplierName(p.name); }}
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

      {/* Items already added */}
      <AppText size="overline" weight="bold" color="textSecondary" uppercase style={styles.sectionLabel}>
        {t('items')}
      </AppText>
      {lines.map((l, i) => (
        <View key={`${l.material.name}-${i}`} style={styles.itemRow}>
          <View style={styles.itemLeft}>
            <AppText size="sm" weight="bold" numberOfLines={1}>
              {l.material.name}
            </AppText>
            <AppText size="xs" color="textSecondary" numberOfLines={1}>
              {`${formatQty(l.qty, l.material.unit)} @ ${formatRupees(l.rate)} = ${formatRupees(l.qty * l.rate)}`}
            </AppText>
          </View>
          <Pressable onPress={() => removeLine(i)} accessibilityRole="button" accessibilityLabel={t('delete')} style={styles.removeBtn}>
            <AppIcon name="close" size={16} color="danger" />
          </Pressable>
        </View>
      ))}

      {/* Add-an-item mini form */}
      <View style={styles.addCard}>
        <MaterialItemPicker value={draft.material} onChange={(material) => setDraft((d) => ({ ...d, material }))} />
        <QtyUnitRow unit={draft.material.unit} resetToken={draftNonce} onQty={(qty) => setDraft((d) => ({ ...d, qty }))} />
        <AmountInput label={t('rateLabel')} value={draft.rate} onChange={(rate) => setDraft((d) => ({ ...d, rate }))} floating surface={theme.colors.background} />
        <AppButton label={t('addItem')} icon="add" variant="secondary" onPress={addLine} disabled={!draftValid} />
      </View>

      {grandTotal > 0 ? (
        <View style={styles.totalRow}>
          <AppText size="sm" weight="semibold" color="onHero">
            {t('totalLabel')}
          </AppText>
          <AppText size="xl" weight="bold" color="onHero" tabular>
            {formatRupees(grandTotal)}
          </AppText>
        </View>
      ) : null}

      <SelectSheet
        visible={projectSheet}
        onClose={() => setProjectSheet(false)}
        options={projectOptions}
        selectedId={projectId ?? NO_PROJECT_ID}
        title={t('selectProject')}
        searchable={false}
        onSelect={(o) => setProjectId(o.id === NO_PROJECT_ID ? null : o.id)}
      />
    </AppSheet>
  );
}
