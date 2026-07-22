import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, EmptyState, LoadErrorState, StatCard } from '@/components/ui';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { formatRupees } from '@/utils/money';

import { PurchaseOrderCard } from '../components/PurchaseOrderCard';
import { usePurchaseOrders } from '../hooks/useBookings';
import { makeStyles } from '../styled/BookingsScreen.styles';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Purchase orders home: one card per order (a group of material line-items),
 * with what's still owed and how many are open. "+" opens the full create page.
 */
export function BookingsScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const { data, loaded, loadFailed, reload } = usePurchaseOrders();
  const orders = data.items;
  const openCreate = () => navigation.navigate('NewPurchaseOrder');

  return (
    <View style={styles.screen}>
      <AppHeader
        title={t('bookingsTitle')}
        onBack={() => navigation.goBack()}
        rightAction={{ icon: 'add', onPress: openCreate, accessibilityLabel: t('newBooking') }}
      />

      {loadFailed && orders.length === 0 ? (
        <LoadErrorState onRetry={reload} bottomInset={insets.bottom} />
      ) : orders.length === 0 ? (
        loaded ? (
          <EmptyState icon="material" title={t('noBookings')} actionLabel={t('newBooking')} onAction={openCreate} />
        ) : null
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
        >
          <View style={styles.statRow}>
            <StatCard
              label={t('owedToSuppliers')}
              value={formatRupees(orders.reduce((s, o) => s + o.payRemaining, 0))}
              icon="material"
              tone={orders.some((o) => o.payRemaining > 0) ? 'danger' : 'textPrimary'}
            />
            <StatCard
              label={t('openBookings')}
              value={String(orders.filter((o) => o.status === 'OPEN').length)}
              icon="ledger"
            />
          </View>

          {orders.map((po) => (
            <PurchaseOrderCard
              key={po.poId}
              po={po}
              onPress={() => navigation.navigate('PurchaseOrderDetail', { poId: po.poId })}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
