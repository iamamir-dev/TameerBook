import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/ProgressBar';
import { StageBadge } from '@/components/StageBadge';
import { AppCard, AppHeader, AppIcon, AppText, EmptyState } from '@/components/ui';
import type { ProjectSummary } from '@/db';
import { listStages, type StageRow } from '@/db';
import { useFocusReload } from '@/hooks';
import { useTranslation } from '@/i18n';
import { FLOATING_BAR_CLEARANCE } from '@/navigation/TabBar';
import type { RootStackParamList } from '@/navigation/types';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { softToneColor, stageTone, type ColorKey } from '@/utils/tones';
import { formatRupees } from '@/utils/money';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Projects list: Active projects first, Completed below (plain section
 * headers), a card per project + a floating "Naya Project" button.
 */
export function ProjectsScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const items = useProjectsStore((s) => s.items);
  const refresh = useProjectsStore((s) => s.refresh);

  useFocusReload(refresh);

  const [stages, setStages] = React.useState<StageRow[]>([]);
  React.useEffect(() => {
    listStages('PROJECT').then(setStages).catch(() => undefined);
  }, [items]);
  const stageOf = (id: string | null) => stages.find((x) => x.id === id) ?? null;
  const stageName = (id: string | null) => {
    const st = stageOf(id);
    return st ? (language === 'ur' ? st.name_ur : st.name_en) : null;
  };

  const active = items.filter((i) => i.project.status !== 'COMPLETED');
  const done = items.filter((i) => i.project.status === 'COMPLETED');

  return (
    <View style={styles.screen}>
      <AppHeader
        title={t('projects')}
        rightAction={{
          icon: 'add',
          onPress: () => navigation.navigate('NewProject'),
          accessibilityLabel: t('newProject'),
        }}
      />

      {items.length === 0 ? (
        <EmptyState
          bottomInset={insets.bottom + FLOATING_BAR_CLEARANCE}
          icon="projects"
          title={t('noProjectsYet')}
          message={t('noProjectsDetail')}
          actionLabel={t('newProject')}
          actionIcon="add"
          onAction={() => navigation.navigate('NewProject')}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + FLOATING_BAR_CLEARANCE },
          ]}
        >
          {active.length > 0 ? (
            <AppText size="lg" weight="bold" style={styles.sectionTitle}>
              {t('sectionActive')}
            </AppText>
          ) : null}
          {active.map((item) => (
            <ProjectCard
              key={item.project.id}
              summary={item}
              stageLabel={stageName(item.project.stage_id)}
              stageBadgeTone={(() => { const st = stageOf(item.project.stage_id); return st ? stageTone(st) : null; })()}
              onPress={() =>
                navigation.navigate('ProjectDetail', { projectId: item.project.id })
              }
            />
          ))}
          {done.length > 0 ? (
            <AppText size="lg" weight="bold" style={styles.sectionTitle}>
              {t('sectionCompleted')}
            </AppText>
          ) : null}
          {done.map((item) => (
            <ProjectCard
              key={item.project.id}
              summary={item}
              stageLabel={stageName(item.project.stage_id)}
              stageBadgeTone={(() => { const st = stageOf(item.project.stage_id); return st ? stageTone(st) : null; })()}
              onPress={() =>
                navigation.navigate('ProjectDetail', { projectId: item.project.id })
              }
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function ProjectCard({
  summary,
  stageLabel,
  stageBadgeTone,
  onPress,
}: {
  summary: ProjectSummary;
  /** User-set display status from Settings → Statuses (null = none). */
  stageLabel: string | null;
  /** The status's own color (cycled in Settings order); null = default tone. */
  stageBadgeTone: ColorKey | null;
  onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { project, progressPercent, cost, saleReceived } = summary;
  const completed = project.status === 'COMPLETED';
  const tone = completed ? ('success' as const) : ('accent' as const);
  const shownProgress = completed ? 100 : Math.round(progressPercent);

  return (
    <AppCard onPress={onPress} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconChip, { backgroundColor: softToneColor(theme, tone) }]}>
          <AppIcon name="project" size={22} color={tone} />
        </View>
        <View style={styles.cardTitle}>
          <AppText size="md" weight="bold" numberOfLines={1}>
            {project.name}
          </AppText>
          <View style={styles.badgeWrap}>
            <StageBadge tone={stageLabel && stageBadgeTone ? stageBadgeTone : tone} label={stageLabel ?? (completed ? t('statusDone') : t('statusCurrent'))} />
          </View>
        </View>
        <AppIcon name="forward" size={20} color="textSecondary" />
      </View>

      <View style={styles.progressRow}>
        <View style={styles.progressBar}>
          <ProgressBar percent={shownProgress} tone={completed ? 'success' : tone} />
        </View>
        <AppText size="xs" weight="bold" color={completed ? 'success' : 'textSecondary'} tabular>
          {shownProgress}%
        </AppText>
      </View>

      {/* Cost breakdown  the same "read it like a notebook" style as plots. */}
      <View style={styles.mathBlock}>
        <MathRow label={t('phasePlot')} value={formatRupees(cost.plotCost)} />
        <MathRow label={t('phaseConstruction')} value={formatRupees(cost.constructionCost)} />
        <View style={styles.divider} />
        <View style={styles.mathRow}>
          <AppText size="sm" weight="bold">
            {t('projectTotalCost')}
          </AppText>
          <AppText size="md" weight="bold" tabular>
            {formatRupees(cost.totalCost)}
          </AppText>
        </View>
        {/* Money IN sits apart from the cost math — it is not a cost row. */}
        {saleReceived > 0 ? (
          <View style={[styles.mathRow, styles.saleRow]}>
            <AppText size="sm" color="textSecondary">
              {t('phaseSale')}
            </AppText>
            <AppText size="sm" weight="semibold" color="success" tabular>
              {formatRupees(saleReceived)}
            </AppText>
          </View>
        ) : null}
      </View>
    </AppCard>
  );
}

function MathRow({
  label,
  value,
  valueColor = 'textPrimary',
}: {
  label: string;
  value: string;
  valueColor?: ColorKey;
}): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.mathRow}>
      <AppText size="sm" color="textSecondary">
        {label}
      </AppText>
      <AppText size="sm" weight="semibold" color={valueColor} tabular>
        {value}
      </AppText>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    sectionTitle: { marginTop: theme.spacing.sm },
    card: { gap: theme.spacing.md },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    iconChip: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: { flex: 1, gap: theme.spacing.xs },
    badgeWrap: { flexDirection: 'row' },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    progressBar: { flex: 1 },
    mathBlock: { gap: theme.spacing.xs },
    mathRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    divider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      marginVertical: theme.spacing.xs,
    },
    saleRow: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      paddingTop: theme.spacing.xs,
      marginTop: theme.spacing.xs,
    },
  });
