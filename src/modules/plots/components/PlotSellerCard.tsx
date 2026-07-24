import React from 'react';

import { AppCard, AppText, ContactRow } from '@/components/ui';
import type { PlotRow } from '@/db';
import { useTranslation } from '@/i18n';

/** The seller's compact card (name + call button), kept out of the money hero. */
export function PlotSellerCard({ plot }: { plot: PlotRow }): React.JSX.Element | null {
  const { t } = useTranslation();
  if (!plot.seller_name && !plot.seller_phone) return null;

  return (
    <AppCard compact>
      <AppText size="overline" weight="bold" color="textSecondary" uppercase>
        {t('seller')}
      </AppText>
      {plot.seller_name ? (
        <AppText size="sm" weight="semibold" numberOfLines={1}>
          {plot.seller_name}
        </AppText>
      ) : null}
      <ContactRow phone={plot.seller_phone} />
    </AppCard>
  );
}
