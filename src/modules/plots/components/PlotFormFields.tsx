import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import {
  AmountInput,
  AppButton,
  AppIcon,
  AppText,
  DateField,
  SelectSheet,
  type SelectOption,
} from '@/components/ui';
import { nowISO, SIZE_UNIT_LABEL_KEYS, SIZE_UNITS, type SizeUnit } from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';

import type { PlotForm } from '../hooks/usePlotForm';
import { makeStyles } from '../styled/PlotFormFields.styles';

interface Props {
  form: PlotForm;
  patch: (p: Partial<PlotForm>) => void;
}

/**
 * The shared plot form body (location, size + unit, deal price, seller, transfer
 * deadline) used by both the New and Edit plot screens — the one place these
 * fields are defined, so the two screens can never drift apart.
 */
export function PlotFormFields({ form, patch }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const [unitSheet, setUnitSheet] = useState(false);

  const unitOptions: SelectOption[] = useMemo(
    () => SIZE_UNITS.map((u) => ({ id: u, label: t(SIZE_UNIT_LABEL_KEYS[u]) })),
    [t]
  );

  return (
    <>
      <FloatingLabelInput label={t('plotName')} value={form.name} onChangeText={(name) => patch({ name })} />
      <FloatingLabelInput
        label={t('society')}
        value={form.society}
        onChangeText={(society) => patch({ society })}
        hint={t('hintSociety')}
      />
      <FloatingLabelInput label={t('block')} value={form.block} onChangeText={(block) => patch({ block })} />
      <FloatingLabelInput label={t('plotNo')} value={form.plotNo} onChangeText={(plotNo) => patch({ plotNo })} />

      {/* Size + unit */}
      <View style={styles.sizeRow}>
        <View style={styles.flex}>
          <FloatingLabelInput
            label={t('size')}
            value={form.size}
            onChangeText={(size) => patch({ size })}
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
            {t(SIZE_UNIT_LABEL_KEYS[form.sizeUnit])}
          </AppText>
          <AppIcon name="forward" size={16} color="textSecondary" />
        </Pressable>
      </View>

      <AmountInput label={t('dealPrice')} value={form.dealPrice} onChange={(dealPrice) => patch({ dealPrice })} floating />

      <FloatingLabelInput label={t('sellerName')} value={form.sellerName} onChangeText={(sellerName) => patch({ sellerName })} />
      <FloatingLabelInput
        label={t('sellerPhone')}
        value={form.sellerPhone}
        onChangeText={(sellerPhone) => patch({ sellerPhone })}
        mask="phone"
        hint={t('hintPhone')}
      />

      {/* Transfer deadline (optional) — drives the Home reminder. */}
      <AppText size="sm" weight="bold" color="textSecondary" style={styles.sectionLabel}>
        {t('transferDeadline')}
      </AppText>
      {form.deadline ? (
        <View style={styles.deadlineRow}>
          <View style={styles.flex}>
            <DateField value={form.deadline} onChange={(deadline) => patch({ deadline })} />
          </View>
          <Pressable
            onPress={() => patch({ deadline: null })}
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
          onPress={() => patch({ deadline: nowISO().slice(0, 10) })}
          fullWidth={false}
        />
      )}

      <SelectSheet
        visible={unitSheet}
        onClose={() => setUnitSheet(false)}
        options={unitOptions}
        selectedId={form.sizeUnit}
        title={t('sizeUnit')}
        searchable={false}
        onSelect={(o) => patch({ sizeUnit: o.id as SizeUnit })}
      />
    </>
  );
}
