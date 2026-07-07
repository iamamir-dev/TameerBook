import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/ProgressBar';
import { StageBadge } from '@/components/StageBadge';
import { AppCard, AppHeader, AppIcon, AppText, EmptyState } from '@/components/ui';
import type { ProjectSummary } from '@/db';
import { useTranslation } from '@/i18n';
import { FLOATING_BAR_CLEARANCE } from '@/navigation/TabBar';
import type { RootStackParamList } from '@/navigation/types';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { softToneColor, type ColorKey } from '@/utils/tones';
import { formatRupees } from '@/utils/money';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Projects list: a card per project + a floating "Naya Project" button. */
export function ProjectsScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const items = useProjectsStore((s) => s.items);
  const refresh = useProjectsStore((s) => s.refresh);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => undefined);
    }, [refresh])
  );

  return (
    <View style={styles.screen}>
      <AppHeader
        title={t('projects')}
        rightAction={{
          icon: 'plot',
          onPress: () => navigation.navigate('Tabs', { screen: 'Plots' }),
          accessibilityLabel: t('plotsTitle'),
        }}
      />

      {items.length === 0 ? (
        <EmptyState
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
            { paddingBottom: insets.bottom + FLOATING_BAR_CLEARANCE + 72 },
          ]}
        >
          {items.map((item) => (
            <ProjectCard
              key={item.project.id}
              summary={item}
              onPress={() =>
                navigation.navigate('ProjectDetail', { projectId: item.project.id })
              }
            />
          ))}
        </ScrollView>
      )}

      {/* Floating "Naya Project" button */}
      <Pressable
        onPress={() => navigation.navigate('NewProject')}
        accessibilityRole="button"
        accessibilityLabel={t('newProject')}
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + FLOATING_BAR_CLEARANCE + theme.spacing.sm },
          pressed && styles.fabPressed,
        ]}
      >
        <AppIcon name="add" size={22} color="onAccent" strokeWidth={2.4} />
        <AppText size="sm" weight="bold" color="onAccent">
          {t('newProject')}
        </AppText>
      </Pressable>
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
            <StageBadge tone={tone} label={completed ? t('statusDone') : t('statusCurrent')} />
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
        {saleReceived > 0 ? (
          <MathRow label={t('phaseSale')} value={formatRupees(saleReceived)} valueColor="success" />
        ) : null}
        <View style={styles.divider} />
        <View style={styles.mathRow}>
          <AppText size="sm" weight="bold">
            {t('projectTotalCost')}
          </AppText>
          <AppText size="md" weight="bold" tabular>
            {formatRupees(cost.totalCost)}
          </AppText>
        </View>
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
    fab: {
      position: 'absolute',
      right: theme.spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      height: theme.touch.minTarget,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accent,
      ...theme.shadows.fab,
    },
    fabPressed: { opacity: 0.9 },
  });
