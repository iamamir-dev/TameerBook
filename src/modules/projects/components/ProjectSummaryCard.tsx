import dayjs from 'dayjs';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActionsDrawer, AppButton, AppCard, AppIcon, AppText } from '@/components/ui';
import type { ProjectDistribution, SettlementSummary } from '@/db';
import type { SettlementReportActions } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatRupees } from '@/utils/money';

/** Settle affordance state (UC-9): visible once a sale exists, gated until ready. */
export interface SettleActionProps {
  /** True only when the sale is fully received and the project is ACTIVE. */
  enabled: boolean;
  /** What the buyer still owes (shown in the disabled hint when > 0). */
  outstanding: number;
  onPress: () => void;
}

interface ProjectSummaryCardProps {
  settlement: SettlementSummary;
  /** What actually happened at settlement (null = not settled yet). */
  distribution?: ProjectDistribution | null;
  /** Render the settle button inside the card (null = hidden, e.g. completed). */
  settle?: SettleActionProps | null;
  /** Pencil beside the heading — switches a completed project to edit mode. */
  onEdit?: (() => void) | null;
  /** Report actions (preview / download / share) once the project is settled. */
  report?: SettlementReportActions | null;
  /** Project timeline: start → settled (end = today while running). */
  period?: { start: string | null; end: string | null } | null;
}

/**
 * The live settlement summary on Project Detail: revenue / expenses / net,
 * a per-investor payout block, the owner's residual, the committed
 * distribution and — once settled — the branded-PDF report drawer.
 */
export function ProjectSummaryCard({
  settlement,
  distribution,
  settle,
  onEdit,
  report,
  period,
}: ProjectSummaryCardProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const [reportDrawer, setReportDrawer] = useState(false);

  return (
    <>
      <View style={styles.sectionHeader}>
        <AppText size="lg" weight="bold">
          {t('projectSummary')}
        </AppText>
        {onEdit ? (
          <Pressable
            onPress={onEdit}
            hitSlop={theme.touch.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={t('editProject')}
            style={styles.editBtn}
          >
            <AppIcon name="edit" size={16} color="primary" />
          </Pressable>
        ) : null}
      </View>
      <AppCard>
        <SummaryRow label={t('revenue')} value={formatRupees(settlement.revenue)} tone="success" first />
        <SummaryRow label={t('totalExpenses')} value={formatRupees(settlement.expenses)} tone="danger" />
        <SummaryRow
          label={t(settlement.isProfit ? 'netProfit' : 'netLoss')}
          value={formatRupees(Math.abs(settlement.net))}
          tone={settlement.isProfit ? 'success' : 'danger'}
        />
        {period?.start ? (
          <SummaryRow
            label={t('durationLabel')}
            value={`${dayjs(period.start).format('DD MMM YY')} → ${dayjs(period.end ?? undefined).format(
              'DD MMM YY'
            )} · ${Math.max(1, dayjs(period.end ?? undefined).diff(dayjs(period.start), 'day'))} ${t('daysLabel')}`}
          />
        ) : null}

        {settlement.investors.map((inv) => (
          <View key={inv.investorId} style={[styles.partyBlock, styles.ruled]}>
            {/* Name on the left, their ownership share on the right. */}
            <View style={styles.partyHeader}>
              <AppText size="sm" weight="bold" numberOfLines={1} style={styles.partyName}>
                {inv.name}
              </AppText>
              <AppText size="xs" weight="semibold" color="textSecondary">
                {`${t('ownershipSection')} ${inv.ownershipPct.toFixed(1)}%`}
              </AppText>
            </View>
            <MiniRow label={t('investedLabel')} value={formatRupees(inv.invested)} />
            <MiniRow
              label={t(inv.profitOrLoss >= 0 ? 'netProfit' : 'netLoss')}
              value={formatRupees(Math.abs(inv.profitOrLoss))}
              tone={inv.profitOrLoss >= 0 ? 'success' : 'danger'}
            />
            {inv.donation > 0 ? (
              <MiniRow label={t('donationLabel')} value={formatRupees(inv.donation)} tone="gold" />
            ) : null}
            <MiniRow label={t('payoutLabel')} value={formatRupees(inv.finalPayout)} bold />
          </View>
        ))}

        <View style={[styles.partyBlock, styles.ruled]}>
          <View style={styles.partyHeader}>
            <AppText size="sm" weight="bold" style={styles.partyName}>
              {t('owner')}
            </AppText>
            <AppText size="xs" weight="semibold" color="textSecondary">
              {`${t('ownershipSection')} ${settlement.owner.ownershipPct.toFixed(1)}%`}
            </AppText>
          </View>
          <MiniRow label={t('ownerInvested')} value={formatRupees(settlement.owner.invested)} />
          <MiniRow
            label={t(settlement.owner.profitOrLoss >= 0 ? 'netProfit' : 'netLoss')}
            value={formatRupees(Math.abs(settlement.owner.profitOrLoss))}
            tone={settlement.owner.profitOrLoss >= 0 ? 'success' : 'danger'}
          />
          {settlement.owner.donation > 0 ? (
            <MiniRow label={t('donationLabel')} value={formatRupees(settlement.owner.donation)} tone="gold" />
          ) : null}
        </View>

        {settlement.totalDonation > 0 ? (
          <SummaryRow label={t('totalDonation')} value={formatRupees(settlement.totalDonation)} />
        ) : null}

        {/* What actually happened at settlement (from the ledger — the khata). */}
        {distribution?.settledAt ? (
          <View style={[styles.partyBlock, styles.ruled]}>
            <View style={styles.partyHeader}>
              <AppText size="sm" weight="bold" color="accent" style={styles.partyName}>
                {t('distributionSection')}
              </AppText>
              <AppText size="xs" color="textSecondary">
                {`${t('settledOn')} ${dayjs(distribution.settledAt).format('DD MMM YYYY')}`}
              </AppText>
            </View>
            {distribution.rows.map((r) => (
              <View key={r.investorId} style={styles.partyBlock}>
                <AppText size="sm" weight="bold" numberOfLines={1}>
                  {r.name}
                </AppText>
                {r.profit > 0 ? <MiniRow label={t('netProfit')} value={formatRupees(r.profit)} tone="success" /> : null}
                {r.lossAdj > 0 ? <MiniRow label={t('netLoss')} value={formatRupees(r.lossAdj)} tone="danger" /> : null}
                {r.donation > 0 ? <MiniRow label={t('donationLabel')} value={formatRupees(r.donation)} tone="gold" /> : null}
                <MiniRow label={t('capitalBack')} value={formatRupees(r.capitalBack)} bold />
              </View>
            ))}
          </View>
        ) : null}

        {/* The branded report — ONE button, options in the app's drawer. */}
        {report?.ready ? (
          <View style={styles.reportBtn}>
            <AppButton
              label={t('reportTitle')}
              icon="pdf"
              variant="secondary"
              onPress={() => setReportDrawer(true)}
              loading={report.busy}
            />
          </View>
        ) : null}

        {settle ? <SettleAction {...settle} /> : null}
      </AppCard>

      {report ? (
        <ActionsDrawer
          visible={reportDrawer}
          onClose={() => setReportDrawer(false)}
          title={t('reportTitle')}
          actions={[
            { icon: 'preview', label: t('preview'), onPress: report.preview },
            { icon: 'download', label: t('download'), onPress: report.download },
            { icon: 'share', label: t('shareLabel'), onPress: report.share },
          ]}
        />
      ) : null}
    </>
  );
}

/**
 * The settle button with its readiness hint (V-18): always rendered once a
 * sale exists; disabled — with the concrete reason — until the buyer has
 * paid in full. Also used standalone when the summary card isn't shown yet.
 */
export function SettleAction({ enabled, outstanding, onPress }: SettleActionProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  return (
    <View style={styles.settleBtn}>
      <AppButton label={t('settleTitle')} icon="checkCircle" onPress={onPress} disabled={!enabled} />
      {!enabled ? (
        <AppText size="xs" color="textSecondary" center style={styles.settleHint}>
          {t('settleHint') +
            (outstanding > 0 ? `\n${t('warnBuyerOwes')}: ${formatRupees(outstanding)}` : '')}
        </AppText>
      ) : null}
    </View>
  );
}

/** One compact label/value line inside a participant block. */
function MiniRow({
  label,
  value,
  tone,
  bold,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger' | 'gold';
  bold?: boolean;
}): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.miniRow}>
      <AppText size="xs" color="textSecondary">
        {label}
      </AppText>
      <AppText size={bold ? 'sm' : 'xs'} weight={bold ? 'bold' : 'semibold'} tabular color={tone ?? 'textPrimary'}>
        {value}
      </AppText>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  tone,
  first,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger';
  first?: boolean;
}): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={[styles.summaryRow, !first && styles.ruled]}>
      <AppText size="sm" color="textSecondary">
        {label}
      </AppText>
      <AppText size="sm" weight="bold" tabular color={tone ?? 'textPrimary'}>
        {value}
      </AppText>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.spacing.sm,
    },
    editBtn: {
      width: 32,
      height: 32,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.sm,
    },
    partyBlock: { paddingVertical: theme.spacing.sm, gap: theme.spacing.xs },
    partyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md },
    partyName: { flex: 1 },
    miniRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    ruled: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    reportBtn: { marginTop: theme.spacing.md },
    settleBtn: { marginTop: theme.spacing.md, gap: theme.spacing.sm },
    settleHint: { paddingHorizontal: theme.spacing.md },
  });
