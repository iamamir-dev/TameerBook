import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { AppButton, AppCard, AppHeader, AppIcon, AppText, SortableList } from '@/components/ui';
import {
  addCategory,
  deleteCategory,
  listCategoryTree,
  reorderCategories,
  updateCategory,
  type CategoryRow,
  type CategoryTreeNode,
  type CategoryType,
} from '@/db';
import { useCategoryLabel, useFocusReload, useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Editor =
  | { mode: 'addMain' }
  | { mode: 'addSub'; parentId: string }
  | { mode: 'edit'; cat: CategoryRow; isSub: boolean };

/** Tap-to-add suggestions per main heading, so users see common options. */
interface Suggestion {
  en: string;
  ur: string;
  unit?: string;
}
const SECTION_SUGGESTIONS: Record<string, Suggestion[]> = {
  Materials: [
    { en: 'Cement', ur: 'سیمنٹ', unit: 'bori' },
    { en: 'Sariya', ur: 'سریا', unit: 'kg' },
    { en: 'Steel', ur: 'اسٹیل', unit: 'kg' },
    { en: 'Bricks', ur: 'اینٹیں', unit: 'adad' },
    { en: 'Blocks', ur: 'بلاک', unit: 'adad' },
    { en: 'Sand', ur: 'ریت', unit: 'truck' },
    { en: 'Crush', ur: 'بجری', unit: 'truck' },
    { en: 'Gravel', ur: 'روڑی', unit: 'truck' },
    { en: 'Tiles', ur: 'ٹائلیں', unit: 'adad' },
    { en: 'Marble', ur: 'ماربل', unit: 'ft' },
    { en: 'Wood', ur: 'لکڑی', unit: 'ft' },
    { en: 'Paint', ur: 'پینٹ', unit: 'kg' },
    { en: 'Electric', ur: 'بجلی کا سامان' },
    { en: 'Wiring/Cables', ur: 'تاریں' },
    { en: 'Sanitary', ur: 'سینٹری' },
    { en: 'Pipes/Plumbing', ur: 'پائپ/پلمبنگ' },
    { en: 'Glass', ur: 'شیشہ', unit: 'ft' },
    { en: 'Iron/Grill', ur: 'لوہا/گرل', unit: 'kg' },
    { en: 'Doors', ur: 'دروازے', unit: 'adad' },
    { en: 'Windows', ur: 'کھڑکیاں', unit: 'adad' },
    { en: 'Gypsum/Ceiling', ur: 'جپسم/چھت', unit: 'ft' },
    { en: 'Waterproofing', ur: 'واٹر پروفنگ', unit: 'kg' },
    { en: 'Hardware/Nails', ur: 'ہارڈ ویئر/کیل' },
    { en: 'Kitchen Fittings', ur: 'کچن کا سامان' },
    { en: 'Bath Fittings', ur: 'باتھ کا سامان' },
  ],
  'Home Expense': [
    { en: 'Groceries', ur: 'راشن' },
    { en: 'Electricity Bill', ur: 'بجلی کا بل' },
    { en: 'Gas Bill', ur: 'گیس کا بل' },
    { en: 'Water Bill', ur: 'پانی کا بل' },
    { en: 'Rent', ur: 'کرایہ' },
    { en: 'School Fees', ur: 'اسکول فیس' },
    { en: 'Medical', ur: 'علاج' },
    { en: 'Transport/Fuel', ur: 'ٹرانسپورٹ/پٹرول' },
    { en: 'Mobile/Internet', ur: 'موبائل/انٹرنیٹ' },
    { en: 'Clothing', ur: 'کپڑے' },
    { en: 'Maid/Servant', ur: 'ملازم' },
    { en: 'Charity/Zakat', ur: 'خیرات/زکوٰۃ' },
    { en: 'Functions/Events', ur: 'تقریبات' },
    { en: 'Furniture', ur: 'فرنیچر' },
    { en: 'Repairs', ur: 'مرمت' },
  ],
  Labor: [
    { en: 'Labor Dehari', ur: 'مزدور دیہاڑی' },
    { en: 'Contractor', ur: 'ٹھیکیدار' },
    { en: 'Mistri', ur: 'مستری' },
    { en: 'Helper/Mazdoor', ur: 'مزدور' },
    { en: 'Electrician', ur: 'الیکٹریشن' },
    { en: 'Plumber', ur: 'پلمبر' },
    { en: 'Painter', ur: 'پینٹر' },
    { en: 'Carpenter', ur: 'ترکھان' },
    { en: 'Welder', ur: 'ویلڈر' },
    { en: 'Tile Fitter', ur: 'ٹائل لگانے والا' },
    { en: 'Steel Fixer', ur: 'سریا مستری' },
  ],
  Plot: [
    { en: 'Transfer Fees & Tax', ur: 'ٹرانسفر فیس و ٹیکس' },
    { en: 'Naqsha/Approval', ur: 'نقشہ/منظوری' },
    { en: 'Dealer Commission', ur: 'ڈیلر کمیشن' },
    { en: 'Registry', ur: 'رجسٹری' },
    { en: 'Stamp Duty', ur: 'اسٹامپ ڈیوٹی' },
    { en: 'NOC/NDC', ur: 'این او سی' },
    { en: 'Possession Charges', ur: 'قبضہ چارجز' },
    { en: 'Development Charges', ur: 'ڈیولپمنٹ چارجز' },
    { en: 'Boundary Wall', ur: 'چار دیواری' },
  ],
  Sale: [
    { en: 'Dealer Commission', ur: 'ڈیلر کمیشن' },
    { en: 'Transfer Cost', ur: 'ٹرانسفر خرچ' },
    { en: 'Advertising', ur: 'اشتہار' },
    { en: 'Legal/Documentation', ur: 'قانونی/دستاویزات' },
    { en: 'Gain Tax', ur: 'گین ٹیکس' },
  ],
  'Other Income': [
    { en: 'Rent Received', ur: 'کرایہ وصول' },
    { en: 'Resale Profit', ur: 'دوبارہ فروخت منافع' },
    { en: 'Refund', ur: 'واپسی' },
    { en: 'Commission Received', ur: 'کمیشن وصول' },
  ],
};

/**
 * Manage expense & income categories as a main→sub tree (Settings → Categories).
 * "Materials", "Home Expense", etc. are main headings; their sub-categories are
 * the things you actually book against. Material sub-categories can carry a
 * default unit. System categories (used by the app's own postings) are locked.
 */
export function CategoriesScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const label = useCategoryLabel();

  const [type, setType] = useState<CategoryType>('EXPENSE');
  const [tree, setTree] = useState<CategoryTreeNode[] | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [secUnit, setSecUnit] = useState('');
  const [secFactor, setSecFactor] = useState('');
  const { saving, run } = useSaveAction();

  const load = useCallback(async () => setTree(await listCategoryTree(type)), [type]);
  // Re-load when the tab changes; tree=null meanwhile → skeleton.
  const { reload } = useFocusReload(load);
  useEffect(() => {
    void load();
  }, [load]);

  const resetUnitFields = () => {
    setUnit('');
    setSecUnit('');
    setSecFactor('');
  };
  const openAddMain = () => {
    setName('');
    resetUnitFields();
    setEditor({ mode: 'addMain' });
  };
  const openAddSub = (parentId: string) => {
    setName('');
    resetUnitFields();
    setEditor({ mode: 'addSub', parentId });
  };
  const openEdit = (cat: CategoryRow, isSub: boolean) => {
    setName(cat.name_en);
    setUnit(cat.default_unit ?? '');
    setSecUnit(cat.secondary_unit ?? '');
    setSecFactor(cat.secondary_factor ? String(cat.secondary_factor) : '');
    setEditor({ mode: 'edit', cat, isSub });
  };

  const showUnit = editor?.mode === 'addSub' || (editor?.mode === 'edit' && editor.isSub);

  const save = () => {
    if (!editor || !name.trim() || saving) return;
    // Secondary unit only meaningful with a primary unit + a positive factor.
    const secondaryUnit = unit.trim() && secUnit.trim() ? secUnit.trim() : null;
    const secondaryFactor = secondaryUnit && Number(secFactor) > 0 ? Number(secFactor) : null;
    void (async () => {
      const ok = await run(async () => {
        if (editor.mode === 'edit') {
          await updateCategory(editor.cat.id, {
            name,
            defaultUnit: unit.trim() || null,
            secondaryUnit: secondaryFactor ? secondaryUnit : null,
            secondaryFactor,
          });
        } else {
          await addCategory({
            nameEn: name,
            nameUr: name,
            type,
            parentId: editor.mode === 'addSub' ? editor.parentId : null,
            defaultUnit: unit.trim() || null,
            secondaryUnit: secondaryFactor ? secondaryUnit : null,
            secondaryFactor,
          });
        }
      });
      if (ok) {
        setEditor(null);
        await reload();
      }
    })();
  };

  const reorderSubs = (orderedIds: string[]) => {
    void (async () => {
      const ok = await run(() => reorderCategories(orderedIds));
      if (ok) await reload();
    })();
  };

  const addSuggested = (parentId: string, s: Suggestion) => {
    void (async () => {
      const ok = await run(() =>
        addCategory({ nameEn: s.en, nameUr: s.ur, type, parentId, defaultUnit: s.unit ?? null }).then(() => undefined)
      );
      if (ok) await reload();
    })();
  };

  const confirmDelete = (cat: CategoryRow) => {
    Alert.alert(label(cat), t('deleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const ok = await run(() => deleteCategory(cat.id));
            if (ok) await reload();
          })();
        },
      },
    ]);
  };

  const rowActions = (cat: CategoryRow) =>
    cat.is_system ? (
      <AppIcon name="key" size={16} color="textSecondary" />
    ) : (
      <View style={styles.actions}>
        <Pressable onPress={() => openEdit(cat, !!cat.parent_id)} hitSlop={theme.touch.hitSlop} accessibilityLabel={t('edit')}>
          <AppIcon name="edit" size={18} color="textSecondary" />
        </Pressable>
        <Pressable onPress={() => confirmDelete(cat)} hitSlop={theme.touch.hitSlop} accessibilityLabel={t('delete')}>
          <AppIcon name="close" size={18} color="danger" />
        </Pressable>
      </View>
    );

  return (
    <View style={styles.screen}>
      <AppHeader title={t('manageCategories')} onBack={() => navigation.goBack()} />

      {/* Expense / Income segment */}
      <View style={styles.segment}>
        {(['EXPENSE', 'INCOME'] as CategoryType[]).map((tp) => {
          const active = type === tp;
          return (
            <Pressable
              key={tp}
              onPress={() => {
                setTree(null);
                setType(tp);
              }}
              style={[styles.segBtn, active && styles.segBtnActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <AppText size="sm" weight="bold" color={active ? 'onAccent' : 'textSecondary'}>
                {t(tp === 'EXPENSE' ? 'kharcha' : 'aamdani')}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        {tree === null
          ? [0, 1, 2].map((i) => (
              <AppCard key={i} style={styles.card}>
                <View style={styles.skelTitle} />
                <View style={styles.skelRow} />
                <View style={styles.skelRow} />
                <View style={[styles.skelRow, styles.skelShort]} />
              </AppCard>
            ))
          : null}
        {(tree ?? []).map((main) => (
          <AppCard key={main.id} style={styles.card}>
            <View style={styles.mainRow}>
              <AppIcon name={(main.icon as never) ?? 'kharcha'} size={18} color="primary" />
              <AppText size="md" weight="bold" style={styles.flex} numberOfLines={1}>
                {label(main)}
              </AppText>
              {rowActions(main)}
            </View>

            {main.children.length > 0 ? (
              <SortableList
                items={main.children}
                keyOf={(c) => c.id}
                rowHeight={44}
                onReorder={reorderSubs}
                renderItem={(sub) => (
                  <View style={styles.subRow}>
                    <AppIcon name="reorder" size={14} color="textSecondary" />
                    <AppText size="sm" style={styles.flex} numberOfLines={1}>
                      {label(sub)}
                    </AppText>
                    {sub.default_unit ? (
                      <AppText size="xs" color="textSecondary">
                        {sub.default_unit}
                      </AppText>
                    ) : null}
                    {rowActions(sub)}
                  </View>
                )}
              />
            ) : null}

            {/* Tap-to-add suggestions the user hasn't added yet. */}
            {(() => {
              const have = new Set(main.children.map((c) => c.name_en.toLowerCase()));
              const suggestions = (SECTION_SUGGESTIONS[main.name_en] ?? []).filter(
                (s) => !have.has(s.en.toLowerCase())
              );
              if (suggestions.length === 0) return null;
              return (
                <View style={styles.suggestWrap}>
                  {suggestions.map((s) => (
                    <Pressable
                      key={s.en}
                      onPress={() => addSuggested(main.id, s)}
                      style={styles.suggestChip}
                      accessibilityRole="button"
                    >
                      <AppIcon name="add" size={13} color="textSecondary" />
                      <AppText size="xs" weight="semibold" color="textSecondary">
                        {s.en}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
              );
            })()}

            <Pressable onPress={() => openAddSub(main.id)} style={styles.addSub} accessibilityRole="button">
              <AppIcon name="add" size={16} color="accent" />
              <AppText size="xs" weight="bold" color="accent">
                {t('addSubcategory')}
              </AppText>
            </Pressable>
          </AppCard>
        ))}

        <AppButton label={t('addCategoryLabel')} icon="add" variant="secondary" onPress={openAddMain} />
      </ScrollView>

      {/* Add / edit sheet */}
      <Modal visible={!!editor} transparent animationType="slide" onRequestClose={() => setEditor(null)}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.backdrop} onPress={() => setEditor(null)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
            <View style={styles.grabber} />
            <AppText size="lg" weight="bold">
              {editor?.mode === 'edit'
                ? t('edit')
                : editor?.mode === 'addSub'
                  ? t('addSubcategory')
                  : t('addCategoryLabel')}
            </AppText>
            <FloatingLabelInput label={t('name')} value={name} onChangeText={setName} />
            {showUnit ? (
              <>
                <FloatingLabelInput label={`${t('defaultUnit')} (${t('optional')})`} value={unit} onChangeText={setUnit} />
                {/* Optional smaller sub-unit + how many make one main unit. */}
                {unit.trim() ? (
                  <>
                    <FloatingLabelInput label={`${t('secondaryUnit')} (${t('optional')})`} value={secUnit} onChangeText={setSecUnit} />
                    {secUnit.trim() ? (
                      <FloatingLabelInput
                        label={`1 ${unit.trim()} = ? ${secUnit.trim()}`}
                        value={secFactor}
                        onChangeText={setSecFactor}
                        keyboardType="number-pad"
                      />
                    ) : null}
                  </>
                ) : null}
              </>
            ) : null}
            <AppButton label={t('save')} icon="check" onPress={save} loading={saving} disabled={!name.trim()} />
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
    // Loading skeleton — categories can take a moment on first open.
    skelTitle: { height: 18, width: '40%', borderRadius: 6, backgroundColor: theme.colors.track },
    skelRow: { height: 34, borderRadius: theme.radius.md, backgroundColor: theme.colors.track, opacity: 0.6 },
    skelShort: { width: '60%' },
    segment: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
      margin: theme.spacing.lg,
      padding: 3,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.card,
    },
    segBtn: { flex: 1, alignItems: 'center', paddingVertical: theme.spacing.sm, borderRadius: theme.radius.pill },
    segBtnActive: { backgroundColor: theme.colors.accent },
    content: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md },
    card: { gap: theme.spacing.sm },
    mainRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    subRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingLeft: theme.spacing.md,
    },
    addSub: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      alignSelf: 'flex-start',
      paddingTop: theme.spacing.xs,
    },
    suggestWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs, paddingTop: theme.spacing.xs },
    suggestChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingVertical: 5,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.colors.border,
    },
    actions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
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
