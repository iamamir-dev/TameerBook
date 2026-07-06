import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/ProgressBar';
import { StageBadge } from '@/components/StageBadge';
import {
  AppCard,
  AppIcon,
  AppListRow,
  AppText,
  StatCard,
  type EntryDirection,
  type IconKey,
} from '@/components/ui';
import {
  getCashBankBalance,
  type CashBankBalance,
  type CategoryRow,
  listCategories,
  listTransactionsOnDate,
  listTransferDeadlines,
  type ProjectSummary,
  type TransactionRow,
} from '@/db';
import { useTranslation, type TranslationKey } from '@/i18n';
import { FLOATING_BAR_CLEARANCE } from '@/navigation/TabBar';
import type { RootStackParamList } from '@/navigation/types';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useTheme } from '@/theme';
import type { ColorPalette, Theme } from '@/theme/theme';
import { formatPakistaniGrouping, formatRupees } from '@/utils/money';
import { todayISO } from '@/utils/date';
import { PROJECT_STAGE_LABEL, projectStageTone } from '@/utils/projectStage';
import { softToneColor } from '@/utils/tones';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ColorKey = keyof ColorPalette;
const ZERO_BALANCE: CashBankBalance = { cash: 0, bank: 0, jazzcash: 0, total: 0 };

/**
 * "Soft Modern" Home dashboard, built entirely from the UI kit + theme:
 * an avatar/bell header on the bare canvas, an emerald gradient hero balance
 * card, a 2x2 stat grid, a horizontal projects rail with slim progress bars,
 * and today's entries as colored list rows.
 */
export function HomeScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const projects = useProjectsStore((s) => s.items);
  const refreshProjects = useProjectsStore((s) => s.refresh);

  const [balance, setBalance] = useState<CashBankBalance>(ZERO_BALANCE);
  const [todayTxns, setTodayTxns] = useState<TransactionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [deadlineWarn, setDeadlineWarn] = useState<{ projectId: string; projectName: string; days: number } | null>(null);
  const today = todayISO().slice(0, 10);

  const loadData = useCallback(async () => {
    const [bal, txns, cats, deadlines] = await Promise.all([
      getCashBankBalance(),
      listTransactionsOnDate(today),
      listCategories(),
      listTransferDeadlines(),
    ]);
    setBalance(bal);
    setTodayTxns(txns);
    setCategories(cats);
    const soonest = deadlines
      .map((d) => ({
        projectId: d.projectId,
        projectName: d.projectName,
        days: dayjs(d.deadline).startOf('day').diff(dayjs().startOf('day'), 'day'),
      }))
      .filter((d) => d.days <= 7)
      .sort((a, b) => a.days - b.days)[0];
    setDeadlineWarn(soonest ?? null);
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      refreshProjects().catch(() => undefined);
      loadData().catch(() => undefined);
    }, [refreshProjects, loadData])
  );

  const todayNet = todayTxns.reduce(
    (acc, x) => acc + (x.direction === 'IN' ? x.amount : -x.amount),
    0
  );

  const catName = (id: string | null): string => {
    if (!id) return '';
    const c = categories.find((x) => x.id === id);
    return c ? (language === 'ur' ? c.name_ur : c.name_en) : '';
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + theme.spacing.md,
            paddingBottom: insets.bottom + FLOATING_BAR_CLEARANCE,
          },
        ]}
      >
        {/* Header — avatar + greeting on the left, bell on the right */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <AppText size="lg" weight="bold" color="onPrimary">
              {t('appName').charAt(0)}
            </AppText>
          </View>
          <View style={styles.headerText}>
            <AppText size="sm" color="textSecondary">
              {t('greeting')}
            </AppText>
            <AppText size="xl" weight="bold" numberOfLines={1}>
              {t('appName')}
            </AppText>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            hitSlop={theme.touch.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={t('notifications')}
            style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
          >
            <AppIcon name="bell" size={22} color="textPrimary" />
            <View style={styles.bellDot} />
          </Pressable>
        </View>

        {/* Transfer deadline warning (within 7 days) */}
        {deadlineWarn ? (
          <Pressable
            onPress={() => navigation.navigate('ProjectDetail', { projectId: deadlineWarn.projectId })}
            accessibilityRole="button"
            style={styles.warnChip}
          >
            <AppIcon name="today" size={18} color="danger" />
            <AppText size="sm" weight="bold" color="danger" style={styles.warnText} numberOfLines={2}>
              {t('deadlineSoon')}: {deadlineWarn.projectName} · {Math.max(0, deadlineWarn.days)} {t('daysLeftSuffix')}
            </AppText>
          </Pressable>
        ) : null}

        {/* Balance card — white, with green money-in and red money-out */}
        <View style={styles.hero}>
          <AppText size="overline" weight="semibold" color="textSecondary" uppercase>
            Total Balance
          </AppText>
          <AppText
            size="display"
            weight="bold"
            color="primary"
            tabular
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatRupees(balance.total)}
          </AppText>
          <AppText size="sm" color="textSecondary">
            {t('acrossAllProjects')}
          </AppText>

          <View style={styles.heroDivider} />

          <View style={styles.heroRow}>
            <HeroStat
              tone="success"
              icon="balance"
              label={t('cashLabel')}
              value={formatRupees(balance.cash)}
            />
            <View style={styles.heroVDivider} />
            <HeroStat
              tone="primary"
              icon="balance"
              label={t('bankLabel')}
              value={formatRupees(balance.bank)}
            />
          </View>
        </View>

        {/* Minimal stat row — distinct from the hero (no duplicated figures) */}
        <View style={styles.grid}>
          <StatCard
            label={t('today')}
            value={formatRupees(todayNet)}
            icon="today"
            tone="primary"
            trend={todayNet >= 0 ? 'up' : 'down'}
          />
          <StatCard
            label={t('myProjects')}
            value={String(projects.length)}
            icon="projects"
            tone="accent"
          />
        </View>

        {/* My Projects */}
        <SectionHeader
          title={t('myProjects')}
          action={t('seeAll')}
          onAction={() => navigation.navigate('Tabs', { screen: 'Projects' })}
        />
        {projects.length === 0 ? (
          <AppCard onPress={() => navigation.navigate('NewProject')}>
            <View style={styles.emptyProjects}>
              <AppIcon name="add" size={22} color="accent" />
              <AppText size="sm" weight="semibold" color="accent">
                {t('newProject')}
              </AppText>
            </View>
          </AppCard>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.projectsRail}
          >
            {projects.map((summary) => (
              <ProjectCard
                key={summary.project.id}
                summary={summary}
                onPress={() =>
                  navigation.navigate('ProjectDetail', { projectId: summary.project.id })
                }
              />
            ))}
          </ScrollView>
        )}

        {/* Today's entries */}
        <SectionHeader title={t('todaysEntries')} />
        <AppCard compact>
          {todayTxns.map((txn, index) => (
            <View key={txn.id}>
              {index > 0 ? <View style={styles.rowDivider} /> : null}
              <AppListRow
                title={catName(txn.category_id) || t(txn.direction === 'IN' ? 'aamdani' : 'kharcha')}
                subtitle={`${txn.description ? `${txn.description} · ` : ''}${dayjs(txn.created_at).format('h:mm A')}`}
                icon={txn.direction === 'IN' ? 'aamdani' : 'kharcha'}
                amount={formatPakistaniGrouping(txn.amount)}
                direction={(txn.direction === 'IN' ? 'in' : 'out') as EntryDirection}
              />
            </View>
          ))}
          {todayTxns.length === 0 ? (
            <AppText size="sm" color="textSecondary" center style={styles.emptyToday}>
              {t('comingSoon')}
            </AppText>
          ) : null}
        </AppCard>
      </ScrollView>
    </View>
  );
}

/* ------------------------------ helpers --------------------------------- */

function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.sectionHeader}>
      <AppText size="lg" weight="bold">
        {title}
      </AppText>
      {action ? (
        <Pressable onPress={onAction} hitSlop={theme.touch.hitSlop} accessibilityRole="button">
          <AppText size="sm" weight="semibold" color="accent">
            {action}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A balance figure (Cash / Bank) inside the white hero card. */
function HeroStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: IconKey;
  label: string;
  value: string;
  tone: ColorKey;
}): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.heroStat}>
      <View style={[styles.heroIcon, { backgroundColor: softToneColor(theme, tone) }]}>
        <AppIcon name={icon} size={18} color={tone} />
      </View>
      <View style={styles.heroStatText}>
        <AppText size="xs" color="textSecondary">
          {label}
        </AppText>
        <AppText size="md" weight="bold" color={tone} tabular numberOfLines={1}>
          {value}
        </AppText>
      </View>
    </View>
  );
}

function ProjectCard({
  summary,
  onPress,
}: {
  summary: ProjectSummary;
  onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { project, progressPercent } = summary;
  const completed = project.stage === 'CLOSED' || project.status === 'COMPLETED';
  const percent = completed ? 100 : Math.round(progressPercent);

  return (
    <AppCard onPress={onPress} style={styles.projectCard}>
      <AppText size="md" weight="semibold" numberOfLines={1}>
        {project.name}
      </AppText>
      <StageBadge
        tone={projectStageTone(project.stage)}
        label={t(PROJECT_STAGE_LABEL[project.stage] as TranslationKey)}
      />

      <View style={styles.progressTrackWrap}>
        <ProgressBar percent={percent} tone={completed ? 'success' : 'accent'} />
      </View>

      <View style={styles.projectFooter}>
        <AppText size="xs" color="textSecondary">
          {t('totalSpent')}: {formatRupees(summary.totalOut)}
        </AppText>
        <AppText size="xs" weight="bold" color="textSecondary" tabular>
          {percent}%
        </AppText>
      </View>
    </AppCard>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.lg,
    },
    /* header */
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: {
      flex: 1,
    },
    bell: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadows.card,
    },
    bellDot: {
      position: 'absolute',
      top: 14,
      right: 15,
      width: 9,
      height: 9,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.danger,
      borderWidth: 1.5,
      borderColor: theme.colors.card,
    },
    pressed: {
      opacity: 0.6,
    },
    /* hero — white balance card */
    hero: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.hero,
      padding: theme.spacing.xl,
      gap: theme.spacing.xs,
      ...theme.shadows.card,
    },
    heroDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginVertical: theme.spacing.lg,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    heroVDivider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      backgroundColor: theme.colors.border,
      marginHorizontal: theme.spacing.md,
    },
    heroStat: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    heroIcon: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroStatText: {
      flex: 1,
    },
    /* grid */
    grid: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    /* sections */
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    projectsRail: {
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      paddingRight: theme.spacing.lg,
    },
    projectCard: {
      width: 240,
      gap: theme.spacing.sm,
    },
    progressTrackWrap: {
      marginTop: theme.spacing.xs,
    },
    projectFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    emptyProjects: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
    },
    rowDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginLeft: 56,
    },
    emptyToday: {
      paddingVertical: theme.spacing.lg,
    },
    warnChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.dangerSoft,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
    },
    warnText: { flex: 1 },
  });
