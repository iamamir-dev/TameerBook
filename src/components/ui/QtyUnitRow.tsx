import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { ColorPalette, Theme } from '@/theme/theme';
import { hasSecondary, type UnitDef } from '@/utils/units';

import { AppIcon } from './AppIcon';
import { AppText } from './AppText';

interface QtyUnitRowProps {
  /** Emits the quantity in the PRIMARY unit (primary + secondary/factor). */
  onQty: (primaryQty: number) => void;
  /** The material's unit definition (primary / secondary / factor). */
  unit: UnitDef;
  label?: string;
  /** Change this (e.g. the sheet's visible flag) to reset the fields. */
  resetToken?: unknown;
  /** Inline error (red borders + message), like AmountInput. */
  error?: string | null;
}

const parse = (text: string) => Number(text.replace(/[^0-9.]/g, '')) || 0;

/** One unit cell: a number field with a colour-coded unit chip. */
function UnitCell({
  value,
  onChangeText,
  unitLabel,
  tone,
  soft,
  error,
}: {
  value: string;
  onChangeText: (v: string) => void;
  unitLabel: string;
  tone: keyof ColorPalette;
  soft: keyof ColorPalette;
  error: boolean;
}): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={[styles.cell, { borderColor: error ? theme.colors.danger : theme.colors.border }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={theme.colors.textSecondary}
        style={styles.input}
      />
      <View style={[styles.unitChip, { backgroundColor: theme.colors[soft] }]}>
        <AppText size="sm" weight="bold" color={tone}>
          {unitLabel}
        </AppText>
      </View>
    </View>
  );
}

/**
 * Quantity input that understands a material's two units. With a secondary unit
 * it shows TWO colour-coded fields — the primary unit (accent) and the smaller
 * sub-unit (gold) — so the user can enter "10 kg 100 g" in one go; the row
 * combines them into the canonical PRIMARY value and shows the total. Without a
 * secondary unit it's a single field with its unit shown.
 */
export function QtyUnitRow({ onQty, unit, label, resetToken, error }: QtyUnitRowProps): React.JSX.Element {
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
    onQty(parse(pRaw) + (secondary ? parse(sRaw) / factor : 0));
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
  const hasError = !!error;

  return (
    <View style={styles.wrap}>
      <AppText size="xs" weight="semibold" color="textSecondary">
        {label ?? t('qtyLabel')}
      </AppText>

      <View style={styles.row}>
        <UnitCell
          value={primaryRaw}
          onChangeText={onPrimary}
          unitLabel={unit.primary || '—'}
          tone="accent"
          soft="accentSoft"
          error={hasError}
        />
        {secondary ? (
          <>
            <AppText size="lg" weight="bold" color="textSecondary" style={styles.plus}>
              +
            </AppText>
            <UnitCell
              value={secondaryRaw}
              onChangeText={onSecondary}
              unitLabel={unit.secondary ?? ''}
              tone="gold"
              soft="goldSoft"
              error={hasError}
            />
          </>
        ) : null}
      </View>

      {hasError ? (
        <AppText size="xs" weight="semibold" color="danger">
          {error}
        </AppText>
      ) : secondary && combined > 0 ? (
        <View style={styles.totalRow}>
          <AppIcon name="checkCircle" size={14} color="accent" />
          <AppText size="xs" weight="bold" color="accent">
            {`${combined.toLocaleString('en-PK')} ${unit.primary}`}
          </AppText>
        </View>
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
      marginLeft: theme.spacing.sm,
    },
    totalRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  });
