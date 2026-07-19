import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { LayoutAnimation, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, EmptyState, HubShortcuts, LoadErrorState, SearchBar, StatCard } from '@/components/ui';
import type { LaborerTotals } from '@/db';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { formatRupees } from '@/utils/money';

import { AddLaborerSheet } from '../components/AddLaborerSheet';
import { PayWorkerSheet } from '../components/PayWorkerSheet';
import { WorkerAccordion } from '../components/WorkerAccordion';
import { useLaborHome, useWorkerPayData } from '../hooks/useLaborHome';
import { makeStyles } from '../styled/LaborScreen.styles';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Labor home — every worker across every project (the khata belongs to the
 * WORKER, not the project). Thin orchestrator: data via `useLaborHome`, each
 * worker an expand-in-place `WorkerAccordion`, pay straight from the list.
 */
export function LaborScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const { data, loaded, loadFailed, reload } = useLaborHome();
  const workers = data.workers;

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [payFor, setPayFor] = useState<LaborerTotals | null>(null);
  const payData = useWorkerPayData(payFor);

  const toggle = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((current) => (current === id ? null : id));
  }, []);

  const totalOwed = workers.reduce((sum, w) => sum + Math.max(0, w.balance), 0);
  const q = query.trim().toLowerCase();
  const shown = workers
    .filter((w) => !q || w.name.toLowerCase().includes(q) || (w.phone ?? '').includes(query.trim()))
    .sort((a, b) => b.balance - a.balance);

  return (
    <View style={styles.screen}>
      <AppHeader
        title={t('laborTitle')}
        onBack={() => navigation.goBack()}
        rightAction={{ icon: 'add', onPress: () => setAddOpen(true), accessibilityLabel: t('addWorker') }}
      />

      <HubShortcuts current="Labor" />

      {loadFailed && workers.length === 0 ? (
        <LoadErrorState onRetry={reload} bottomInset={insets.bottom} />
      ) : workers.length === 0 ? (
        loaded ? (
          <EmptyState icon="dehari" title={t('noWorkers')} actionLabel={t('addWorker')} onAction={() => setAddOpen(true)} />
        ) : null
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
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

          {workers.length > 5 ? <SearchBar value={query} onChange={setQuery} /> : null}

          {shown.map((worker) => (
            <WorkerAccordion
              key={worker.id}
              worker={worker}
              expanded={expandedId === worker.id}
              onToggle={() => toggle(worker.id)}
              onPay={worker.balance > 0 ? () => setPayFor(worker) : undefined}
              onSeeAll={() => navigation.navigate('LaborerDetail', { laborerId: worker.id })}
            />
          ))}
        </ScrollView>
      )}

      <AddLaborerSheet visible={addOpen} onClose={() => setAddOpen(false)} onSaved={reload} />

      <PayWorkerSheet
        visible={!!payFor && !!payData}
        onClose={() => setPayFor(null)}
        participations={payData?.participations ?? []}
        accounts={payData?.accounts ?? []}
        onSaved={async () => {
          await reload();
          setPayFor(null);
        }}
      />
    </View>
  );
}
