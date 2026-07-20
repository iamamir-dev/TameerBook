import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { hasSecondary, toPrimaryQty, toSecondaryQty, type UnitDef } from '@/utils/units';

import { AppText } from './AppText';

interface QtyUnitRowProps {
  /** Emits the quantity in the PRIMARY unit (already converted). */
  onQty: (primaryQty: number) => void;
  /** The material's unit definition (primary / secondary / factor). */
  unit: UnitDef;
  label?: string;
  /** Change this (e.g. to the sheet's visible flag) to reset the field. */
  resetToken?: unknown;
}

/**
 * Quantity input with a primary/secondary unit toggle. The user types in kg OR
 * g; this always emits the canonical PRIMARY-unit value via `onQty`, and shows
 * the live equivalent underneath. Self-contained state — pass `resetToken` (a
 * value that changes on open) to clear it.
 */
export function QtyUnitRow({ onQty, unit, label, resetToken }: QtyUnitRowProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  const [raw, setRaw] = useState('');
  const [sec, setSec] = useState(false);
  // Clear the field whenever the caller's reset token changes (e.g. sheet open).
  useEffect(() => {
    setRaw('');
    setSec(false);
  }, [resetToken]);

  const parse = (text: string) => Number(text.replace(/[^0-9.]/g, '')) || 0;
  const primaryQty = toPrimaryQty(parse(raw), sec, unit);
  const showSecondary = hasSecondary(unit);

  const change = (text: string) => {
    setRaw(text);
    onQty(toPrimaryQty(parse(text), sec, unit));
  };

  const switchUnit = (toSecondary: boolean) => {
    if (toSecondary === sec) return;
    const primary = toPrimaryQty(parse(raw), sec, unit);
    setSec(toSecondary);
    setRaw(primary ? String(toSecondary ? toSecondaryQty(primary, unit) : primary) : '');
    onQty(primary); // primary value is unchanged by a display-unit switch
  };

  const activeUnit = sec ? unit.secondary : unit.primary;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.field}>
          <AppText size="xs" weight="semibold" color="textSecondary">
            {label ?? t('qtyLabel')}
          </AppText>
          <TextInput
            value={raw}
            onChangeText={change}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={theme.colors.textSecondary}
            style={styles.input}
          />
        </View>

        {showSecondary ? (
          <View style={styles.toggle}>
            {[false, true].map((isSec) => {
              const on = sec === isSec;
              return (
                <AppText
                  key={String(isSec)}
                  size="sm"
                  weight="bold"
                  color={on ? 'onAccent' : 'textSecondary'}
                  onPress={() => switchUnit(isSec)}
                  style={[styles.toggleChip, on && { backgroundColor: theme.colors.accent }]}
                >
                  {(isSec ? unit.secondary : unit.primary) ?? '—'}
                </AppText>
              );
            })}
          </View>
        ) : (
          <View style={styles.unitBox}>
            <AppText size="md" weight="bold" numberOfLines={1}>
              {activeUnit || '—'}
            </AppText>
          </View>
        )}
      </View>

      {showSecondary && primaryQty > 0 ? (
        <AppText size="xs" color="textSecondary">
          {`= ${toSecondaryQty(primaryQty, unit).toLocaleString('en-PK')} ${unit.secondary} · ${primaryQty.toLocaleString('en-PK')} ${unit.primary}`}
        </AppText>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { gap: theme.spacing.xs },
    row: { flexDirection: 'row', gap: theme.spacing.md, alignItems: 'stretch' },
    field: {
      flex: 1,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      justifyContent: 'center',
      gap: 2,
    },
    input: {
      fontFamily: theme.typography.weights.semibold,
      fontSize: theme.typography.sizes.md,
      color: theme.colors.textPrimary,
      padding: 0,
      includeFontPadding: false,
    },
    unitBox: {
      minWidth: 84,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      paddingHorizontal: theme.spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toggle: {
      flexDirection: 'row',
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    toggleChip: {
      paddingHorizontal: theme.spacing.md,
      textAlignVertical: 'center',
      lineHeight: 44,
      minWidth: 52,
      textAlign: 'center',
    },
  });
