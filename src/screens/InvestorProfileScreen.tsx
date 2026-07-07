import { type RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StageBadge } from '@/components/StageBadge';
import { AppButton, AppCard, AppHeader, AppIcon, AppText } from '@/components/ui';
import {
  getInvestor,
  getInvestorProjectReturns,
  getInvestorTotalCapital,
  type InvestorLedgerEntry,
  type InvestorProjectReturn,
  type InvestorRow,
  listInvestorLedger,
} from '@/db';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { ColorPalette, Theme } from '@/theme/theme';
import { formatRupees } from '@/utils/money';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ProfileRoute = RouteProp<RootStackParamList, 'InvestorProfile'>;
type ColorKey = keyof ColorPalette;

/** Capital entry types that add to capital (+) vs reduce it (−). */
const POSITIVE = new Set(['INITIAL', 'ADDITIONAL', 'TRANSFER_IN', 'PROFIT_PAYOUT']);

function entryLabel(type: string, t: (k: TranslationKey) => string): string {
  if (type === 'INITIAL') return t('ctInitial');
  if (type === 'ADDITIONAL') return t('ctAdditional');
  return type;
}

export function InvestorProfileScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { investorId } = useRoute<ProfileRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [investor, setInvestor] = useState<InvestorRow | null>(null);
  const [ledger, setLedger] = useState<InvestorLedgerEntry[]>([]);
  const [returns, setReturns] = useState<InvestorProjectReturn[]>([]);
  const [total, setTotal] = useState(0);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(async () => {
    const [inv, entries, cap, rets] = await Promise.all([
      getInvestor(investorId),
      listInvestorLedger(investorId),
      getInvestorTotalCapital(investorId),
      getInvestorProjectReturns(investorId),
    ]);
    setInvestor(inv);
    setLedger(entries);
    setTotal(cap);
    setReturns(rets);
  }, [investorId]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  const plColor = (v: number): ColorKey => (v >= 0 ? 'success' : 'danger');

  const onShareStatement = async () => {
    if (!investor) return;
    setSharing(true);
    try {
      const rowsHtml = ledger
        .map(
          (e) =>
            `<tr><td>${dayjs(e.date).format('DD MMM YYYY')}</td><td>${entryLabel(e.entry_type, t)}</td><td>${e.projectName}</td><td style="text-align:right">${formatRupees(e.amount)}</td></tr>`
        )
        .join('');
      const html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
        <style>
          body{font-family:-apple-system,Roboto,sans-serif;padding:24px;color:#211F1B}
          h1{color:#1D1C18;margin:0}
          .sub{color:#9A958B;margin:4px 0 20px}
          .total{font-size:28px;font-weight:800;color:#1D1C18}
          table{width:100%;border-collapse:collapse;margin-top:16px}
          th,td{padding:8px;border-bottom:1px solid #ECE8DF;font-size:13px;text-align:left}
          th{color:#9A958B;text-transform:uppercase;font-size:11px}
        </style></head><body>
        <h1>TameerBook</h1>
        <div class="sub">${t('statement')}  ${investor.name}${investor.phone ? ' · ' + investor.phone : ''}</div>
        <div>${t('totalCapital')}</div>
        <div class="total">${formatRupees(total)}</div>
        <table><thead><tr><th>${t('date')}</th><th>${t('category')}</th><th>${t('projects')}</th><th style="text-align:right">${t('amount')}</th></tr></thead>
        <tbody>${rowsHtml}</tbody></table>
        <p class="sub">${dayjs().format('DD MMM YYYY')}</p>
        </body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('statement') });
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={investor?.name ?? t('investors')} onBack={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        {/* Total capital */}
        <View style={styles.hero}>
          <AppText size="overline" weight="semibold" color="onPrimaryMuted" uppercase>
            {t('totalCapital')}
          </AppText>
          <AppText size="display" weight="bold" color="onHero" tabular numberOfLines={1} adjustsFontSizeToFit>
            {formatRupees(total)}
          </AppText>
        </View>

        {/* Add more investment for this investor (to any project) */}
        <AppButton
          label={t('addInvestment')}
          icon="add"
          onPress={() => navigation.navigate('Investment', { investorId })}
        />

        <View style={styles.actions}>
          <View style={styles.flex}>
            <AppButton label={t('statement')} icon="statement" variant="secondary" onPress={onShareStatement} loading={sharing} />
          </View>
          <View style={styles.flex}>
            <AppButton label={t('exitTitle')} icon="forward" variant="secondary" onPress={() => navigation.navigate('ExitWizard', { investorId })} />
          </View>
        </View>

        {/* Project history  invested + realized profit/loss, tap to open */}
        {returns.length > 0 ? (
          <>
            <AppText size="lg" weight="bold">
              {t('perProjectBreakdown')}
            </AppText>
            <AppCard compact>
              {returns.map((r, i) => (
                <View key={r.projectId}>
                  {i > 0 ? <View style={styles.divider} /> : null}
                  <Pressable
                    onPress={() => navigation.navigate('ProjectDetail', { projectId: r.projectId })}
                    accessibilityRole="button"
                    accessibilityLabel={r.projectName}
                    style={({ pressed }) => [styles.pRow, pressed && styles.pressed]}
                  >
                    <View style={styles.flex}>
                      <AppText size="sm" weight="bold" numberOfLines={1}>
                        {r.projectName}
                      </AppText>
                      <View style={styles.subRow}>
                        <AppText size="xs" color="textSecondary" numberOfLines={1}>
                          {`${t('invested')}: ${formatRupees(r.invested)}`}
                        </AppText>
                        <StageBadge
                          tone={r.settled ? 'success' : 'accent'}
                          label={r.settled ? t('statusDone') : t('statusCurrent')}
                        />
                      </View>
                    </View>
                    {r.settled ? (
                      <AppText size="sm" weight="bold" color={plColor(r.profitOrLoss)} tabular>
                        {`${r.profitOrLoss >= 0 ? '+' : '−'}${formatRupees(Math.abs(r.profitOrLoss))}`}
                      </AppText>
                    ) : (
                      <AppText size="sm" weight="bold" color="gold" tabular>
                        {formatRupees(r.invested)}
                      </AppText>
                    )}
                    <AppIcon name="forward" size={18} color="textSecondary" />
                  </Pressable>
                </View>
              ))}
            </AppCard>
          </>
        ) : null}

        {/* Capital timeline */}
        <AppText size="lg" weight="bold">
          {t('capitalTimeline')}
        </AppText>
        <AppCard compact>
          {ledger.map((e, i) => {
            const positive = POSITIVE.has(e.entry_type);
            const tone: ColorKey = positive ? 'success' : 'danger';
            return (
              <View key={e.id}>
                {i > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.lRow}>
                  <View style={[styles.chip, { backgroundColor: positive ? theme.colors.successSoft : theme.colors.dangerSoft }]}>
                    <AppText size="xs" weight="bold" color={tone}>
                      {entryLabel(e.entry_type, t)}
                    </AppText>
                  </View>
                  <View style={styles.flex}>
                    <AppText size="sm" weight="semibold" numberOfLines={1}>
                      {e.projectName}
                    </AppText>
                    <AppText size="xs" color="textSecondary">
                      {dayjs(e.date).format('DD MMM YYYY')}
                    </AppText>
                  </View>
                  <AppText size="sm" weight="bold" color={tone} tabular>
                    {positive ? '+ ' : '− '}
                    {formatRupees(e.amount)}
                  </AppText>
                </View>
              </View>
            );
          })}
          {ledger.length === 0 ? (
            <AppText size="sm" color="textSecondary" center style={styles.empty}>
              {t('comingSoon')}
            </AppText>
          ) : null}
        </AppCard>
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    actions: { flexDirection: 'row', gap: theme.spacing.md },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    hero: {
      backgroundColor: theme.colors.heroBg,
      borderRadius: theme.radius.hero,
      padding: theme.spacing.xl,
      gap: theme.spacing.xs,
      ...theme.shadows.card,
    },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
    pRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.md },
    subRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: 2 },
    pressed: { opacity: 0.6 },
    lRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.sm },
    chip: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderRadius: theme.radius.pill },
    empty: { paddingVertical: theme.spacing.lg },
  });
