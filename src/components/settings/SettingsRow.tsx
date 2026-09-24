import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon, AppText, type IconKey } from '@/components/ui';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

export interface SettingsRowProps {
  /** Leading icon, drawn plain (no chip) the way a messaging app's settings list does. */
  icon?: IconKey;
  title: string;
  /** One quiet line under the title: what the setting does, or its current state. */
  subtitle?: string;
  /** Read-only value on the right (mutually exclusive with `trailing`). */
  value?: string;
  /** A control on the right (a toggle, a check icon). */
  trailing?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Red title (log-out style rows). */
  danger?: boolean;
  accessibilityHint?: string;
}

/**
 * One line of a settings list: optional plain icon, a title with an optional
 * description beneath, and either a value + chevron or a control on the
 * right. Rows are stacked inside `SettingsGroup`, which draws the dividers.
 */
export function SettingsRow({ icon, title, subtitle, value, trailing, onPress, onLongPress, danger, accessibilityHint }: SettingsRowProps): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const body = (
    <View style={[styles.row, icon ? styles.rowWithIcon : null]}>
      {icon ? (
        <View style={styles.icon}>
          <AppIcon name={icon} size={22} color={danger ? 'danger' : 'textSecondary'} />
        </View>
      ) : null}
      <View style={styles.labels}>
        <AppText size="md" color={danger ? 'danger' : 'textPrimary'}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText size="sm" color="textSecondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing ? (
        <View style={styles.trailing}>{trailing}</View>
      ) : (
        <View style={styles.valueWrap}>
          {value ? (
            <AppText size="sm" color="textSecondary" numberOfLines={1} style={styles.value}>
              {value}
            </AppText>
          ) : null}
          {onPress ? <AppIcon name="forward" size={20} color="textSecondary" /> : null}
        </View>
      )}
    </View>
  );
  if (!onPress && !onLongPress) return body;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}${value ? `, ${value}` : ''}${subtitle ? `, ${subtitle}` : ''}`}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
    >
      {body}
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      minHeight: theme.touch.minTarget,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    rowWithIcon: { minHeight: theme.touch.minTarget + 8 },
    icon: { width: 28, alignItems: 'center' },
    labels: { flex: 1, gap: 2 },
    trailing: { marginLeft: theme.spacing.sm },
    valueWrap: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, maxWidth: '50%' },
    value: { flexShrink: 1 },
    pressed: { opacity: 0.6 },
  });
