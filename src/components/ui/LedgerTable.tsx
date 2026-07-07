import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatDisplayDate } from '@/utils/date';
import { formatPakistaniGrouping } from '@/utils/money';

import { AppText } from './AppText';

export interface LedgerRow {
  id: string;
  /** What happened  e.g. "Token pay keya" / "Tax deya". */
  title: string;
  /** ISO date (YYYY-MM-DD), shown under the title. */
  date: string;
  amount: number;
  /** in = money received (green), out = money paid (red). */
  direction: 'in' | 'out';
  /** Short tag under the amount  e.g. "Token", "Tax", "Cement". */
  typeLabel?: string;
  onPress?: () => void;
}

interface LedgerTableProps {
  rows: LedgerRow[];
  /** Message when there are no rows. */
  emptyText?: string;
}

/**
 * The notebook-style ruled ledger (modeled on the owner's handwritten khata):
 * each entry is a ruled row with the description + date on the left and the
 * amount + type tag on the right, separated by hairlines  instantly readable
 * for someone used to a paper register.
 */
export function LedgerTable({ rows, emptyText }: LedgerTableProps): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);

  if (rows.length === 0) {
    return (
      <View style={styles.empty}>
        <AppText size="sm" color="textSecondary" center>
          {emptyText ?? ''}
        </AppText>
      </View>
    );
  }

  return (
    <View style={styles.table}>
      {rows.map((row, i) => {
        const Container = row.onPress ? Pressable : View;
        return (
          <Container
            key={row.id}
            {...(row.onPress
              ? {
                onPress: row.onPress,
                accessibilityRole: 'button' as const,
                style: ({ pressed }: { pressed: boolean }) => [
                  styles.row,
                  i > 0 && styles.ruled,
                  pressed && styles.pressed,
                ],
              }
              : { style: [styles.row, i > 0 && styles.ruled] })}
          >
            <View style={styles.left}>
              <AppText size="md" weight="semibold" numberOfLines={1}>
                {row.title}
              </AppText>
              <AppText size="xs" color="textSecondary">
                {formatDisplayDate(row.date)}
              </AppText>
            </View>
            <View style={styles.right}>
              <AppText
                size="md"
                weight="bold"
                tabular
                color={row.direction === 'in' ? 'success' : 'danger'}
              >
                {`${row.direction === 'in' ? '+ ' : '− '}Rs ${formatPakistaniGrouping(row.amount)}`}
              </AppText>
              {row.typeLabel ? (
                <AppText size="xs" color="textSecondary" numberOfLines={1}>
                  {row.typeLabel}
                </AppText>
              ) : null}
            </View>
          </Container>
        );
      })}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    table: {},
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      minHeight: theme.touch.minTarget,
      paddingVertical: theme.spacing.sm,
    },
    ruled: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    pressed: { opacity: 0.7 },
    left: { flex: 1, gap: 2 },
    right: { alignItems: 'flex-end', gap: 2 },
    empty: {
      paddingVertical: theme.spacing.xl,
    },
  });
