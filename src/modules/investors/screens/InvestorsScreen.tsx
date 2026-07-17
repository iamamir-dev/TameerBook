import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionsDrawer, AppHeader, EmptyState, SearchBar } from '@/components/ui';
import type { InvestorWithCapital } from '@/db';
import { useTranslation } from '@/i18n';
import { FLOATING_BAR_CLEARANCE } from '@/navigation/TabBar';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';

import { InvestorCard } from '../components/InvestorCard';
import { InvestorPersonSheet } from '../components/InvestorPersonSheet';
import { useInvestorsList } from '../hooks/useInvestorsList';
import { makeStyles } from '../styled/InvestorsScreen.styles';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function InvestorsScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const { data: investors, loaded, reload, remove } = useInvestorsList();
  const [query, setQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<InvestorWithCapital | null>(null);
  const [menuFor, setMenuFor] = useState<InvestorWithCapital | null>(null);

  const openAdd = () => {
    setEditing(null);
    setSheetOpen(true);
  };
  const openEdit = (inv: InvestorWithCapital) => {
    setMenuFor(null);
    setEditing(inv);
    setSheetOpen(true);
  };

  const q = query.trim().toLowerCase();
  const filtered = investors.filter(
    (inv) => !q || inv.name.toLowerCase().includes(q) || (inv.phone ?? '').includes(query.trim())
  );
  const bottomInset = insets.bottom + FLOATING_BAR_CLEARANCE;

  return (
    <View style={styles.screen}>
      <AppHeader
        title={t('investors')}
        rightAction={{ icon: 'add', onPress: openAdd, accessibilityLabel: t('addInvestor') }}
      />

      {investors.length === 0 ? (
        loaded ? (
          <EmptyState
            bottomInset={bottomInset}
            icon="investors"
            title={t('noInvestorsYet')}
            message={t('noInvestorsDetail')}
            actionLabel={t('addInvestor')}
            actionIcon="add"
            onAction={openAdd}
          />
        ) : null
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        >
          {investors.length > 5 ? <SearchBar value={query} onChange={setQuery} /> : null}
          {filtered.map((inv) => (
            <InvestorCard
              key={inv.id}
              investor={inv}
              onPress={() => navigation.navigate('InvestorProfile', { investorId: inv.id })}
              onLongPress={() => setMenuFor(inv)}
            />
          ))}
        </ScrollView>
      )}

      {/* Add / edit investor — the ONE shared person modal. */}
      <InvestorPersonSheet
        visible={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setEditing(null);
        }}
        editing={editing}
        onSaved={() => {
          setSheetOpen(false);
          setEditing(null);
          void reload();
        }}
      />

      {/* Long-press actions — the shared drawer (no bespoke menu Modal). */}
      <ActionsDrawer
        visible={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor?.name ?? ''}
        actions={[
          { icon: 'edit', label: t('edit'), onPress: () => menuFor && openEdit(menuFor) },
          {
            icon: 'trash',
            label: t('delete'),
            onPress: () => {
              const inv = menuFor;
              setMenuFor(null);
              if (inv) remove(inv);
            },
          },
        ]}
      />
    </View>
  );
}
