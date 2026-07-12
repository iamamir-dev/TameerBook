import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { LayoutAnimation, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddLaborerSheet } from '@/components/labor/AddLaborerSheet';
import { WorkerAccordion } from '@/components/labor/WorkerAccordion';
import { AppHeader, EmptyState, StatCard } from '@/components/ui';
import { listLaborersWithTotals, type LaborerTotals } from '@/db';
import { useFocusReload } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatRupees } from '@/utils/money';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Labor home — every worker across every project, because the khata belongs
 * to the WORKER, not the project. A summary row shows what is owed overall;
 * each worker is an expand-in-place accordion with their work details and
 * history. New workers register here at the company level ("+" in the
 * header); the per-project wage is set when attaching them to a project.
 */
export function LaborScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [workers, setWorkers] = useState<LaborerTotals[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setWorkers(await listLaborersWithTotals());
  }, []);

  const { reload } = useFocusReload(load);

  // Single-open accordion: expanding one row collapses any other. The
  // LayoutAnimation call immediately before setState animates the reveal.
  const toggle = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((current) => (current === id ? null : id));
  }, []);

  const totalOwed = workers.reduce((sum, w) => sum + w.balance, 0);

  return (
    <View style={styles.screen}>
      <AppHeader
        title={t('laborTitle')}
        onBack={() => navigation.goBack()}
        rightAction={{
          icon: 'add',
          onPress: () => setAddOpen(true),
          accessibilityLabel: t('addWorker'),
        }}
      />

      {workers.length === 0 ? (
        <EmptyState icon="dehari" title={t('noWorkers')} actionLabel={t('addWorker')} onAction={() => setAddOpen(true)} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + theme.spacing.xxxl },
          ]}
        >
          <View style={styles.statRow}>
            <StatCard
              label={t('outstanding')}
              value={formatRupees(totalOwed)}
              icon="dehari"
              tone={totalOwed > 0 ? 'danger' : 'textPrimary'}
              caption={t('acrossProjects')}
            />
            <StatCard label={t('allWorkers')} value={String(workers.length)} icon="investors" />
          </View>

          {workers.map((worker) => (
            <WorkerAccordion
              key={worker.id}
              worker={worker}
              expanded={expandedId === worker.id}
              onToggle={() => toggle(worker.id)}
              onSeeAll={() => navigation.navigate('LaborerDetail', { laborerId: worker.id })}
            />
          ))}
        </ScrollView>
      )}

      <AddLaborerSheet visible={addOpen} onClose={() => setAddOpen(false)} onSaved={reload} />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    statRow: { flexDirection: 'row', gap: theme.spacing.md },
  });
