import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, EmptyState, LoadErrorState, StatCard } from '@/components/ui';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { formatRupees } from '@/utils/money';

import { BookingCard } from '../components/BookingCard';
import { NewBookingSheet } from '../components/NewBookingSheet';
import { useBookings } from '../hooks/useBookings';
import { makeStyles } from '../styled/BookingsScreen.styles';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Material bookings home: each booking as a card with its two balances —
 * material still to receive and money still to pay. OPEN float to the top.
 */
export function BookingsScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const { data, loaded, loadFailed, reload } = useBookings();
  const items = data.items;
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <View style={styles.screen}>
      <AppHeader
        title={t('bookingsTitle')}
        onBack={() => navigation.goBack()}
        rightAction={{ icon: 'add', onPress: () => setCreateOpen(true), accessibilityLabel: t('newBooking') }}
      />

      {loadFailed && items.length === 0 ? (
        <LoadErrorState onRetry={reload} bottomInset={insets.bottom} />
      ) : items.length === 0 ? (
        loaded ? (
          <EmptyState icon="material" title={t('noBookings')} actionLabel={t('newBooking')} onAction={() => setCreateOpen(true)} />
        ) : null
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
        >
          <View style={styles.statRow}>
            <StatCard
              label={t('owedToSuppliers')}
              value={formatRupees(items.reduce((s, i) => s + i.payRemaining, 0))}
              icon="material"
              tone={items.some((i) => i.payRemaining > 0) ? 'danger' : 'textPrimary'}
            />
            <StatCard
              label={t('openBookings')}
              value={String(items.filter((i) => i.booking.status === 'OPEN').length)}
              icon="ledger"
            />
          </View>

          {items.map((item) => (
            <BookingCard
              key={item.booking.id}
              summary={item}
              onPress={() => navigation.navigate('BookingDetail', { bookingId: item.booking.id })}
            />
          ))}
        </ScrollView>
      )}

      <NewBookingSheet visible={createOpen} onClose={() => setCreateOpen(false)} onSaved={reload} />
    </View>
  );
}
