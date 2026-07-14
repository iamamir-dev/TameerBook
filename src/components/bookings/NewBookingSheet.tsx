import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { AppButton, AppIcon, AppText, SelectSheet, type IconKey, type SelectOption } from '@/components/ui';
import { createBooking, listParties, listProjects, listSubcategories, type CategoryRow, type PartyRow, type ProjectRow } from '@/db';
import { useCategoryLabel, useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { swallow } from '@/utils/log';
import { formatRupees } from '@/utils/money';

const NO_PROJECT_ID = '__none__';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called after the booking is saved (parent reloads its list). */
  onSaved: () => Promise<void> | void;
}

/**
 * Book material ahead: "5000 bricks @ Rs 10 = Rs 50,000". Only the deal is
 * recorded here — deliveries and payments land later against the booking.
 * Optionally pinned to an ACTIVE project so payments hit its cost.
 */
export function NewBookingSheet({ visible, onClose, onSaved }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [itemName, setItemName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');
  const [rate, setRate] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [partyId, setPartyId] = useState<string | null>(null);
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [supplierSheet, setSupplierSheet] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectSheet, setProjectSheet] = useState(false);
  const [materials, setMaterials] = useState<CategoryRow[]>([]);
  const [itemSheet, setItemSheet] = useState(false);

  const { saving, run: runSave } = useSaveAction();
  const label = useCategoryLabel();

  // Fresh form every open; projects + materials fetched here so lists are current.
  useEffect(() => {
    if (!visible) return;
    setItemName('');
    setQty('');
    setUnit('');
    setRate('');
    setSupplierName('');
    setProjectId(null);
    listProjects()
      .then((rows) => setProjects(rows.filter((p) => p.status === 'ACTIVE')))
      .catch(swallow('bookings:projects'));
    // Materials are the sub-categories under the "Materials" heading (Settings).
    listSubcategories('Materials').then(setMaterials).catch(swallow('bookings:materials'));
    listParties('SUPPLIER').then(setParties).catch(swallow('bookings:parties'));
    setPartyId(null);
  }, [visible]);

  const qtyNum = Number(qty) || 0;
  const rateNum = Number(rate) || 0;
  const total = qtyNum * rateNum;
  const selectedProject = projects.find((p) => p.id === projectId) ?? null;

  const projectOptions: SelectOption[] = [
    { id: NO_PROJECT_ID, label: t('noProject'), icon: 'empty' as IconKey },
    ...projects.map((p) => ({ id: p.id, label: p.name, icon: 'project' as IconKey })),
  ];

  const canSave = itemName.trim().length > 0 && qtyNum > 0 && rateNum > 0;

  const onSave = () => {
    if (!canSave || saving) return;
    void (async () => {
      const ok = await runSave(async () => {
        await createBooking({
          itemName: itemName.trim(),
          qty: qtyNum,
          rate: rateNum,
          unit: unit.trim() || null,
          projectId,
          supplierName: supplierName.trim() || null,
          partyId,
        });
        await onSaved();
      });
      if (ok) onClose();
    })();
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
            <View style={styles.grabber} />
            <AppText size="lg" weight="bold">
              {t('newBooking')}
            </AppText>

            {/* Material picked from the managed list (Settings → Categories →
                Materials). Picking one auto-fills its default unit. */}
            {materials.length > 0 ? (
              <Pressable onPress={() => setItemSheet(true)} style={styles.rowChip} accessibilityRole="button">
                <AppIcon name="material" size={18} color="primary" />
                <AppText size="sm" weight="semibold" numberOfLines={1} style={styles.flex} color={itemName ? 'textPrimary' : 'textSecondary'}>
                  {itemName || t('itemName')}
                </AppText>
                <AppIcon name="forward" size={18} color="textSecondary" />
              </Pressable>
            ) : (
              <FloatingLabelInput label={t('itemName')} value={itemName} onChangeText={setItemName} />
            )}

            <View style={styles.row}>
              <View style={styles.flex}>
                <FloatingLabelInput label={t('qtyLabel')} value={qty} onChangeText={setQty} keyboardType="number-pad" />
              </View>
              <View style={styles.flex}>
                <FloatingLabelInput label={t('unitLabel')} value={unit} onChangeText={setUnit} />
              </View>
            </View>
            {/* Common construction units — one tap instead of typing. */}
            <View style={styles.unitChips}>
              {['bori', 'bag', 'ft', 'kg', 'truck', 'adad'].map((u) => (
                <Pressable
                  key={u}
                  onPress={() => setUnit(u)}
                  accessibilityRole="button"
                  style={[styles.unitChip, unit === u && styles.unitChipActive]}
                >
                  <AppText size="xs" weight="semibold" color={unit === u ? 'onAccent' : 'textSecondary'}>
                    {u}
                  </AppText>
                </Pressable>
              ))}
            </View>
            <FloatingLabelInput label={t('rateLabel')} value={rate} onChangeText={setRate} keyboardType="number-pad" />

            {/* Live deal value: qty × rate */}
            <View style={styles.totalRow}>
              <AppText size="sm" color="textSecondary">
                {t('totalLabel')}
              </AppText>
              <AppText size="xl" weight="bold" color="primary" tabular>
                {formatRupees(total)}
              </AppText>
            </View>

            {parties.length > 0 ? (
              <Pressable onPress={() => setSupplierSheet(true)} style={styles.rowChip} accessibilityRole="button">
                <AppIcon name="investor" size={18} color="primary" />
                <AppText size="sm" weight="semibold" numberOfLines={1} style={styles.flex} color={partyId ? 'textPrimary' : 'textSecondary'}>
                  {partyId ? supplierName : t('selectSavedSupplier')}
                </AppText>
                <AppIcon name="forward" size={18} color="textSecondary" />
              </Pressable>
            ) : null}
            <FloatingLabelInput
              label={t('supplier')}
              value={supplierName}
              onChangeText={(v) => {
                setSupplierName(v);
                setPartyId(null); // typing a custom name unlinks the saved party
              }}
            />

            <Pressable onPress={() => setProjectSheet(true)} style={styles.rowChip} accessibilityRole="button">
              <AppIcon name="project" size={18} color="primary" />
              <AppText
                size="sm"
                weight="semibold"
                numberOfLines={1}
                style={styles.flex}
                color={selectedProject ? 'textPrimary' : 'textSecondary'}
              >
                {selectedProject?.name ?? t('noProject')}
              </AppText>
              <AppIcon name="forward" size={18} color="textSecondary" />
            </Pressable>

            <AppButton label={t('save')} icon="check" onPress={onSave} loading={saving} disabled={!canSave} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <SelectSheet
        visible={projectSheet}
        onClose={() => setProjectSheet(false)}
        options={projectOptions}
        selectedId={projectId ?? NO_PROJECT_ID}
        title={t('selectProject')}
        searchable={false}
        onSelect={(o) => setProjectId(o.id === NO_PROJECT_ID ? null : o.id)}
      />

      <SelectSheet
        visible={supplierSheet}
        onClose={() => setSupplierSheet(false)}
        options={parties.map((p) => ({ id: p.id, label: p.name }))}
        title={t('supplier')}
        onSelect={(o) => {
          const p = parties.find((x) => x.id === o.id);
          if (p) {
            setPartyId(p.id);
            setSupplierName(p.name);
          }
        }}
      />

      <SelectSheet
        visible={itemSheet}
        onClose={() => setItemSheet(false)}
        options={materials.map((m) => ({ id: m.id, label: label(m) }))}
        title={t('itemName')}
        onSelect={(o) => {
          const m = materials.find((x) => x.id === o.id);
          if (m) {
            setItemName(label(m));
            if (m.default_unit) setUnit(m.default_unit);
          }
        }}
      />
    </>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    row: { flexDirection: 'row', gap: theme.spacing.md },
    unitChips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
    unitChip: {
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    unitChipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
    totalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.primarySoft,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
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
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.overlay,
    },
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
    grabber: {
      alignSelf: 'center',
      width: 44,
      height: 5,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.track,
    },
  });
