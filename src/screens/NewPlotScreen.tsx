import { useNavigation } from '@react-navigation/native';
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
  AppHeader,
  AppIcon,
  AppText,
  SelectSheet,
  type SelectOption,
} from '@/components/ui';
import { createPlot, SIZE_UNITS, type SizeUnit } from '@/db';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

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

  const [unitSheet, setUnitSheet] = useState(false);
  const [saving, setSaving] = useState(false);

  const unitOptions: SelectOption[] = useMemo(
    () => SIZE_UNITS.map((u) => ({ id: u, label: t(UNIT_LABEL[u]) })),
    [t]
  );

  const canCreate = name.trim().length > 0 && dealPrice > 0;

  const onCreate = async () => {
    if (!canCreate || saving) return;
    setSaving(true);
    try {
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
      });
      navigation.replace('PlotDetail', { plotId: plot.id });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={t('newPlot')} onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + theme.spacing.xxxl },
          ]}
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
            keyboardType="phone-pad"
            hint={t('hintPhone')}
          />

          <View style={styles.saveBtn}>
            <AppButton
              label={t('create')}
              icon="check"
              onPress={onCreate}
              loading={saving}
              disabled={!canCreate}
            />
          </View>
        </ScrollView>
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
    saveBtn: { marginTop: theme.spacing.sm },
  });
