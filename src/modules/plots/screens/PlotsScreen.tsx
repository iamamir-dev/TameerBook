import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, EmptyState, SearchBar } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { FLOATING_BAR_CLEARANCE } from '@/navigation/TabBar';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';

import { PlotCard } from '../components/PlotCard';
import { usePlotsList } from '../hooks/usePlots';
import { makeStyles } from '../styled/PlotsScreen.styles';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Plots list: one card per plot with the owner's card math, plus a FAB. */
export function PlotsScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const { data } = usePlotsList();
  const { plots } = data;
  const [query, setQuery] = useState('');

  const filtered = plots.filter((it) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return it.plot.name.toLowerCase().includes(q) || (it.plot.society ?? '').toLowerCase().includes(q);
  });

  return (
    <View style={styles.screen}>
      <AppHeader
        title={t('plotsTitle')}
        rightAction={{ icon: 'add', onPress: () => navigation.navigate('NewPlot'), accessibilityLabel: t('newPlot') }}
      />

      {plots.length === 0 ? (
        <EmptyState
          bottomInset={insets.bottom + FLOATING_BAR_CLEARANCE}
          icon="plot"
          title={t('noPlotsYet')}
          message={t('noPlotsDetail')}
          actionLabel={t('newPlot')}
          actionIcon="add"
          onAction={() => navigation.navigate('NewPlot')}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + FLOATING_BAR_CLEARANCE }]}
        >
          {plots.length > 5 ? <SearchBar value={query} onChange={setQuery} /> : null}
          {filtered.map((item) => (
            <PlotCard
              key={item.plot.id}
              summary={item}
              onPress={() => navigation.navigate('PlotDetail', { plotId: item.plot.id })}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
