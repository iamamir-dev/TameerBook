import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

import { AppIcon } from './AppIcon';
import { AppText } from './AppText';

export type StageStatus = 'done' | 'current' | 'next';

export interface Stage {
  /** Stable id. */
  key: string;
  /** Display label (already translated by the caller). */
  label: string;
  status: StageStatus;
}

interface StageTrackerProps {
  stages: Stage[];
}

/**
 * Horizontal row of step "pills" showing a project's construction progress:
 * done (filled + check), current (accent outline), next (muted). Scrolls
 * horizontally so it never truncates on a small phone.
 */
export function StageTracker({ stages }: StageTrackerProps): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {stages.map((stage, index) => {
        const visuals = pillVisuals(theme, stage.status);
        return (
          <View key={stage.key} style={styles.item}>
            <View
              style={[
                styles.pill,
                { backgroundColor: visuals.bg, borderColor: visuals.border },
              ]}
            >
              {stage.status === 'done' ? (
                <AppIcon name="check" size={16} color={visuals.fgKey} />
              ) : (
                <AppText size="sm" weight="bold" style={{ color: visuals.fg }}>
                  {index + 1}
                </AppText>
              )}
              <AppText size="sm" weight="semibold" style={{ color: visuals.fg }}>
                {stage.label}
              </AppText>
            </View>
            {index < stages.length - 1 ? <View style={styles.connector} /> : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

function pillVisuals(theme: Theme, status: StageStatus) {
  switch (status) {
    case 'done':
      return {
        bg: theme.colors.successSoft,
        fg: theme.colors.success,
        fgKey: 'success' as const,
        border: theme.colors.successSoft,
      };
    case 'current':
      return {
        bg: theme.colors.accentSoft,
        fg: theme.colors.accent,
        fgKey: 'accent' as const,
        border: theme.colors.accentSoft,
      };
    case 'next':
    default:
      return {
        bg: theme.colors.track,
        fg: theme.colors.textSecondary,
        fgKey: 'textSecondary' as const,
        border: theme.colors.track,
      };
  }
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingVertical: theme.spacing.xs,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      height: 36,
      borderRadius: theme.radius.pill,
      borderWidth: StyleSheet.hairlineWidth * 2,
    },
    connector: {
      width: theme.spacing.md,
      height: 2,
      backgroundColor: theme.colors.track,
    },
  });
