import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { View } from 'react-native';

import type { Answer } from '@/ai';
import { AppButton, AppText, LedgerTable, type LedgerRow } from '@/components/ui';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';

import { makeStyles } from '../styled/AnswerCard.styles';
import { navigateToTarget } from '../utils/navigateTarget';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Show at most this many ledger rows inline; "Open" reaches the rest. */
const INLINE_ROWS = 8;

/**
 * A repository-backed answer: the one big number, a short sub-line, the
 * matching ledger rows in the app's notebook style, and "Open" to the screen
 * that owns the data. Numbers come from the same queries the screens use.
 */
export function AnswerCard({ answer }: { answer: Answer }): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(theme);

  const rows: LedgerRow[] = answer.rows.slice(0, INLINE_ROWS).map((r) => ({
    id: r.id,
    title: r.title,
    date: r.date,
    subtitle: r.subtitle ?? (r.date ? undefined : ''),
    amount: r.amount,
    direction: r.direction,
    typeLabel: r.typeLabel,
  }));

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <AppText size="sm" weight="semibold" color="textSecondary" numberOfLines={2}>
          {answer.title}
        </AppText>
        {answer.headline ? (
          <AppText size="xxl" weight="bold" tabular numberOfLines={1} adjustsFontSizeToFit>
            {answer.headline}
          </AppText>
        ) : null}
        {answer.sub ? (
          <AppText size="xs" color="textSecondary" numberOfLines={2}>
            {answer.sub}
          </AppText>
        ) : null}
      </View>
      {rows.length > 0 ? (
        <View style={styles.rows}>
          <LedgerTable rows={rows} />
        </View>
      ) : null}
      {answer.target ? (
        <View style={styles.footer}>
          <AppButton label={t('aiOpen')} icon="forward" iconRight variant="secondary" onPress={() => navigateToTarget(navigation, answer.target!)} />
        </View>
      ) : null}
    </View>
  );
}
