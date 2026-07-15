import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
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
  type SelectOption,
} from '@/components/ui';
import { createPlot, includePlotInProject, nowISO, SIZE_UNITS, type SizeUnit } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type NewPlotRoute = RouteProp<RootStackParamList, 'NewPlot'>;

const UNIT_LABEL: Record<SizeUnit, TranslationKey> = {
  MARLA: 'unitMarla',
  KANAL: 'unitKanal',
  SQYD: 'unitSqyd',
};

/** Record a new plot purchase: location, size, deal price, and the seller. */
export function NewPlotScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const forProjectId = useRoute<NewPlotRoute>().params?.forProjectId;
  const returnAfterCreate = useRoute<NewPlotRoute>().params?.returnAfterCreate ?? false;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [name, setName] = useState('');
  const [society, setSociety] = useState('');
  const [block, setBlock] = useState('');
  const [plotNo, setPlotNo] = useState('');
  const [size, setSize] = useState('');
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>('MARLA');
  const [dealPrice, setDealPrice] = useState(0);
  const [sellerName, setSellerName] = useState('');
  const [sellerPhone, setSellerPhone] = useState('');
  const [deadline, setDeadline] = useState<string | null>(null);

  const [unitSheet, setUnitSheet] = useState(false);
  const { saving, run: runSave } = useSaveAction();

  const unitOptions: SelectOption[] = useMemo(
    () => SIZE_UNITS.map((u) => ({ id: u, label: t(UNIT_LABEL[u]) })),
    [t]
  );

  const canCreate = name.trim().length > 0 && dealPrice > 0;

  const onCreate = async () => {
    if (!canCreate || saving) return;
    let plotId: string | null = null;
    const ok = await runSave(async () => {
      const sizeValue = Number(size);
      const plot = await createPlot({
        name: name.trim(),
        society: society.trim() || null,
        block: block.trim() || null,
        plotNo: plotNo.trim() || null,
        sizeValue: Number.isFinite(sizeValue) && sizeValue > 0 ? sizeValue : null,
        sizeUnit: size.trim() ? sizeUnit : null,
        dealPrice,
        sellerName: sellerName.trim() || null,
        sellerPhone: sellerPhone.trim() || null,
        transferDeadline: deadline,
      });
      plotId = plot.id;
      // Created from inside a project's "Add plot" flow → include it now so
      // the user lands back on the project with the plot already attached.
      if (forProjectId) await includePlotInProject(plot.id, forProjectId);
    });
    if (!ok || !plotId) return;
    // Back to the project (it refetches on focus) when we came from one;
    // otherwise open the new plot's detail as before.
    // From a project's add-plot flow or the New Project wizard → return to the
    // caller (it refetches on focus and auto-selects the new plot). Otherwise
    // open the created plot's detail as before.
    if (forProjectId || returnAfterCreate) navigation.goBack();
    else navigation.replace('PlotDetail', { plotId });
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={t('newPlot')} onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: theme.spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FloatingLabelInput label={t('plotName')} value={name} onChangeText={setName} />
          <FloatingLabelInput
            label={t('society')}
            value={society}
            onChangeText={setSociety}
            hint={t('hintSociety')}
          />
          <FloatingLabelInput label={t('block')} value={block} onChangeText={setBlock} />
          <FloatingLabelInput label={t('plotNo')} value={plotNo} onChangeText={setPlotNo} />

          {/* Size + unit */}
          <View style={styles.sizeRow}>
            <View style={styles.flex}>
              <FloatingLabelInput
                label={t('size')}
                value={size}
                onChangeText={setSize}
                keyboardType="numeric"
              />
            </View>
            <Pressable
              onPress={() => setUnitSheet(true)}
              accessibilityRole="button"
              accessibilityLabel={t('sizeUnit')}
              style={styles.unitChip}
            >
              <AppText size="sm" weight="bold">
                {t(UNIT_LABEL[sizeUnit])}
              </AppText>
              <AppIcon name="forward" size={16} color="textSecondary" />
            </Pressable>
          </View>

          <AmountInput label={t('dealPrice')} value={dealPrice} onChange={setDealPrice} floating />

          <FloatingLabelInput
            label={t('sellerName')}
            value={sellerName}
            onChangeText={setSellerName}
          />
          <FloatingLabelInput
            label={t('sellerPhone')}
            value={sellerPhone}
            onChangeText={setSellerPhone}
            mask="phone"
            hint={t('hintPhone')}
          />

          {/* Transfer deadline (optional) — drives the Home reminder. */}
          <AppText size="sm" weight="bold" color="textSecondary" style={styles.sectionLabel}>
            {t('transferDeadline')}
          </AppText>
          {deadline ? (
            <View style={styles.deadlineRow}>
              <View style={styles.flex}>
                <DateField value={deadline} onChange={setDeadline} />
              </View>
              <Pressable
                onPress={() => setDeadline(null)}
                accessibilityRole="button"
                hitSlop={theme.touch.hitSlop}
                style={styles.clearChip}
              >
                <AppText size="sm" weight="bold" color="danger">
                  {t('clearDeadline')}
                </AppText>
              </Pressable>
            </View>
          ) : (
            <AppButton
              variant="secondary"
              label={t('setTransferDeadline')}
              icon="today"
              onPress={() => setDeadline(nowISO().slice(0, 10))}
              fullWidth={false}
            />
          )}
        </ScrollView>

        <StickyFooter>
          <AppButton
            label={t('create')}
            icon="check"
            onPress={onCreate}
            loading={saving}
            disabled={!canCreate}
          />
        </StickyFooter>
      </KeyboardAvoidingView>

      <SelectSheet
        visible={unitSheet}
        onClose={() => setUnitSheet(false)}
        options={unitOptions}
        selectedId={sizeUnit}
        title={t('sizeUnit')}
        searchable={false}
        onSelect={(o) => setSizeUnit(o.id as SizeUnit)}
      />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    sizeRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
    },
    unitChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      height: theme.touch.minTarget,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    sectionLabel: { marginTop: theme.spacing.sm },
    deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    clearChip: { paddingVertical: theme.spacing.xs, paddingHorizontal: theme.spacing.sm },
  });
