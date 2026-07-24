import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import {
  AmountInput,
  AppButton,
  AppHeader,
  AppIcon,
  AppText,
  DateField,
  SelectSheet,
  StickyFooter,
  type SelectOption,
} from '@/components/ui';
import { getPlot, nowISO, SIZE_UNIT_LABEL_KEYS, SIZE_UNITS, updatePlot, type SizeUnit } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { swallow } from '@/utils/log';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type EditPlotRoute = RouteProp<RootStackParamList, 'EditPlot'>;

/** Edit an existing plot: correct its location, size, deal price, seller, and
 *  set the transfer deadline (which drives the Home deadline reminder). */
export function EditPlotScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { plotId } = useRoute<EditPlotRoute>().params;
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
  const [loaded, setLoaded] = useState(false);

  const [unitSheet, setUnitSheet] = useState(false);
  const { saving, run: runSave } = useSaveAction();

  // Prefill once from the stored plot (don't reload on data bumps mid-edit).
  useEffect(() => {
    let alive = true;
    getPlot(plotId)
      .then((p) => {
        if (!alive || !p) return;
        setName(p.name);
        setSociety(p.society ?? '');
        setBlock(p.block ?? '');
        setPlotNo(p.plot_no ?? '');
        setSize(p.size_value != null ? String(p.size_value) : '');
        setSizeUnit(p.size_unit ?? 'MARLA');
        setDealPrice(p.deal_price);
        setSellerName(p.seller_name ?? '');
        setSellerPhone(p.seller_phone ?? '');
        setDeadline(p.transfer_deadline);
        setLoaded(true);
      })
      .catch(swallow('EditPlot:load'));
    return () => {
      alive = false;
    };
  }, [plotId]);

  const unitOptions: SelectOption[] = useMemo(
    () => SIZE_UNITS.map((u) => ({ id: u, label: t(SIZE_UNIT_LABEL_KEYS[u]) })),
    [t]
  );

  const canSave = loaded && name.trim().length > 0 && dealPrice > 0;

  const onSave = async () => {
    if (!canSave || saving) return;
    const ok = await runSave(async () => {
      const sizeValue = Number(size);
      await updatePlot(plotId, {
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
    });
    if (ok) navigation.goBack();
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={t('editPlot')} onBack={() => navigation.goBack()} />

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
                {t(SIZE_UNIT_LABEL_KEYS[sizeUnit])}
              </AppText>
              <AppIcon name="forward" size={16} color="textSecondary" />
            </Pressable>
          </View>

          <AmountInput label={t('dealPrice')} value={dealPrice} onChange={setDealPrice} floating />

          <FloatingLabelInput label={t('sellerName')} value={sellerName} onChangeText={setSellerName} />
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
            label={t('save')}
            icon="check"
            onPress={onSave}
            loading={saving}
            disabled={!canSave}
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
    sizeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm },
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
