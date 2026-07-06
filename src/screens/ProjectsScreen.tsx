import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/ProgressBar';
import { StageBadge } from '@/components/StageBadge';
import { AppCard, AppHeader, AppIcon, AppText, EmptyState } from '@/components/ui';
import type { ProjectSummary } from '@/db';
import { useTranslation, type TranslationKey } from '@/i18n';
import { FLOATING_BAR_CLEARANCE } from '@/navigation/TabBar';
import type { RootStackParamList } from '@/navigation/types';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { PROJECT_STAGE_LABEL, projectStageTone } from '@/utils/projectStage';
import { softToneColor } from '@/utils/tones';
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
      <AppHeader title={t('projects')} />

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
  const { project, progressPercent, totalOut } = summary;
  const tone = projectStageTone(project.stage);
  const completed = project.stage === 'CLOSED' || project.status === 'COMPLETED';
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
            <StageBadge tone={tone} label={t(PROJECT_STAGE_LABEL[project.stage] as TranslationKey)} />
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

      <View style={styles.spentRow}>
        <AppText size="xs" color="textSecondary">
          {t('totalSpent')}
        </AppText>
        <AppText size="sm" weight="bold" color="danger" tabular>
          {formatRupees(totalOut)}
        </AppText>
      </View>
    </AppCard>
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
    spentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
