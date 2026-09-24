import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppCard, AppText } from '@/components/ui';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

interface SettingsGroupProps {
  /** Small grey heading above the group ("Display", "Who can see my personal info"). */
  header?: string;
  /** A quiet explanatory line under the group. */
  footer?: string;
  children: React.ReactNode;
}

/**
 * A titled block of settings rows on one card. Hairline dividers are drawn
 * between the children automatically, so sections read like a messaging
 * app's settings page: header, rows, optional footnote.
 */
export function SettingsGroup({ header, footer, children }: SettingsGroupProps): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      {header ? (
        <AppText size="sm" weight="semibold" color="textSecondary" style={styles.header}>
          {header}
        </AppText>
      ) : null}
      <AppCard compact>
        {items.map((child, i) => (
          <React.Fragment key={i}>
            {i > 0 ? <View style={styles.divider} /> : null}
            {child}
          </React.Fragment>
        ))}
      </AppCard>
      {footer ? (
        <AppText size="xs" color="textSecondary" style={styles.footer}>
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    group: { gap: theme.spacing.xs },
    header: { paddingHorizontal: theme.spacing.xs, marginTop: theme.spacing.sm },
    footer: { paddingHorizontal: theme.spacing.xs },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
  });
