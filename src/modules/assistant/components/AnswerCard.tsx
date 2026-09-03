import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, View } from 'react-native';

import type { Answer } from '@/ai';
import { AppIcon, AppText } from '@/components/ui';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { formatDisplayDate } from '@/utils/date';
import { formatRupees } from '@/utils/money';

import { makeStyles } from '../styled/AnswerCard.styles';
import { navigateToTarget } from '../utils/navigateTarget';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Show at most this many rows inline; the rest is one tap away via Open. */
const INLINE_ROWS = 5;

/**
 * A repository-backed answer, sized for a phone: a small title, one number,
 * a one-line sub, then up to five dense rows and a quiet "Open" link. Money
 * rows carry a sign and direction color; list rows are names only.
 */
export function AnswerCard({ answer }: { answer: Answer }): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(theme);

  const list = answer.list?.slice(0, INLINE_ROWS) ?? [];
  const rows = answer.list ? [] : answer.rows.slice(0, INLINE_ROWS);
  const total = answer.list ? answer.list.length : answer.rows.length;
  const hidden = Math.max(0, total - INLINE_ROWS);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <AppText size="xs" weight="semibold" color="textSecondary" numberOfLines={1}>
          {answer.title}
        </AppText>
        {answer.headline ? (
          <AppText size="xl" weight="bold" tabular numberOfLines={1} adjustsFontSizeToFit>
            {answer.headline}
          </AppText>
        ) : null}
        {answer.sub ? (
          <AppText size="xs" color="textSecondary" numberOfLines={1}>
            {answer.sub}
          </AppText>
        ) : null}
      </View>

      {list.map((item) => (
        <View key={item.id} style={styles.row}>
          <View style={styles.rowText}>
            <AppText size="sm" weight="semibold" numberOfLines={1}>
              {item.title}
            </AppText>
            {item.subtitle ? (
              <AppText size="xs" color="textSecondary" numberOfLines={1}>
                {item.subtitle}
              </AppText>
            ) : null}
          </View>
        </View>
      ))}

      {rows.map((r) => (
        <View key={r.id} style={styles.row}>
          <View style={styles.rowText}>
            <AppText size="sm" weight="semibold" numberOfLines={1}>
              {r.title}
            </AppText>
            {r.subtitle || r.date ? (
              <AppText size="xs" color="textSecondary" numberOfLines={1}>
                {r.subtitle || formatDisplayDate(r.date)}
              </AppText>
            ) : null}
          </View>
          <AppText size="sm" weight="bold" tabular color={r.direction === 'in' ? 'success' : 'danger'} style={styles.value}>
            {`${r.direction === 'in' ? '+' : '−'} ${formatRupees(r.amount)}`}
          </AppText>
        </View>
      ))}

      {hidden > 0 || answer.target ? (
        <Pressable
          onPress={() => answer.target && navigateToTarget(navigation, answer.target)}
          disabled={!answer.target}
          accessibilityRole="button"
          style={({ pressed }) => [styles.footer, pressed && styles.pressed]}
        >
          <AppText size="xs" color="textSecondary" style={styles.footerLeft}>
            {hidden > 0 ? `+${hidden} ${t('aiMore')}` : ''}
          </AppText>
          {answer.target ? (
            <>
              <AppText size="sm" weight="bold" color="accent">
                {t('aiOpen')}
              </AppText>
              <AppIcon name="forward" size={16} color="accent" />
            </>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}
