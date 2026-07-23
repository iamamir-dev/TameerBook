import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { listSubcategories, type CategoryRow } from '@/db';
import { useCategoryLabel } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { swallow } from '@/utils/log';
import type { UnitDef } from '@/utils/units';

import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import { SelectSheet } from './SelectSheet';

export interface MaterialSelection {
  categoryId: string | null;
  name: string;
  unit: UnitDef;
}

const unitOf = (c: CategoryRow): UnitDef => ({
  primary: c.default_unit,
  secondary: c.secondary_unit,
  factor: c.secondary_factor,
});

interface MaterialItemPickerProps {
  value: MaterialSelection;
  onChange: (sel: MaterialSelection) => void;
  label?: string;
  /** Material category ids to hide from the list (e.g. already added elsewhere). */
  excludeIds?: string[];
}

/**
 * The ONE material picker — choose a material from the Settings-managed
 * "Materials" subtree (which carries its primary + secondary units), or type a
 * free name when none are managed yet. Shared by New Booking, Material Entry and
 * the construction Add-Expense sheet so the item source is identical everywhere.
 */
export function MaterialItemPicker({ value, onChange, label, excludeIds }: MaterialItemPickerProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const catLabel = useCategoryLabel();

  const [materials, setMaterials] = useState<CategoryRow[]>([]);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    listSubcategories('Materials').then(setMaterials).catch(swallow('material:list'));
  }, []);

  if (materials.length === 0) {
    // No managed materials yet — free-text name.
    return (
      <View style={styles.freeWrap}>
        <AppText size="xs" weight="semibold" color="textSecondary">
          {label ?? t('itemName')}
        </AppText>
        <TextInput
          value={value.name}
          onChangeText={(name) => onChange({ categoryId: null, name, unit: { primary: null, secondary: null, factor: null } })}
          placeholder={t('itemName')}
          placeholderTextColor={theme.colors.textSecondary}
          style={styles.input}
        />
      </View>
    );
  }

  return (
    <>
      <Pressable onPress={() => setSheet(true)} style={styles.chip} accessibilityRole="button">
        <AppIcon name="material" size={18} color="primary" />
        <AppText size="sm" weight="semibold" numberOfLines={1} style={styles.flex} color={value.name ? 'textPrimary' : 'textSecondary'}>
          {value.name || (label ?? t('itemName'))}
        </AppText>
        <AppIcon name="forward" size={18} color="textSecondary" />
      </Pressable>

      <SelectSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        options={materials.map((m) => ({
          id: m.id,
          label: catLabel(m),
          subtitle: m.default_unit ?? undefined,
          disabled: m.id !== value.categoryId && (excludeIds ?? []).includes(m.id),
        }))}
        selectedId={value.categoryId ?? undefined}
        title={label ?? t('itemName')}
        onSelect={(o) => {
          const m = materials.find((x) => x.id === o.id);
          if (m) onChange({ categoryId: m.id, name: catLabel(m), unit: unitOf(m) });
        }}
      />
    </>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    chip: {
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
    freeWrap: {
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      gap: 2,
    },
    input: {
      fontFamily: theme.typography.weights.semibold,
      fontSize: theme.typography.sizes.md,
      color: theme.colors.textPrimary,
      padding: 0,
      includeFontPadding: false,
    },
  });
