import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, AppText, EmptyState } from '@/components/ui';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';

import { InvestorAllocationCard } from '../components/allocation/InvestorAllocationCard';
import { ProjectAllocationCard } from '../components/allocation/ProjectAllocationCard';
import { useAllocation } from '../hooks/useAllocation';
import { makeStyles } from '../styled/AllocationScreen.styles';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * "Investment Allocation" — where the money sits, per project and per investor.
 * A thin coordinator: the data hook loads everything, dedicated cards render it.
 */
export function AllocationScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const { data } = useAllocation();
  const { projects, investors } = data;
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
