import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReportPreview } from '@/components/ReportPreview';
import { AppButton, AppCard, AppHeader, AppText } from '@/components/ui';
import {
  type AccountFlowRow,
  type CashFlowMonth,
  type CategorySpendRow,
  getAccountFlowReport,
  getCashFlow,
  getExpenseByCategory,
  getInvestmentMatrix,
  getPnl,
  getProjectReport,
  getRoiReport,
  getTopSuppliers,
  getUdhaarTotals,
  type InvestmentMatrixRow,
  type PnlRow,
  type ProjectReportRow,
  type RoiRow,
  type SupplierSpendRow,
  type UdhaarTotals,
} from '@/db';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatRupees } from '@/utils/money';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ReportRoute = RouteProp<RootStackParamList, 'Report'>;

const TITLE: Record<ReportRoute['params']['type'], TranslationKey> = {
  summary: 'rptSummary',
  pnl: 'rptPnl',
  cashflow: 'rptCashflow',
  expense: 'rptExpense',
  investment: 'rptInvestment',
  roi: 'rptRoi',
  accounts: 'accountsTitle',
};

export function ReportScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { type } = useRoute<ReportRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [projects, setProjects] = useState<ProjectReportRow[]>([]);
  const [pnl, setPnl] = useState<PnlRow[]>([]);
  const [cash, setCash] = useState<CashFlowMonth[]>([]);
  const [cats, setCats] = useState<CategorySpendRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierSpendRow[]>([]);
  const [udhaar, setUdhaar] = useState<UdhaarTotals>({ receivable: 0, payable: 0 });
  const [matrix, setMatrix] = useState<InvestmentMatrixRow[]>([]);
  const [roi, setRoi] = useState<RoiRow[]>([]);
  const [accounts, setAccounts] = useState<AccountFlowRow[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  const load = useCallback(async () => {
    if (type === 'summary') setProjects(await getProjectReport());
    else if (type === 'pnl') setPnl(await getPnl());
    else if (type === 'cashflow') setCash(await getCashFlow());
    else if (type === 'expense') {
      setCats(await getExpenseByCategory());
      setSuppliers(await getTopSuppliers());
      setUdhaar(await getUdhaarTotals());
    } else if (type === 'investment') setMatrix(await getInvestmentMatrix());
    else if (type === 'roi') setRoi(await getRoiReport());
    else if (type === 'accounts') setAccounts(await getAccountFlowReport());
  }, [type]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const cn = (en: string, ur: string) => (language === 'ur' ? ur : en);
  const days = (start: string | null, end?: string | null) =>
    dayjs(end ?? undefined).diff(dayjs(start ?? undefined), 'day');
  const maxCat = Math.max(1, ...cats.map((c) => c.total));

  /* --------------------------- export model ---------------------------- */
  // Each report is a list of titled sections (columns + rows) → HTML + CSV.
  const buildSections = (): { heading?: string; columns: string[]; rows: string[][] }[] => {
    if (type === 'summary')
      return [{ columns: [t('projects'), t('invested'), t('totalSpent'), t('daysRunning')], rows: projects.map((p) => [p.name, formatRupees(p.invested), formatRupees(p.spent), String(days(p.start_date ?? p.created_at))]) }];
    if (type === 'pnl')
      return [{ columns: [t('projects'), t('revenue'), t('totalExpenses'), t('netLabel')], rows: pnl.map((p) => [p.name, formatRupees(p.revenue), formatRupees(p.expenses), formatRupees(p.net)]) }];
    if (type === 'cashflow') {
      let bal = 0;
      return [{ columns: [t('date'), t('filterIn'), t('filterOut'), t('runningBalance')], rows: cash.map((m) => { bal += m.inSum - m.outSum; return [m.month, formatRupees(m.inSum), formatRupees(m.outSum), formatRupees(bal)]; }) }];
    }
    if (type === 'expense')
      return [
        { columns: [t('category'), t('totalLabel')], rows: cats.map((c) => [cn(c.nameEn, c.nameUr), formatRupees(c.total)]) },
        { heading: t('topSuppliers'), columns: [t('supplier'), t('totalLabel')], rows: suppliers.map((s) => [s.name, formatRupees(s.total)]) },
        { heading: t('udhaar'), columns: [t('udhaar'), t('totalLabel')], rows: [[t('receivable'), formatRupees(udhaar.receivable)], [t('payable'), formatRupees(udhaar.payable)]] },
      ];
    if (type === 'investment')
      return [{ columns: [t('investors'), t('projects'), t('committedAmount'), t('paidLabel')], rows: matrix.map((m) => [m.investorName, m.projectName, formatRupees(m.committed), formatRupees(m.paid)]) }];
    if (type === 'roi')
      return [{ columns: [t('projects'), t('profitLabel'), t('durationLabel'), t('roiPct')], rows: roi.map((r) => [r.name, formatRupees(r.profit), `${days(r.startDate)} ${t('daysRunning')}`, `${r.roiPct.toFixed(1)}%`]) }];
    if (type === 'accounts')
      return [{ columns: [t('accountsTitle'), t('openingBalance'), t('filterIn'), t('filterOut'), t('runningBalance')], rows: accounts.map((a) => [a.name, formatRupees(a.opening), formatRupees(a.inSum), formatRupees(a.outSum), formatRupees(a.balance)]) }];
    return [];
  };

  const sections = buildSections();
  const reportHtml = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>
      body{font-family:-apple-system,Roboto,sans-serif;padding:24px;color:#211F1B}
      h1{color:#1D1C18;margin:0}.sub{color:#9A958B;margin:4px 0 16px}h3{color:#1D1C18;margin:20px 0 4px}
      table{width:100%;border-collapse:collapse;margin-top:8px}th,td{padding:8px;border-bottom:1px solid #ECE8DF;font-size:13px;text-align:left}
      th{color:#9A958B;text-transform:uppercase;font-size:11px}</style></head><body>
      <h1>TameerBook</h1><div class="sub">${t(TITLE[type])} · ${dayjs().format('DD MMM YYYY')}</div>
      ${sections
        .map(
          (s) =>
            `${s.heading ? `<h3>${s.heading}</h3>` : ''}<table><thead><tr>${s.columns
              .map((c, i) => `<th${i ? ' style="text-align:right"' : ''}>${c}</th>`)
              .join('')}</tr></thead><tbody>${s.rows
              .map((r) => `<tr>${r.map((cell, i) => `<td${i ? ' style="text-align:right"' : ''}>${cell}</td>`).join('')}</tr>`)
              .join('')}</tbody></table>`
        )
        .join('')}</body></html>`;
  const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const reportCsv = sections
    .map((s) => [s.heading ?? '', s.columns.join(','), ...s.rows.map((r) => r.map(csvCell).join(','))].filter(Boolean).join('\n'))
    .join('\n\n');

  /* ------------------------------- UI rows ----------------------------- */
  let runBal = 0;

  return (
    <View style={styles.screen}>
      <AppHeader title={t(TITLE[type])} onBack={() => navigation.goBack()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        <AppButton label={t('preview')} icon="preview" onPress={() => setPreviewOpen(true)} />

        {type === 'summary' ? (
          <AppCard compact>
            {projects.map((p, i) => (
              <Row key={p.id} first={i === 0} styles={styles}
                left={<><AppText size="sm" weight="bold" numberOfLines={1}>{p.name}</AppText>
                  <AppText size="xs" color="textSecondary">{p.status === 'COMPLETED' ? t('statusDone') : t('statusCurrent')} · {days(p.start_date ?? p.created_at)} {t('daysRunning')}</AppText></>}
                right={<><AppText size="sm" weight="bold" color="danger" tabular>{formatRupees(p.spent)}</AppText>
                  <AppText size="xs" color="gold" tabular>{formatRupees(p.invested)}</AppText></>} />
            ))}
          </AppCard>
        ) : null}

        {type === 'pnl' ? (
          <AppCard compact>
            {pnl.map((p, i) => (
              <Row key={p.id} first={i === 0} styles={styles}
                left={<AppText size="sm" weight="bold" numberOfLines={1}>{p.name}</AppText>}
                right={<AppText size="md" weight="bold" color={p.net >= 0 ? 'success' : 'danger'} tabular>{formatRupees(p.net)}</AppText>} />
            ))}
          </AppCard>
        ) : null}

        {type === 'cashflow' ? (
          <AppCard compact>
            {cash.map((m, i) => {
              runBal += m.inSum - m.outSum;
              return (
                <Row key={m.month} first={i === 0} styles={styles}
                  left={<><AppText size="sm" weight="bold">{m.month}</AppText>
                    <AppText size="xs" color="textSecondary" tabular>+{formatRupees(m.inSum)} · −{formatRupees(m.outSum)}</AppText></>}
                  right={<AppText size="sm" weight="bold" color={runBal >= 0 ? 'success' : 'danger'} tabular>{formatRupees(runBal)}</AppText>} />
              );
            })}
          </AppCard>
        ) : null}

        {type === 'expense' ? (
          <>
            <AppCard>
              {cats.map((c) => (
                <View key={c.nameEn} style={styles.barRow}>
                  <AppText size="xs" numberOfLines={1} style={styles.barLabel}>{cn(c.nameEn, c.nameUr)}</AppText>
                  <View style={styles.barTrack}><View style={[styles.barFill, { width: `${(c.total / maxCat) * 100}%` }]} /></View>
                  <AppText size="xs" weight="bold" tabular style={styles.barVal}>{formatRupees(c.total)}</AppText>
                </View>
              ))}
            </AppCard>
            <AppText size="lg" weight="bold">{t('topSuppliers')}</AppText>
            <AppCard compact>
              {suppliers.map((s, i) => (
                <Row key={s.name + i} first={i === 0} styles={styles}
                  left={<AppText size="sm" weight="semibold" numberOfLines={1}>{s.name}</AppText>}
                  right={<AppText size="sm" weight="bold" color="danger" tabular>{formatRupees(s.total)}</AppText>} />
              ))}
            </AppCard>
            <AppText size="lg" weight="bold">{t('udhaar')}</AppText>
            <AppCard compact>
              <Row first styles={styles}
                left={<AppText size="sm" weight="semibold" numberOfLines={1}>{t('receivable')}</AppText>}
                right={<AppText size="sm" weight="bold" color="success" tabular>{formatRupees(udhaar.receivable)}</AppText>} />
              <Row first={false} styles={styles}
                left={<AppText size="sm" weight="semibold" numberOfLines={1}>{t('payable')}</AppText>}
                right={<AppText size="sm" weight="bold" color="danger" tabular>{formatRupees(udhaar.payable)}</AppText>} />
            </AppCard>
          </>
        ) : null}

        {type === 'investment' ? (
          <AppCard compact>
            {matrix.map((m, i) => (
              <Row key={i} first={i === 0} styles={styles}
                left={<><AppText size="sm" weight="bold" numberOfLines={1}>{m.investorName}</AppText>
                  <AppText size="xs" color="textSecondary" numberOfLines={1}>{m.projectName}</AppText></>}
                right={<><AppText size="sm" weight="bold" color="gold" tabular>{formatRupees(m.paid)}</AppText>
                  <AppText size="xs" color="textSecondary" tabular>/ {formatRupees(m.committed)}</AppText></>} />
            ))}
          </AppCard>
        ) : null}

        {type === 'roi' ? (
          <AppCard compact>
            {roi.map((r, i) => (
              <Row key={r.id} first={i === 0} styles={styles}
                left={<><AppText size="sm" weight="bold" numberOfLines={1}>{r.name}</AppText>
                  <AppText size="xs" color="textSecondary">{formatRupees(r.profit)} · {days(r.startDate)} {t('daysRunning')}</AppText></>}
                right={<AppText size="md" weight="bold" color={r.roiPct >= 0 ? 'success' : 'danger'} tabular>{r.roiPct.toFixed(1)}%</AppText>} />
            ))}
            {roi.length === 0 ? <AppText size="sm" color="textSecondary" center style={styles.empty}>{t('comingSoon')}</AppText> : null}
          </AppCard>
        ) : null}

        {type === 'accounts' ? (
          <AppCard compact>
            {accounts.map((a, i) => (
              <Row key={a.id} first={i === 0} styles={styles}
                left={<><AppText size="sm" weight="bold" numberOfLines={1}>{a.name}</AppText>
                  <AppText size="xs" color="textSecondary" tabular>{t('openingBalance')}: {formatRupees(a.opening)} · +{formatRupees(a.inSum)} · −{formatRupees(a.outSum)}</AppText></>}
                right={<AppText size="md" weight="bold" color={a.balance >= 0 ? 'success' : 'danger'} tabular>{formatRupees(a.balance)}</AppText>} />
            ))}
          </AppCard>
        ) : null}
      </ScrollView>

      <ReportPreview
        visible={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={t(TITLE[type])}
        html={reportHtml}
        csv={reportCsv}
        baseName={`tameerbook-${type}`}
      />
    </View>
  );
}

function Row({
  left,
  right,
  first,
  styles,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  first: boolean;
  styles: ReturnType<typeof makeStyles>;
}): React.JSX.Element {
  return (
    <View>
      {!first ? <View style={styles.divider} /> : null}
      <View style={styles.row}>
        <View style={styles.rowLeft}>{left}</View>
        <View style={styles.rowRight}>{right}</View>
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md, paddingVertical: theme.spacing.sm },
    rowLeft: { flex: 1, gap: 2 },
    rowRight: { alignItems: 'flex-end', gap: 2 },
    empty: { paddingVertical: theme.spacing.lg },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xs },
    barLabel: { width: 80 },
    barTrack: { flex: 1, height: 8, borderRadius: theme.radius.pill, backgroundColor: theme.colors.track, overflow: 'hidden' },
    barFill: { height: 8, borderRadius: theme.radius.pill, backgroundColor: theme.colors.accent },
    barVal: { width: 80, textAlign: 'right' },
  });
