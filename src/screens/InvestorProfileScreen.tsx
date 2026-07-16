import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InvestorPersonSheet } from '@/components/InvestorPersonSheet';
import { StageBadge } from '@/components/StageBadge';
import { ActionsDrawer, AddActionButton, AmountInput, AppButton, AppCard, AppHeader, AppIcon, AppText, ContactRow, DateField, SelectSheet, type IconKey, type SelectOption } from '@/components/ui';
import {
  addInvestorPayment,
  getInvestor,
  getInvestorProjectReturns,
  getInvestorSummary,
  listAccountsWithBalance,
  type AccountWithBalance,
  type InvestorLedgerEntry,
  type InvestorProjectReturn,
  type InvestorRow,
  listInvestorLedger,
} from '@/db';
import { useFocusReload, useSaveAction } from '@/hooks';
import { todayISO } from '@/utils/date';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { ColorPalette, Theme } from '@/theme/theme';
import { swallow } from '@/utils/log';
import { formatRupees } from '@/utils/money';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ProfileRoute = RouteProp<RootStackParamList, 'InvestorProfile'>;
type ColorKey = keyof ColorPalette;

/** Capital entry types that add to capital (+) vs reduce it (−). */
const POSITIVE = new Set(['INITIAL', 'ADDITIONAL', 'TRANSFER_IN', 'PROFIT_PAYOUT']);

/** Human label for every capital-entry type; falls back to the raw value. */
const ENTRY_LABEL: Record<string, TranslationKey> = {
  INITIAL: 'ctInitial',
  ADDITIONAL: 'ctAdditional',
  TRANSFER_IN: 'ctTransferIn',
  TRANSFER_OUT: 'ctTransferOut',
  WITHDRAWAL: 'ctWithdrawal',
  EXIT_SETTLEMENT: 'ctExitSettlement',
  PROFIT_PAYOUT: 'ctProfitPayout',
  DONATION: 'ctDonation',
  LOSS_ADJ: 'ctLossAdj',
};

function entryLabel(type: string, t: (k: TranslationKey) => string): string {
  const key = ENTRY_LABEL[type];
  return key ? t(key) : type;
}

export function InvestorProfileScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { investorId } = useRoute<ProfileRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [investor, setInvestor] = useState<InvestorRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [ledger, setLedger] = useState<InvestorLedgerEntry[]>([]);
  const [returns, setReturns] = useState<InvestorProjectReturn[]>([]);
  const [committed, setCommitted] = useState(0);
  const [received, setReceived] = useState(0);
  const [sharing, setSharing] = useState(false);

  // Receive-payment sheet.
  const [payOpen, setPayOpen] = useState(false);
  // Bottom drawer with the money actions (replaces the old stacked footer).
  const [actionsOpen, setActionsOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [payDate, setPayDate] = useState(todayISO().slice(0, 10));
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [payAccountId, setPayAccountId] = useState<string | null>(null);
  const [accountSheet, setAccountSheet] = useState(false);

  const remaining = Math.max(0, committed - received);

  const load = useCallback(async () => {
    const [inv, entries, summary, rets, accs] = await Promise.all([
      getInvestor(investorId),
      listInvestorLedger(investorId),
      getInvestorSummary(investorId),
      getInvestorProjectReturns(investorId),
      listAccountsWithBalance(),
    ]);
    setInvestor(inv);
    setLedger(entries);
    setCommitted(summary.committed);
    setReceived(summary.received);
    setReturns(rets);
    setAccounts(accs);
    setPayAccountId((prev) => prev ?? accs[0]?.id ?? null);
  }, [investorId]);

  const { reload } = useFocusReload(load);
  const { saving: savingPay, run: runSave } = useSaveAction();

  const plColor = (v: number): ColorKey => (v >= 0 ? 'success' : 'danger');

  // Exiting only makes sense while the investor still has un-settled
  // participation somewhere — otherwise the action is hidden.
  const canExit = returns.some((r) => !r.settled);

  const payAccount = accounts.find((a) => a.id === payAccountId) ?? null;
  const accountOptions: SelectOption[] = accounts.map((a) => ({
    id: a.id,
    label: a.name,
    subtitle: formatRupees(a.balance),
    icon: (a.type === 'BANK' ? 'bank' : a.type === 'CASH' ? 'rupee' : 'balance') as IconKey,
  }));

  const openReceive = () => {
    setPayAmount(0);
    setPayDate(todayISO().slice(0, 10));
    setPayOpen(true);
  };

  const onReceivePayment = async () => {
    if (payAmount <= 0 || !payAccountId || savingPay) return;
    const ok = await runSave(async () => {
      await addInvestorPayment({ investorId, amount: payAmount, date: payDate, accountId: payAccountId });
    });
    if (!ok) return;
    setPayOpen(false);
    await reload();
  };

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
        <div>${t('receivedLabel')}</div>
        <div class="total">${formatRupees(received)}</div>
        <table><thead><tr><th>${t('date')}</th><th>${t('category')}</th><th>${t('projects')}</th><th style="text-align:right">${t('amount')}</th></tr></thead>
        <tbody>${rowsHtml}</tbody></table>
        <p class="sub">${dayjs().format('DD MMM YYYY')}</p>
        </body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('statement') });
      }
    } catch (e) {
      swallow('investor:statement')(e);
      Alert.alert(t('errorTitle'), t('errorBody'));
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        title={investor?.name ?? t('investors')}
        onBack={() => navigation.goBack()}
        rightAction={
          investor
            ? { icon: 'edit', onPress: () => setEditOpen(true), accessibilityLabel: t('editInvestor') }
            : undefined
        }
      />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: theme.spacing.xl }]}
      >
        {/* Received vs committed — the plot-style deal/paid/remaining. */}
        <View style={styles.hero}>
          <AppText size="overline" weight="semibold" color="onPrimaryMuted" uppercase>
            {t('receivedLabel')}
          </AppText>
          <AppText size="display" weight="bold" color="onHero" tabular numberOfLines={1} adjustsFontSizeToFit>
            {formatRupees(received)}
          </AppText>

        </View>

        <ContactRow phone={investor?.phone} cnic={investor?.cnic} />

        {investor?.bank_info ? (
          <AppText size="sm" color="textSecondary">
            {`${t('bankDetails')}: ${investor.bank_info}`}
          </AppText>
        ) : null}

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

        {/* Capital timeline — the "+" opens the actions drawer. */}
        <View style={styles.sectionHeader}>
          <AppText size="lg" weight="bold">
            {t('capitalTimeline')}
          </AppText>
          <AddActionButton onPress={() => setActionsOpen(true)} accessibilityLabel={t('receivePayment')} />
        </View>
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
              {t('emptyLedger')}
            </AppText>
          ) : null}
        </AppCard>
      </ScrollView>

      {/* Actions drawer — receive / invest / statement / exit in one sheet. */}
      <ActionsDrawer
        visible={actionsOpen}
        onClose={() => setActionsOpen(false)}
        title={investor?.name ?? ''}
        actions={[
          { icon: 'moneyIn', label: t('receivePayment'), onPress: openReceive },
          {
            icon: 'investor',
            label: t('addInvestment'),
            onPress: () => navigation.navigate('Investment', { investorId }),
          },
          { icon: 'statement', label: t('statement'), loading: sharing, onPress: onShareStatement },
          ...(canExit
            ? [
              {
                icon: 'forward' as const,
                label: t('exitTitle'),
                onPress: () => navigation.navigate('ExitWizard', { investorId }),
              },
            ]
            : []),
        ]}
      />

      {/* Receive-payment sheet */}
      <Modal visible={payOpen} transparent animationType="slide" onRequestClose={() => setPayOpen(false)}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.backdrop} onPress={() => setPayOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
            <View style={styles.grabber} />
            <AppText size="lg" weight="bold">
              {t('receivePayment')}
            </AppText>
            {committed > 0 ? (
              <AppText size="sm" color="textSecondary">
                {`${t('remaining')}: ${formatRupees(remaining)}`}
              </AppText>
            ) : null}
            <AmountInput
              label={t('amount')}
              value={payAmount}
              onChange={setPayAmount}
              floating
              surface={theme.colors.card}
            />
            <Pressable onPress={() => setAccountSheet(true)} style={styles.accountChip} accessibilityRole="button">
              <AppIcon name={payAccount?.type === 'BANK' ? 'bank' : 'balance'} size={18} color="primary" />
              <AppText size="sm" weight="bold" numberOfLines={1} style={styles.flex}>
                {payAccount ? `${payAccount.name} · ${formatRupees(payAccount.balance)}` : t('selectAccount')}
              </AppText>
              <AppIcon name="forward" size={18} color="textSecondary" />
            </Pressable>
            <DateField value={payDate} onChange={setPayDate} maxDate={todayISO().slice(0, 10)} />
            <AppButton
              label={t('save')}
              icon="check"
              onPress={onReceivePayment}
              loading={savingPay}
              disabled={payAmount <= 0 || !payAccountId}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <SelectSheet
        visible={accountSheet}
        onClose={() => setAccountSheet(false)}
        options={accountOptions}
        selectedId={payAccountId ?? undefined}
        title={t('selectAccount')}
        searchable={false}
        onSelect={(o) => setPayAccountId(o.id)}
      />

      <InvestorPersonSheet
        visible={editOpen}
        editing={investor}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          void reload();
        }}
      />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    scroll: { flex: 1 },
    actions: { flexDirection: 'row', gap: theme.spacing.md },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    addFab: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadows.card,
    },
    pressedDim: { opacity: 0.7 },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.md,
    },
    actionIconChip: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.chip,
      backgroundColor: theme.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
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
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.overlay },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: theme.radius.hero,
      borderTopRightRadius: theme.radius.hero,
      padding: theme.spacing.xl,
      gap: theme.spacing.md,
      ...theme.shadows.raised,
    },
    grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: theme.radius.pill, backgroundColor: theme.colors.track },
    accountChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.background,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.lg,
      minHeight: theme.touch.minTarget,
    },
  });
