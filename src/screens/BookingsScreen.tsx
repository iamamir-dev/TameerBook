import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookingCard } from '@/components/bookings/BookingCard';
import { NewBookingSheet } from '@/components/bookings/NewBookingSheet';
import { AppHeader, EmptyState, HubShortcuts, StatCard } from '@/components/ui';
import { formatRupees } from '@/utils/money';
import { listBookingSummaries, type BookingSummary } from '@/db';
import { useFocusReload } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Material bookings home: every booking as a card with its two balances —
 * material still to receive and money still to pay. OPEN bookings float to
 * the top (repo ordering); "+" in the header books new material.
 */
export function BookingsScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [items, setItems] = useState<BookingSummary[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setItems(await listBookingSummaries());
  }, []);

  const { loaded, reload } = useFocusReload(load);

  return (
    <View style={styles.screen}>
      <AppHeader
        title={t('bookingsTitle')}
        onBack={() => navigation.goBack()}
        rightAction={{
          icon: 'add',
          onPress: () => setCreateOpen(true),
          accessibilityLabel: t('newBooking'),
        }}
      />

      <HubShortcuts current="Bookings" />

      {loaded && items.length === 0 ? (
        <EmptyState
          icon="material"
          title={t('noBookings')}
          actionLabel={t('newBooking')}
          onAction={() => setCreateOpen(true)}
        />
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

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    statRow: { flexDirection: 'row', gap: theme.spacing.md },
  });
