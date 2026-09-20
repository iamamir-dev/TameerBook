import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { Answer } from '@/ai';
import { AppIcon, AppText } from '@/components/ui';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { formatDisplayDate } from '@/utils/date';
import { formatRupees } from '@/utils/money';

import { makeStyles } from '../styled/AnswerCard.styles';
import { AnswerChart } from './AnswerChart';
import { AttendanceGrid } from './AttendanceGrid';
import { navigateToTarget } from '../utils/navigateTarget';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Show at most this many rows inline; the rest is one tap away via Open. */
const INLINE_ROWS = 5;

/**
 * A repository-backed answer, sized for a phone: a small title, one number,
 * a one-line sub, then up to five dense rows and a quiet "Open" link. Money
 * rows carry a sign and direction color; list rows are names only.
 */
interface AnswerCardProps {
  answer: Answer;
  onPick?: (title: string) => void;
  expandAll?: boolean;
  /** Header + Open only: the reply text already lays the sections out, so the rows would repeat it. */
  compact?: boolean;
}

export function AnswerCard({ answer, onPick, expandAll, compact }: AnswerCardProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(theme);

  const [expandedByUser, setExpanded] = useState(false);
  const expanded = expandedByUser || !!expandAll;
  const cap = expanded ? Number.MAX_SAFE_INTEGER : INLINE_ROWS;
  const list = compact ? [] : (answer.list?.slice(0, cap) ?? []);
  const rows = compact || answer.list ? [] : answer.rows.slice(0, cap);
  const total = compact ? 0 : answer.list ? answer.list.length : answer.rows.length;
  const hidden = Math.max(0, total - cap);
  const sections = compact ? [] : (answer.sections ?? []);

  const renderRow = (r: (typeof answer.rows)[number], i: number) => (
    <View key={`${r.id}-${i}`} style={styles.row}>
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
      {/* A balance is neither a gain nor a loss: no sign, no direction colour. */}
      <AppText size="sm" weight="bold" tabular color={r.direction === 'flat' ? 'textPrimary' : r.direction === 'in' ? 'success' : 'danger'} style={styles.value}>
        {`${r.direction === 'flat' ? '' : r.direction === 'in' ? '+ ' : '− '}${formatRupees(r.amount)}`}
      </AppText>
    </View>
  );

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

      {answer.chart ? <AnswerChart chart={answer.chart} /> : null}

      {answer.calendar ? <AttendanceGrid calendar={answer.calendar} /> : null}

      {list.map((item, li) => (
        <Pressable
          key={`${item.id}-${li}`}
          onPress={onPick ? () => onPick(item.title) : undefined}
          disabled={!onPick}
          accessibilityRole={onPick ? 'button' : undefined}
          style={({ pressed }) => [styles.row, onPick && pressed && styles.rowPressed]}
        >
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
          {onPick ? <AppIcon name="forward" size={14} color="accent" /> : null}
        </Pressable>
      ))}

      {rows.map(renderRow)}

      {sections.map((sec, si) => (
        <View key={`${sec.title}-${si}`}>
          <View style={styles.sectionHead}>
            <AppText size="xs" weight="bold" color="textSecondary" uppercase numberOfLines={1}>
              {sec.title}
            </AppText>
          </View>
          {(expanded ? sec.rows : sec.rows.slice(0, INLINE_ROWS)).map(renderRow)}
          {!expanded && sec.rows.length > INLINE_ROWS ? (
            <View style={styles.row}>
              <AppText size="xs" color="textSecondary">{`+${sec.rows.length - INLINE_ROWS} ${t('aiMore')}`}</AppText>
            </View>
          ) : null}
        </View>
      ))}

      {hidden > 0 || answer.target || (sections.some((sec) => sec.rows.length > INLINE_ROWS) && !expanded) ? (
        <Pressable
          onPress={() => answer.target && navigateToTarget(navigation, answer.target)}
          disabled={!answer.target}
          accessibilityRole="button"
          style={({ pressed }) => [styles.footer, pressed && styles.pressed]}
        >
          {/* "+N more" expands in place; "Open" goes to the owning screen. */}
          {hidden > 0 || (!expanded && sections.some((sec) => sec.rows.length > INLINE_ROWS)) ? (
            <Pressable onPress={() => setExpanded(true)} accessibilityRole="button" hitSlop={theme.touch.hitSlop} style={styles.footerLeft}>
              <AppText size="xs" weight="bold" color="accent">
                {hidden > 0 ? `+${hidden} ${t('aiMore')}` : t('aiShowAll')}
              </AppText>
            </Pressable>
          ) : (
            <View style={styles.footerLeft} />
          )}
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
