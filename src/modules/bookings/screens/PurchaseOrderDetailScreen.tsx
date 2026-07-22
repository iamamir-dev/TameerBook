import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReportPreview } from '@/components/ReportPreview';
import { StageBadge } from '@/components/StageBadge';
import { AppCard, AppHeader, AppText, LabelValueRow, LoadErrorState, PhoneChip } from '@/components/ui';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { formatRupees } from '@/utils/money';

import { BookingCard } from '../components/BookingCard';
import { usePurchaseOrder } from '../hooks/usePurchaseOrder';
import { usePurchaseOrderDetail } from '../hooks/useBookings';
import { purchaseOrderStatusMeta } from '../utils/status';
import { makeStyles } from '../styled/PurchaseOrderDetailScreen.styles';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type PoRoute = RouteProp<RootStackParamList, 'PurchaseOrderDetail'>;

export function PurchaseOrderDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { poId } = useRoute<PoRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const { data, loadFailed, reload } = usePurchaseOrderDetail(poId);
  const { po, supplierPhone } = data;
  const [previewOpen, setPreviewOpen] = useState(false);
  const pdf = usePurchaseOrder(po, supplierPhone);

  if (!po) {
    return (
      <View style={styles.screen}>
        <AppHeader title={t('purchaseOrder')} onBack={() => navigation.goBack()} />
        {loadFailed ? <LoadErrorState onRetry={reload} /> : null}
      </View>
    );
  }

  const { tone, labelKey } = purchaseOrderStatusMeta(po);
  const caption = [po.supplierName, po.projectName].filter(Boolean).join(' · ');

  return (
    <View style={styles.screen}>
      <AppHeader
        title={po.poNumber}
        subtitle={t('purchaseOrder')}
        onBack={() => navigation.goBack()}
        rightAction={{ icon: 'statement', onPress: () => setPreviewOpen(true), accessibilityLabel: t('printLabel') }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        <AppCard style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.flex}>
              <AppText size="overline" weight="bold" color="textSecondary" uppercase>
                {t('totalLabel')}
              </AppText>
              <AppText size="display" weight="bold" tabular numberOfLines={1} adjustsFontSizeToFit>
                {formatRupees(po.total)}
              </AppText>
              {caption ? (
                <AppText size="sm" color="textSecondary" numberOfLines={1} style={styles.caption}>
                  {caption}
                </AppText>
              ) : null}
            </View>
            <StageBadge tone={tone} label={t(labelKey)} />
          </View>

          {supplierPhone ? (
            <View style={styles.metaRow}>
              <PhoneChip phone={supplierPhone} />
            </View>
          ) : null}

          <View style={styles.divider} />
          <View style={styles.columns}>
            <View style={styles.col}>
              <LabelValueRow label={t('paidLabel')} value={formatRupees(po.paid)} valueColor="danger" />
            </View>
            <View style={styles.vDivider} />
            <View style={styles.col}>
              <LabelValueRow
                label={t('payRemainingLabel')}
                value={formatRupees(po.payRemaining)}
                valueColor={po.payRemaining > 0 ? 'danger' : 'textPrimary'}
              />
            </View>
          </View>
        </AppCard>

        <AppText size="lg" weight="bold">
          {t('items')}
        </AppText>
        {po.items.map((item) => (
          <BookingCard
            key={item.booking.id}
            summary={item}
            onPress={() => navigation.navigate('BookingDetail', { bookingId: item.booking.id })}
          />
        ))}
      </ScrollView>

      <ReportPreview
        visible={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={po.poNumber}
        html={pdf.html}
        csv={pdf.csv}
        baseName={`purchase-order-${po.poNumber}`}
      />
    </View>
  );
}
