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
  /** Row id to tint (e.g. after jumping to it from a linked activity row). */
  highlightId?: string | null;
}

/**
 * The notebook-style ruled ledger (modeled on the owner's handwritten khata):
 * each entry is a ruled row with the description + date on the left and the
 * amount + type tag on the right, separated by hairlines  instantly readable
 * for someone used to a paper register.
 */
export function LedgerTable({ rows, emptyText, highlightId }: LedgerTableProps): React.JSX.Element {
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
        const hi = highlightId === row.id && styles.highlighted;
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
                  hi,
                  pressed && styles.pressed,
                ],
              }
              : { style: [styles.row, i > 0 && styles.ruled, hi] })}
          >
            <View style={styles.left}>
              <AppText size="sm" weight="semibold" numberOfLines={1}>
                {row.title}
              </AppText>
              <AppText size="xs" color="textSecondary">
                {formatDisplayDate(row.date)}
              </AppText>
            </View>
            <View style={styles.right}>
              <AppText
                size="sm"
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
    // Slightly denser than the touch minimum: these rows read like notebook
    // lines (mostly non-pressable), so more entries fit on screen.
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      minHeight: 40,
      paddingVertical: theme.spacing.xs,
    },
    ruled: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    pressed: { opacity: 0.7 },
    // Bleed the tint out by the card's padding and add it back as padding, so it
    // covers the surrounding gap without changing the row's occupied size.
    highlighted: {
      backgroundColor: theme.colors.dangerSoft,
      borderRadius: theme.radius.md,
      marginHorizontal: -theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      marginVertical: -theme.spacing.md,
      paddingVertical: theme.spacing.md + theme.spacing.xs,
    },
    left: { flex: 1, gap: 2 },
    right: { alignItems: 'flex-end', gap: 2 },
    empty: {
      paddingVertical: theme.spacing.xl,
    },
  });
