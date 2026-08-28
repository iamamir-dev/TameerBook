import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { ProjectCost } from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatRupees } from '@/utils/money';

interface Props {
  cost: ProjectCost;
  /** Buyer money received so far (sale receipts) — shows a Received/Net line. */
  received?: number;
  /** Agreed sale price with the buyer (0 = no sale deal yet). */
  salePrice?: number;
}

type Tone = 'gold' | 'accent' | 'success';

/** Each phase keeps a fixed brand tone, carried by the LABEL COLOR (no fills). */
const SEGMENTS: {
  key: 'plotCost' | 'constructionCost' | 'saleCost';
  labelKey: 'phasePlot' | 'phaseConstruction' | 'phaseSaleCost';
  tone: Tone;
}[] = [
  { key: 'plotCost', labelKey: 'phasePlot', tone: 'gold' },
  { key: 'constructionCost', labelKey: 'phaseConstruction', tone: 'accent' },
  // "Sale costs" = commission/transfer paid on the sale side (NOT money in).
  { key: 'saleCost', labelKey: 'phaseSaleCost', tone: 'gold' },
];

/**
 * The project's total-cost hero with a phase breakdown as three columns —
 * amount on top, the phase name beneath in its brand color (plot gold,
 * construction green-accent, sale green) — separated by light hairlines.
 * Deliberately no progress bar and no tinted fills: color lives in the type.
 */
export function ProjectCostCard({ cost, received = 0, salePrice = 0 }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const net = received - cost.totalCost;

  return (
    <View style={styles.card}>
      <AppText size="overline" weight="semibold" color="textSecondary" uppercase>
        {t('projectTotalCost')}
      </AppText>
      <AppText size="display" weight="bold" color="primary" tabular numberOfLines={1} adjustsFontSizeToFit>
        {formatRupees(cost.totalCost)}
      </AppText>

      <View style={styles.rule} />

      <View style={styles.columns}>
        {SEGMENTS.filter((s) => s.key !== 'saleCost' || cost.saleCost > 0).map((s, i) => (
          <React.Fragment key={s.key}>
            {i > 0 ? <View style={styles.colDivider} /> : null}
            <View style={styles.col}>
              <AppText size="sm" weight="bold" tabular numberOfLines={1} adjustsFontSizeToFit>
                {formatRupees(cost[s.key])}
              </AppText>
              <AppText size="xs" weight="semibold" color={s.tone} numberOfLines={1}>
                {t(s.labelKey)}
              </AppText>
            </View>
          </React.Fragment>
        ))}
      </View>

      {/* The sale side — deal, received, profit — same column grid as above. */}
      {salePrice > 0 || received > 0 ? (
        <>
          <View style={styles.rule} />
          <View style={styles.columns}>
            {salePrice > 0 ? (
              <>
                <View style={styles.col}>
                  <AppText size="sm" weight="bold" tabular numberOfLines={1} adjustsFontSizeToFit>
                    {formatRupees(salePrice)}
                  </AppText>
                  <AppText size="xs" weight="semibold" color="textSecondary" numberOfLines={1}>
                    {t('saleDeal')}
                  </AppText>
                </View>
                <View style={styles.colDivider} />
              </>
            ) : null}
            <View style={styles.col}>
              <AppText size="sm" weight="bold" color="success" tabular numberOfLines={1} adjustsFontSizeToFit>
                {formatRupees(received)}
              </AppText>
              <AppText size="xs" weight="semibold" color="textSecondary" numberOfLines={1}>
                {t('receivedLabel')}
              </AppText>
            </View>
            <View style={styles.colDivider} />
            <View style={styles.col}>
              <AppText size="sm" weight="bold" color={net >= 0 ? 'success' : 'danger'} tabular numberOfLines={1} adjustsFontSizeToFit>
                {formatRupees(net)}
              </AppText>
              <AppText size="xs" weight="semibold" color="textSecondary" numberOfLines={1}>
                {t('netSoFar')}
              </AppText>
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.hero,
      padding: theme.spacing.xl,
      gap: theme.spacing.xs,
      ...theme.shadows.card,
    },
    rule: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginTop: theme.spacing.sm,
    },
    columns: {
      flexDirection: 'row',
      alignItems: 'stretch',
      marginTop: theme.spacing.sm,
    },
    col: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    colDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginVertical: theme.spacing.xs,
    },
  });
