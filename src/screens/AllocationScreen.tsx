import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InvestorAllocationCard } from '@/components/allocation/InvestorAllocationCard';
import { ProjectAllocationCard } from '@/components/allocation/ProjectAllocationCard';
import { AppHeader, AppText, EmptyState } from '@/components/ui';
import {
  getInvestorProjectReturns,
  getProjectCapitalSummary,
  type InvestorCapacity,
  type InvestorProjectReturn,
  listInvestorsWithCapacity,
  listProjectSummaries,
  type ProjectCapitalSummary,
  type ProjectSummary,
} from '@/db';
import { useFocusReload } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { swallow } from '@/utils/log';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** A project paired with its live capital summary (Σ paid-in shares). */
interface ProjectAllocation {
  summary: ProjectSummary;
  capital: ProjectCapitalSummary;
}

/** An investor paired with their per-project invested breakdown. */
interface InvestorAllocation {
  investor: InvestorCapacity;
  returns: InvestorProjectReturn[];
}

/**
 * "Investment Allocation" — where the money sits. Answers two questions:
 * how much capital is in each project (with its plot/construction/sale cost
 * split and the investors behind it), and how much each investor has put into
 * each project. A thin coordinator: it loads everything on focus and hands
 * each row to a dedicated card component.
 */
export function AllocationScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [projects, setProjects] = useState<ProjectAllocation[]>([]);
  const [investors, setInvestors] = useState<InvestorAllocation[]>([]);

  const load = useCallback(async () => {
    const [summaries, investorRows] = await Promise.all([
      listProjectSummaries(),
      listInvestorsWithCapacity(),
    ]);
    const [capitals, returns] = await Promise.all([
      Promise.all(summaries.map((s) => getProjectCapitalSummary(s.project.id))),
      Promise.all(investorRows.map((inv) => getInvestorProjectReturns(inv.id))),
    ]);
    setProjects(summaries.map((summary, i) => ({ summary, capital: capitals[i] })));
    setInvestors(investorRows.map((investor, i) => ({ investor, returns: returns[i] })));
  }, []);

  useFocusReload(useCallback(() => load().catch(swallow('allocation:load')), [load]));

  const empty = projects.length === 0 && investors.length === 0;

  return (
    <View style={styles.screen}>
      <AppHeader title={t('allocationTitle')} onBack={() => navigation.goBack()} />
      {empty ? (
        <EmptyState icon="investors" title={t('noProjectsYet')} message={t('noProjectsDetail')} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
        >
          {projects.length > 0 ? (
            <>
              <AppText size="lg" weight="bold">
                {t('byProject')}
              </AppText>
              {projects.map((p) => (
                <ProjectAllocationCard key={p.summary.project.id} summary={p.summary} capital={p.capital} />
              ))}
            </>
          ) : null}

          {investors.length > 0 ? (
            <>
              <AppText size="lg" weight="bold" style={styles.investorHeading}>
                {t('byInvestor')}
              </AppText>
              {investors.map((v) => (
                <InvestorAllocationCard key={v.investor.id} investor={v.investor} returns={v.returns} />
              ))}
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    investorHeading: { marginTop: theme.spacing.md },
  });
