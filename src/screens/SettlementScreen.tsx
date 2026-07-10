import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton, AppCard, AppHeader, AppText } from '@/components/ui';
import { computeSettlement, getProject, type Settlement, settleProject } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { swallow } from '@/utils/log';
import { formatRupees } from '@/utils/money';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type SettleRoute = RouteProp<RootStackParamList, 'Settlement'>;

export function SettlementScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { projectId } = useRoute<SettleRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const refreshProjects = useProjectsStore((s) => s.refresh);

  const [data, setData] = useState<Settlement | null>(null);
  const [projectName, setProjectName] = useState('');
  const { saving, run: runSave } = useSaveAction();

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([computeSettlement(projectId), getProject(projectId)]);
    setData(s);
    setProjectName(p?.name ?? '');
  }, [projectId]);

  useEffect(() => {
    load().catch(swallow('settlement:load'));
  }, [load]);

  const sharePdf = async (s: Settlement) => {
    const showDonation = s.totalDonation > 0;
    const right = ' style="text-align:right"';
    const rows = s.rows
      .map(
        (r) =>
          `<tr><td>${r.name}</td><td${right}>${formatRupees(r.capital)}</td><td${right}>${formatRupees(r.profitOrLoss)}</td>${showDonation ? `<td${right}>${formatRupees(r.donation)}</td>` : ''}<td${right}><b>${formatRupees(r.finalPayout)}</b></td></tr>`
      )
      .join('');
    const ownerRow = `<tr><td>${t('owner')} (${t('ownerInvested')})</td><td${right}>${formatRupees(s.owner.capital)}</td><td${right}>${formatRupees(s.owner.profitOrLoss)}</td>${showDonation ? `<td${right}>${formatRupees(s.owner.donation)}</td>` : ''}<td${right}></td></tr>`;
    const html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
      <style>body{font-family:-apple-system,Roboto,sans-serif;padding:24px;color:#211F1B}
      h1{color:#1D1C18;margin:0}.sub{color:#9A958B;margin:4px 0 16px}
      .k{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #ECE8DF}
      table{width:100%;border-collapse:collapse;margin-top:16px}th,td{padding:8px;border-bottom:1px solid #ECE8DF;font-size:13px;text-align:left}
      th{color:#9A958B;text-transform:uppercase;font-size:11px}</style></head><body>
      <h1>TameerBook</h1><div class="sub">${t('settlementReceipt')}  ${projectName} · ${dayjs().format('DD MMM YYYY')}</div>
      <div class="k"><span>${t('revenue')}</span><b>${formatRupees(s.revenue)}</b></div>
      <div class="k"><span>${t('totalExpenses')}</span><b>${formatRupees(s.expenses)}</b></div>
      <div class="k"><span>${s.isProfit ? t('netProfit') : t('netLoss')}</span><b>${formatRupees(Math.abs(s.net))}</b></div>
      ${showDonation ? `<div class="k"><span>${t('totalDonation')} (${s.donationPct}%)</span><b>${formatRupees(s.totalDonation)}</b></div>` : ''}
      <table><thead><tr><th>${t('investors')}</th><th${right}>${t('capitalBack')}</th><th${right}>${s.isProfit ? t('profitShare') : t('lossShare')}</th>${showDonation ? `<th${right}>${t('donationLabel')}</th>` : ''}<th${right}>${t('finalPayout')}</th></tr></thead>
      <tbody>${rows}${ownerRow}</tbody></table></body></html>`;
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('settlementReceipt') });
    }
  };

  const onConfirm = async () => {
    if (!data) return;
    const ok = await runSave(async () => {
      await settleProject(projectId);
      await refreshProjects();
      await sharePdf(data);
    });
    if (!ok) return;
    navigation.goBack();
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={t('settleTitle')} subtitle={projectName} onBack={() => navigation.goBack()} />
      {data ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
        >
          {/* Net result hero */}
          <View style={[styles.hero, { backgroundColor: data.isProfit ? theme.colors.success : theme.colors.danger }]}>
            <AppText size="overline" weight="semibold" color="onHero" uppercase>
              {data.isProfit ? t('netProfit') : t('netLoss')}
            </AppText>
            <AppText size="display" weight="bold" color="onHero" tabular numberOfLines={1} adjustsFontSizeToFit>
              {formatRupees(Math.abs(data.net))}
            </AppText>
          </View>

          <AppCard>
            <View style={styles.kv}>
              <AppText size="sm" color="textSecondary">{t('revenue')}</AppText>
              <AppText size="md" weight="bold" color="success" tabular>{formatRupees(data.revenue)}</AppText>
            </View>
            <View style={styles.divider} />
            <View style={styles.kv}>
              <AppText size="sm" color="textSecondary">{t('totalExpenses')}</AppText>
              <AppText size="md" weight="bold" color="danger" tabular>{formatRupees(data.expenses)}</AppText>
            </View>
          </AppCard>

          {/* Distribution table */}
          <AppText size="lg" weight="bold">
            {data.isProfit ? t('profitShare') : t('lossShare')}
          </AppText>
          <AppCard compact>
            <View style={styles.tHead}>
              <AppText size="xs" weight="bold" color="textSecondary" style={styles.flex}>{t('investors')}</AppText>
              <AppText size="xs" weight="bold" color="textSecondary" style={styles.col}>{t('capitalBack')}</AppText>
              <AppText size="xs" weight="bold" color="textSecondary" style={styles.col}>{data.isProfit ? t('profitShare') : t('lossShare')}</AppText>
              {data.totalDonation > 0 ? (
                <AppText size="xs" weight="bold" color="textSecondary" style={styles.col}>{t('donationLabel')}</AppText>
              ) : null}
              <AppText size="xs" weight="bold" color="textSecondary" style={styles.col}>{t('payoutLabel')}</AppText>
            </View>
            {data.rows.map((r) => (
              <View key={r.projectInvestorId}>
                <View style={styles.tRow}>
                  <AppText size="xs" weight="semibold" numberOfLines={1} style={styles.flex}>{r.name}</AppText>
                  <AppText size="xs" color="textSecondary" tabular style={styles.col}>{formatRupees(r.capital)}</AppText>
                  <AppText size="xs" color={r.profitOrLoss >= 0 ? 'success' : 'danger'} tabular style={styles.col}>
                    {formatRupees(r.profitOrLoss)}
                  </AppText>
                  {data.totalDonation > 0 ? (
                    <AppText size="xs" color="gold" tabular style={styles.col}>{formatRupees(r.donation)}</AppText>
                  ) : null}
                  <AppText size="xs" weight="bold" tabular style={styles.col}>{formatRupees(r.finalPayout)}</AppText>
                </View>
                <View style={styles.divider} />
              </View>
            ))}
            {/* Owner (residual)  informational, not paid out */}
            <View style={styles.tRow}>
              <View style={styles.flex}>
                <AppText size="xs" weight="semibold" numberOfLines={1}>{t('owner')}</AppText>
                <AppText size="xs" color="textSecondary" numberOfLines={1}>{t('ownerInvested')}</AppText>
              </View>
              <AppText size="xs" color="textSecondary" tabular style={styles.col}>{formatRupees(data.owner.capital)}</AppText>
              <AppText size="xs" color={data.owner.profitOrLoss >= 0 ? 'success' : 'danger'} tabular style={styles.col}>
                {formatRupees(data.owner.profitOrLoss)}
              </AppText>
              {data.totalDonation > 0 ? (
                <AppText size="xs" color="gold" tabular style={styles.col}>{formatRupees(data.owner.donation)}</AppText>
              ) : null}
              <AppText size="xs" color="textSecondary" style={styles.col}></AppText>
            </View>
            {data.totalDonation > 0 ? (
              <>
                <View style={styles.divider} />
                <View style={styles.tRow}>
                  <AppText size="sm" weight="bold" color="gold" style={styles.flex}>
                    {t('totalDonation')} ({data.donationPct}%)
                  </AppText>
                  <AppText size="sm" weight="bold" color="gold" tabular>{formatRupees(data.totalDonation)}</AppText>
                </View>
              </>
            ) : null}
          </AppCard>

          <AppButton label={t('confirm')} icon="check" onPress={onConfirm} loading={saving} />
        </ScrollView>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    col: { width: 64, textAlign: 'right' },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    hero: { borderRadius: theme.radius.hero, padding: theme.spacing.xl, gap: theme.spacing.xs, ...theme.shadows.card },
    kv: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing.sm },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
    tHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
    tRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.sm },
  });
