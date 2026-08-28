import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, AppText, EmptyState } from '@/components/ui';
import { useFocusReload } from '@/hooks';
import { useTranslation } from '@/i18n';
import { FLOATING_BAR_CLEARANCE } from '@/navigation/TabBar';
import type { RootStackParamList } from '@/navigation/types';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useTheme } from '@/theme';

import { ProjectCard } from '../components/ProjectCard';
import { ProjectCardSkeleton } from '../components/ProjectCardSkeleton';
import { makeStyles } from '../styled/ProjectsScreen.styles';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Projects list: Active projects first, Completed below, a card per project + a
 * "new project" action. Status is auto-derived (no user-managed stages).
 */
export function ProjectsScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const items = useProjectsStore((s) => s.items);
  const loaded = useProjectsStore((s) => s.loaded);
  const refresh = useProjectsStore((s) => s.refresh);
  useFocusReload(refresh);

  const active = items.filter((i) => i.project.status !== 'COMPLETED');
  const done = items.filter((i) => i.project.status === 'COMPLETED');
  const bottomInset = insets.bottom + FLOATING_BAR_CLEARANCE;

  return (
    <View style={styles.screen}>
      <AppHeader
        title={t('projects')}
        rightAction={{ icon: 'add', onPress: () => navigation.navigate('NewProject'), accessibilityLabel: t('newProject') }}
      />

      {!loaded ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}>
          {[0, 1, 2].map((i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </ScrollView>
      ) : items.length === 0 ? (
        <EmptyState
          bottomInset={bottomInset}
          icon="projects"
          title={t('noProjectsYet')}
          message={t('noProjectsDetail')}
          actionLabel={t('newProject')}
          actionIcon="add"
          onAction={() => navigation.navigate('NewProject')}
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}>
          {active.length > 0 ? (
            <AppText size="lg" weight="bold" style={styles.sectionTitle}>
              {t('sectionActive')}
            </AppText>
          ) : null}
          {active.map((item) => (
            <ProjectCard key={item.project.id} summary={item} onPress={() => navigation.navigate('ProjectDetail', { projectId: item.project.id })} />
          ))}
          {done.length > 0 ? (
            <AppText size="lg" weight="bold" style={styles.sectionTitle}>
              {t('sectionCompleted')}
            </AppText>
          ) : null}
          {done.map((item) => (
            <ProjectCard key={item.project.id} summary={item} onPress={() => navigation.navigate('ProjectDetail', { projectId: item.project.id })} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
