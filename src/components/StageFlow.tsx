import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppIcon, AppText, type Stage } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

interface StageFlowProps {
  stages: Stage[];
}

/**
 * Vertical flow-chart of project stages: each step is a node (done = check,
 * current = highlighted number, upcoming = muted number) joined by a connector
 * line, with the current step's label sitting in an accent-tinted card. Shows
 * every stage so the whole pipeline is visible at a glance.
 */
export function StageFlow({ stages }: StageFlowProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  return (
    <View>
      {stages.map((stage, index) => {
        const isLast = index === stages.length - 1;
        const done = stage.status === 'done';
        const current = stage.status === 'current';

        const statusLabel = done ? t('done') : current ? t('current') : t('next');
        const statusColor = done ? 'success' : current ? 'accent' : 'textSecondary';

        return (
          <View key={stage.key} style={styles.row}>
            {/* Left rail: node + connector */}
            <View style={styles.rail}>
              <View
                style={[
                  styles.node,
                  done && styles.nodeDone,
                  current && styles.nodeCurrent,
                ]}
              >
                {done ? (
                  <AppIcon name="check" size={16} color="onPrimary" strokeWidth={2.6} />
                ) : (
                  <AppText size="xs" weight="bold" color={current ? 'onAccent' : 'textSecondary'}>
                    {index + 1}
                  </AppText>
                )}
              </View>
              {!isLast ? (
                <View style={[styles.line, done && styles.lineDone]} />
              ) : null}
            </View>

            {/* Step content */}
            <View style={[styles.content, current && styles.contentCurrent]}>
              <AppText
                size="md"
                weight={current ? 'bold' : done ? 'semibold' : 'regular'}
                color={current || done ? 'textPrimary' : 'textSecondary'}
                numberOfLines={1}
              >
                {stage.label}
              </AppText>
              <AppText size="xs" weight="semibold" color={statusColor}>
                {statusLabel}
              </AppText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const NODE = 32;

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: theme.spacing.md,
    },
    rail: {
      width: NODE,
      alignItems: 'center',
    },
    node: {
      width: NODE,
      height: NODE,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.card,
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    nodeDone: {
      backgroundColor: theme.colors.success,
      borderColor: theme.colors.success,
    },
    nodeCurrent: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    line: {
      flex: 1,
      width: 2,
      minHeight: theme.spacing.lg,
      backgroundColor: theme.colors.track,
      marginVertical: theme.spacing.xs,
    },
    lineDone: {
      backgroundColor: theme.colors.success,
    },
    content: {
      flex: 1,
      marginBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.md,
      justifyContent: 'center',
      gap: 2,
    },
    contentCurrent: {
      backgroundColor: theme.colors.accentSoft,
    },
  });
