import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppCard, AppIcon, AppText, PhaseCard, type PhaseMetric } from '@/components/ui';
import type {
  ConstructionSummary,
  PlotSummary,
  ProjectRow,
  SaleSummary,
} from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatRupees } from '@/utils/money';

interface PhaseCardsSectionProps {
  project: ProjectRow;
  /** COMPLETED projects hide the add-plot affordance (read-only mode). */
  completed: boolean;
  plotSum: PlotSummary | null;
  constr: ConstructionSummary;
  saleSum: SaleSummary;
  /** Top construction categories + labor outstanding (computed by the screen). */
  constructionMetrics: PhaseMetric[];
  /** Whether any OWNED plot exists to offer in the add-plot picker. */
  hasFreePlots: boolean;
  /** Open the OWNED-plot picker (or the Plots tab when none exist). */
  onAddPlot: () => void;
  onOpenPlot: (plotId: string) => void;
  onOpenConstruction: () => void;
  onOpenSale: () => void;
}

/**
 * The three phase cards on Project Detail — Plot / Construction / Sale — plus
 * the "no plot yet" card with its "Add plot" action (UC-2 add-plot-later).
 */
export function PhaseCardsSection({
  project,
  completed,
  plotSum,
  constr,
  saleSum,
  constructionMetrics,
  hasFreePlots,
  onAddPlot,
  onOpenPlot,
  onOpenConstruction,
  onOpenSale,
}: PhaseCardsSectionProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  return (
    <>
      {/* Phase: Plot */}
      {project.plot_id ? (
        <PhaseCard
          title={t('phasePlot')}
          icon="plot"
          tone="primary"
          headline={plotSum?.totalCost ?? 0}
          headlineLabel={t('totalCostLabel')}
          metrics={[
            { label: t('dealPrice'), value: formatRupees(plotSum?.dealPrice ?? 0) },
            { label: t('paidToSeller'), value: formatRupees(plotSum?.paidToSeller ?? 0), tone: 'success' },
            { label: t('remaining'), value: formatRupees(plotSum?.remaining ?? 0) },
            { label: t('plotExpensesLabel'), value: formatRupees(plotSum?.expenses ?? 0) },
          ]}
          onPress={() => onOpenPlot(project.plot_id!)}
        />
      ) : (
        <AppCard onPress={completed ? undefined : onAddPlot} style={styles.noPlotCard}>
          <View style={styles.noPlotRow}>
            <AppIcon name="plot" size={22} color="textSecondary" />
            <View style={styles.flex}>
              <AppText size="md" weight="bold" color="textSecondary">
                {t('phasePlot')}
              </AppText>
              <AppText size="xs" color="textSecondary">
                {hasFreePlots ? t('selectPlot') : t('noFreePlots')}
              </AppText>
            </View>
            {!completed ? (
              <AppText size="sm" weight="semibold" color="accent">
                {t('addPlot')}
              </AppText>
            ) : null}
          </View>
        </AppCard>
      )}

      {/* Phase: Construction */}
      <PhaseCard
        title={t('phaseConstruction')}
        icon="tools"
        tone="accent"
        headline={constr.total}
        headlineLabel={t('constructionCost')}
        metrics={constructionMetrics}
        onPress={onOpenConstruction}
      />

      {/* Phase: Sale */}
      <PhaseCard
        title={t('phaseSale')}
        icon="tag"
        tone="gold"
        headline={saleSum.sale?.agreed_price ?? 0}
        headlineLabel={t('saleDeal')}
        metrics={[
          { label: t('buyerReceipts'), value: formatRupees(saleSum.receiptsTotal), tone: 'success' },
          { label: t('warnBuyerOwes'), value: formatRupees(saleSum.outstanding) },
          { label: t('saleCosts'), value: formatRupees(saleSum.costs) },
        ]}
        onPress={onOpenSale}
      />
    </>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    noPlotCard: { opacity: 0.85 },
    noPlotRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  });
