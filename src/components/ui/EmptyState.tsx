import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

import { AppButton } from './AppButton';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';
import type { GlyphName, IconKey } from './icons';

interface EmptyStateProps {
  /** Large friendly icon. */
  icon?: IconKey | GlyphName;
  /** Short headline, e.g. "No projects yet". */
  title: string;
  /** Reassuring one-line explanation in plain language. */
  message?: string;
  /** Optional single primary action (icon + label). */
  actionLabel?: string;
  actionIcon?: IconKey | GlyphName;
  onAction?: () => void;
}

/**
 * Friendly placeholder shown when a screen has no data (or isn't built yet).
 * Big icon + plain-language message + one optional primary action — exactly
 * one call to action, per the UX rules.
 */
export function EmptyState({
  icon = 'empty',
  title,
  message,
  actionLabel,
  actionIcon = 'add',
  onAction,
}: EmptyStateProps): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <AppIcon name={icon} size={48} color="primary" />
      </View>
      <AppText size="xl" weight="bold" center style={styles.title}>
        {title}
      </AppText>
      {message ? (
        <AppText size="md" color="textSecondary" center style={styles.message}>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <AppButton
            label={actionLabel}
            icon={actionIcon}
            onPress={onAction}
            fullWidth={false}
          />
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.xxl,
      gap: theme.spacing.md,
    },
    iconCircle: {
      width: 96,
      height: 96,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.sm,
    },
    title: {
      marginTop: theme.spacing.xs,
    },
    message: {
      maxWidth: 320,
    },
    action: {
      marginTop: theme.spacing.lg,
    },
  });
