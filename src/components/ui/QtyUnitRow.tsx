import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { hasSecondary, type UnitDef } from '@/utils/units';

import { AppText } from './AppText';

interface QtyUnitRowProps {
  /** Emits the quantity in the PRIMARY unit (primary + secondary/factor). */
  onQty: (primaryQty: number) => void;
  /** The material's unit definition (primary / secondary / factor). */
  unit: UnitDef;
  label?: string;
  /** Change this (e.g. the sheet's visible flag) to reset the fields. */
  resetToken?: unknown;
}

const parse = (text: string) => Number(text.replace(/[^0-9.]/g, '')) || 0;

/**
 * Quantity input that understands a material's two units. With a secondary unit
 * it shows TWO clearly-labelled fields — e.g. "kg" and "g" — so the user can
 * enter "10 kg 100 g" in one go; the row combines them into the canonical
 * PRIMARY value (10.1 kg) and shows the total underneath. Without a secondary
 * unit it's a single field with the unit shown beside it.
 */
export function QtyUnitRow({ onQty, unit, label, resetToken }: QtyUnitRowProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  const [primaryRaw, setPrimaryRaw] = useState('');
  const [secondaryRaw, setSecondaryRaw] = useState('');
  useEffect(() => {
    setPrimaryRaw('');
    setSecondaryRaw('');
  }, [resetToken]);

  const secondary = hasSecondary(unit);
  const factor = unit.factor ?? 1;

  const emit = (pRaw: string, sRaw: string) => {
    const primary = parse(pRaw) + (secondary ? parse(sRaw) / factor : 0);
    onQty(primary);
  };
  const onPrimary = (v: string) => {
    setPrimaryRaw(v);
    emit(v, secondaryRaw);
  };
  const onSecondary = (v: string) => {
    setSecondaryRaw(v);
    emit(primaryRaw, v);
  };

  const combined = parse(primaryRaw) + (secondary ? parse(secondaryRaw) / factor : 0);

  return (
    <View style={styles.wrap}>
      <AppText size="xs" weight="semibold" color="textSecondary">
        {label ?? t('qtyLabel')}
      </AppText>

      <View style={styles.row}>
        {/* Primary unit cell */}
        <View style={styles.cell}>
          <TextInput
            value={primaryRaw}
            onChangeText={onPrimary}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={theme.colors.textSecondary}
            style={styles.input}
          />
          <View style={styles.unitChip}>
            <AppText size="sm" weight="bold" color="textSecondary">
              {unit.primary || '—'}
            </AppText>
          </View>
        </View>

        {/* Secondary unit cell — only when the material defines one */}
        {secondary ? (
          <>
            <AppText size="lg" weight="bold" color="textSecondary" style={styles.plus}>
              +
            </AppText>
            <View style={styles.cell}>
              <TextInput
                value={secondaryRaw}
                onChangeText={onSecondary}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={theme.colors.textSecondary}
                style={styles.input}
              />
              <View style={styles.unitChip}>
                <AppText size="sm" weight="bold" color="textSecondary">
                  {unit.secondary}
                </AppText>
              </View>
            </View>
          </>
        ) : null}
      </View>

      {secondary && combined > 0 ? (
        <AppText size="xs" weight="semibold" color="accent">
          {`= ${combined.toLocaleString('en-PK')} ${unit.primary}`}
        </AppText>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { gap: theme.spacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    plus: { paddingHorizontal: theme.spacing.xs },
    cell: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      paddingLeft: theme.spacing.lg,
      paddingRight: theme.spacing.xs,
      minHeight: theme.touch.minTarget,
    },
    input: {
      flex: 1,
      fontFamily: theme.typography.weights.semibold,
      fontSize: theme.typography.sizes.md,
      color: theme.colors.textPrimary,
      padding: 0,
      includeFontPadding: false,
    },
    unitChip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.primarySoft,
      marginLeft: theme.spacing.sm,
    },
  });
