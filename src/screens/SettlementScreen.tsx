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
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
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
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([computeSettlement(projectId), getProject(projectId)]);
    setData(s);
    setProjectName(p?.name ?? '');
  }, [projectId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const sharePdf = async (s: Settlement) => {
    const rows = s.rows
      .map(
        (r) =>
          `<tr><td>${r.name}</td><td style="text-align:right">${formatRupees(r.capital)}</td><td style="text-align:right">${formatRupees(r.profitOrLoss)}</td><td style="text-align:right"><b>${formatRupees(r.finalPayout)}</b></td></tr>`
      )
      .join('');
    const html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
      <style>body{font-family:-apple-system,Roboto,sans-serif;padding:24px;color:#211F1B}
      h1{color:#1D1C18;margin:0}.sub{color:#9A958B;margin:4px 0 16px}
      .k{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #ECE8DF}
      table{width:100%;border-collapse:collapse;margin-top:16px}th,td{padding:8px;border-bottom:1px solid #ECE8DF;font-size:13px;text-align:left}
      th{color:#9A958B;text-transform:uppercase;font-size:11px}</style></head><body>
      <h1>TameerBook</h1><div class="sub">${t('settlementReceipt')} — ${projectName} · ${dayjs().format('DD MMM YYYY')}</div>
      <div class="k"><span>${t('revenue')}</span><b>${formatRupees(s.revenue)}</b></div>
      <div class="k"><span>${t('totalExpenses')}</span><b>${formatRupees(s.expenses)}</b></div>
      <div class="k"><span>${s.isProfit ? t('netProfit') : t('netLoss')}</span><b>${formatRupees(Math.abs(s.net))}</b></div>
      <table><thead><tr><th>${t('investors')}</th><th style="text-align:right">${t('capitalBack')}</th><th style="text-align:right">${s.isProfit ? t('profitShare') : t('lossShare')}</th><th style="text-align:right">${t('finalPayout')}</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`;
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('settlementReceipt') });
    }
  };

  const onConfirm = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await settleProject(projectId);
      await refreshProjects();
      await sharePdf(data);
      navigation.goBack();
    } finally {
      setSaving(false);
    }
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
              <AppText size="xs" weight="bold" color="textSecondary" style={styles.col}>{t('finalPayout')}</AppText>
            </View>
            {data.rows.map((r, i) => (
              <View key={r.projectInvestorId}>
                {i > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.tRow}>
                  <View style={styles.flex}>
                    <AppText size="sm" weight="semibold" numberOfLines={1}>{r.name}</AppText>
                    <AppText size="xs" color={data.isProfit ? 'success' : 'danger'} tabular>
                      {data.isProfit ? '+ ' : '− '}{formatRupees(Math.abs(r.profitOrLoss))}
                    </AppText>
                  </View>
                  <AppText size="sm" color="textSecondary" tabular style={styles.col}>{formatRupees(r.capital)}</AppText>
                  <AppText size="sm" weight="bold" color="gold" tabular style={styles.col}>{formatRupees(r.finalPayout)}</AppText>
                </View>
              </View>
            ))}
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
    col: { width: 84, textAlign: 'right' },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    hero: { borderRadius: theme.radius.hero, padding: theme.spacing.xl, gap: theme.spacing.xs, ...theme.shadows.card },
    kv: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing.sm },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
    tHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
    tRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.sm },
  });
