import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';

import { AppCard, AppIcon, AppText, PhoneChip } from '@/components/ui';
import { getLaborerKhata, type LaborerKhata, type LaborerTotals } from '@/db';
import { useTranslation } from '@/i18n';
import { useDataVersion } from '@/stores/useDataVersion';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { swallow } from '@/utils/log';
import { formatRupees } from '@/utils/money';

import { KhataHistoryList } from './KhataHistoryList';

// LayoutAnimation is opt-in on Android; enable it once at module load so the
// expand/collapse reveal animates on both platforms.
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

interface WorkerAccordionProps {
  /** The worker with their cross-project totals. */
  worker: LaborerTotals;
  /** Whether this row is currently expanded (parent owns single-open state). */
  expanded: boolean;
  /** Toggle this row. The parent animates + updates which row is open. */
  onToggle: () => void;
  /** Open the worker's full khata (the detail screen). */
  onSeeAll: () => void;
  /** Pay this worker straight from the list (only when something is owed). */
  onPay?: () => void;
}

/**
 * One worker on the Labor home, as an expand-in-place accordion. The header
 * carries a left +/× toggle, the worker's name, and the khata math (earned /
 * taken / balance) read like a notebook line. Tapping the row reveals that
 * worker's unified history inline — lazily loaded on first expand and cached
 * so re-expanding is instant — plus a link to the full khata.
 */
export function WorkerAccordion({
  worker,
  expanded,
  onToggle,
  onSeeAll,
  onPay,
}: WorkerAccordionProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  const [khata, setKhata] = useState<LaborerKhata | null>(null);
  const [loading, setLoading] = useState(false);

  // The cached khata goes stale the moment anything is saved (a payment, an
  // attendance mark). Refresh it on the global data version so the expanded
  // body stays live instead of needing a collapse/re-expand.
  const version = useDataVersion((s) => s.version);
  const seenVersion = useRef(version);
  useEffect(() => {
    if (version === seenVersion.current) return;
    seenVersion.current = version;
    if (khata) {
      getLaborerKhata(worker.id).then(setKhata).catch(swallow('WorkerAccordion.refresh'));
    }
  }, [version, khata, worker.id]);

  // Tapping the header toggles the row (parent). The first time we are about to
  // expand, kick off the lazy khata load; once cached it never reloads here.
  const handlePress = useCallback(() => {
    if (!expanded && !khata && !loading) {
      setLoading(true);
      getLaborerKhata(worker.id)
        .then((k) => {
          // Animate the loading → content swap too, so the height change is smooth.
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setKhata(k);
        })
        .catch(swallow('WorkerAccordion.load'))
        .finally(() => setLoading(false));
    }
    onToggle();
  }, [expanded, khata, loading, onToggle, worker.id]);

  return (
    <AppCard onPress={handlePress} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.toggleChip}>
          <AppIcon name={expanded ? 'close' : 'add'} size={18} color="primary" />
        </View>
        <View style={styles.title}>
          <AppText size="md" weight="bold" numberOfLines={1}>
            {worker.name}
          </AppText>
          <View style={styles.subRow}>
            <AppText size="xs" color="textSecondary" numberOfLines={1}>
              {`${worker.projects} ${t('projects')}`}
            </AppText>
            {worker.phone ? <PhoneChip phone={worker.phone} compact /> : null}
          </View>
        </View>
        {/* Calendar chip → mark attendance (pay lives on the History row). */}
        <Pressable
          onPress={onSeeAll}
          hitSlop={theme.touch.hitSlop}
          accessibilityRole="button"
          accessibilityLabel={t('markAttendance')}
          style={({ pressed }) => [styles.calendarBtn, pressed && styles.pressedDim]}
        >
          <AppIcon name="today" size={18} color="accent" />
        </Pressable>
      </View>

      {/* One stretched line — earned | taken | balance — like the cost card,
          so each worker takes a third of the height the stacked rows did. */}
      <View style={styles.mathColumns}>
        <View style={styles.mathCol}>
          <AppText size="sm" weight="semibold" tabular numberOfLines={1} adjustsFontSizeToFit>
            {formatRupees(worker.earned)}
          </AppText>
          <AppText size="xs" color="textSecondary" numberOfLines={1}>
            {t('earnedLabel')}
          </AppText>
        </View>
        <View style={styles.mathColDivider} />
        <View style={styles.mathCol}>
          <AppText size="sm" weight="semibold" color="danger" tabular numberOfLines={1} adjustsFontSizeToFit>
            {formatRupees(worker.taken)}
          </AppText>
          <AppText size="xs" color="textSecondary" numberOfLines={1}>
            {t('takenLabel')}
          </AppText>
        </View>
        <View style={styles.mathColDivider} />
        <View style={styles.mathCol}>
          <AppText
            size="sm"
            weight="bold"
            color={worker.balance > 0 ? 'danger' : 'textPrimary'}
            tabular
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatRupees(worker.balance)}
          </AppText>
          <AppText size="xs" color="textSecondary" numberOfLines={1}>
            {t('wageBalance')}
          </AppText>
        </View>
      </View>

      {expanded ? (
        <View style={styles.body}>
          <View style={styles.divider} />
          {khata ? (
            <>
              {/* Work details per project: where they work, at what dihari,
                  and what is still owed on that project. */}
              {khata.participations.map((p) => (
                <View key={p.projectLaborer.id} style={styles.projectRow}>
                  <View style={styles.projectTitle}>
                    <AppText size="sm" weight="semibold" numberOfLines={1}>
                      {p.projectName}
                    </AppText>
                    <AppText size="xs" color="textSecondary" numberOfLines={1}>
                      {`${t('dailyWage')}: ${formatRupees(p.projectLaborer.daily_wage)}`}
                    </AppText>
                  </View>
                  <AppText
                    size="sm"
                    weight="bold"
                    tabular
                    color={p.balance.balance > 0 ? 'danger' : 'textSecondary'}
                  >
                    {formatRupees(p.balance.balance)}
                  </AppText>
                </View>
              ))}
              {khata.participations.length > 0 ? <View style={styles.divider} /> : null}

              {/* History header carries the compact actions (no bottom buttons). */}
              <View style={styles.historyHeader}>
                <AppText size="md" weight="bold" style={styles.flex}>
                  {t('historyTitle')}
                </AppText>
                {onPay ? (
                  <Pressable onPress={onPay} accessibilityRole="button" style={styles.pillBtn}>
                    <AppIcon name="rupee" size={14} color="onAccent" />
                    <AppText size="xs" weight="bold" color="onAccent">
                      {t('payWorker')}
                    </AppText>
                  </Pressable>
                ) : null}
                <Pressable onPress={onSeeAll} accessibilityRole="button" style={styles.pillBtnSoft}>
                  <AppText size="xs" weight="bold" color="accent">
                    {t('seeAll')}
                  </AppText>
                  <AppIcon name="forward" size={14} color="accent" />
                </Pressable>
              </View>
              <KhataHistoryList history={khata.history} hideTitle />
            </>
          ) : (
            <View style={styles.loading}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          )}
        </View>
      ) : null}
    </AppCard>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    historyHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    calendarBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressedDim: { opacity: 0.7 },
    pillBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accent,
    },
    pillBtnSoft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accentSoft,
    },
    card: { gap: theme.spacing.sm },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    toggleChip: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.chip,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primarySoft,
    },
    title: { flex: 1, gap: 2 },
    subRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' },
    mathColumns: {
      flexDirection: 'row',
      alignItems: 'stretch',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      paddingTop: theme.spacing.sm,
    },
    mathCol: { flex: 1, alignItems: 'center', gap: 2 },
    mathColDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginVertical: theme.spacing.xs,
    },
    divider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      marginVertical: theme.spacing.xs,
    },
    body: { gap: theme.spacing.md },
    flex: { flex: 1 },
    projectRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    projectTitle: { flex: 1, gap: 2 },
    loading: { paddingVertical: theme.spacing.xl },
  });
