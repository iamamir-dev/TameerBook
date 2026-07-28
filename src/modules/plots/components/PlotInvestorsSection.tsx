import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  AddActionButton,
  AppButton,
  AppCard,
  AppIcon,
  AppSheet,
  AppText,
  MoneyEntrySheet,
  SelectSheet,
  type SelectOption,
} from '@/components/ui';
import {
  addInvestment,
  getPlotSettlementSummary,
  listAccountsWithBalance,
  listInvestors,
  settlePlot,
  type AccountWithBalance,
  type InvestorRow,
  type SettlementSummary,
} from '@/db';
import { useFocusData, useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import { todayISO } from '@/utils/date';
import { formatRupees } from '@/utils/money';

import { makeStyles } from '../styled/PlotInvestorsSection.styles';

interface Props {
  plotId: string;
  /** Locked once the flip is settled or sold. */
  locked: boolean;
  /** Refresh the parent plot detail after a change (invest / settle). */
  onChanged: () => Promise<void>;
}

interface AddForm {
  investorId: string | null;
  amount: number;
  accountId: string | null;
  date: string;
}

/**
 * Musharakah investors on a STANDALONE plot flip: a live capital + projected-
 * profit breakdown, "add investor money", and a one-tap Settle (by-ownership)
 * that pays everyone out. Reuses the same capital ledger + settlement engine as
 * projects — hidden for plots inside a project (those settle at the project).
 */
export function PlotInvestorsSection({ plotId, locked, onChanged }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { saving, run } = useSaveAction();

  const load = useCallback(
    async () => ({
      summary: await getPlotSettlementSummary(plotId),
      investors: await listInvestors(),
      accounts: await listAccountsWithBalance(),
    }),
    [plotId]
  );
  const { data, reload } = useFocusData(load, {
    summary: null as SettlementSummary | null,
    investors: [] as InvestorRow[],
    accounts: [] as AccountWithBalance[],
  });
  const { summary, investors, accounts } = data;

  const [addOpen, setAddOpen] = useState(false);
  const [pickInvestor, setPickInvestor] = useState(false);
  const [form, setForm] = useState<AddForm>({ investorId: null, amount: 0, accountId: null, date: todayISO().slice(0, 10) });
  const patch = (p: Partial<AddForm>) => setForm((s) => ({ ...s, ...p }));

  const [settleOpen, setSettleOpen] = useState(false);
  const [payoutAccountId, setPayoutAccountId] = useState<string | null>(null);

  const openAdd = () => {
    setForm({ investorId: null, amount: 0, accountId: accounts[0]?.id ?? null, date: todayISO().slice(0, 10) });
    setAddOpen(true);
  };

  const refresh = async () => {
    await reload();
    await onChanged();
  };

  const onSaveInvestment = () => {
    if (!form.investorId || form.amount <= 0 || !form.accountId || saving) return;
    void run(async () => {
      await addInvestment({ investorId: form.investorId!, plotId, amount: form.amount, date: form.date, accountId: form.accountId! });
      setAddOpen(false);
      await refresh();
    });
  };

  const onSettle = () => {
    if (saving) return;
    void run(async () => {
      await settlePlot(plotId, { kind: 'ownership' }, { payoutAccountId: payoutAccountId ?? undefined });
      setSettleOpen(false);
      await refresh();
    });
  };

  const hasInvestors = (summary?.investors.length ?? 0) > 0;
  // Nothing to show and nothing to do → don't clutter a plain plot.
  if (!summary || (!hasInvestors && locked)) return <></>;

  const investorName = (id: string | null) => investors.find((i) => i.id === id)?.name ?? null;
  const investorOptions: SelectOption[] = investors.map((i) => ({ id: i.id, label: i.name }));
  const accountOptions: SelectOption[] = accounts.map((a) => ({ id: a.id, label: `${a.name} · ${formatRupees(a.balance)}` }));

  return (
    <>
      <View style={[styles.row, styles.title]}>
        <AppText size="lg" weight="bold" style={styles.flex}>
          {t('tabInvestors')}
        </AppText>
        {!locked ? <AddActionButton onPress={openAdd} accessibilityLabel={t('addInvestment')} /> : null}
      </View>

      <AppCard style={styles.card}>
        {summary.investors.map((r, i) => (
          <View key={r.investorId} style={[styles.row, i > 0 && styles.ruled]}>
            <View style={styles.nameCol}>
              <AppText size="sm" weight="semibold" numberOfLines={1}>
                {r.name}
              </AppText>
              <AppText size="xs" color="textSecondary">
                {`${t('invested')} ${formatRupees(r.invested)} · ${r.ownershipPct.toFixed(0)}%`}
              </AppText>
            </View>
            <AppText size="sm" weight="bold" tabular color={r.profitOrLoss >= 0 ? 'success' : 'danger'}>
              {formatRupees(r.profitOrLoss)}
            </AppText>
          </View>
        ))}

        {/* Owner (residual financier). */}
        <View style={[styles.row, summary.investors.length > 0 && styles.ruled]}>
          <View style={styles.nameCol}>
            <AppText size="sm" weight="semibold">
              {t('owner')}
            </AppText>
            <AppText size="xs" color="textSecondary">
              {`${t('invested')} ${formatRupees(summary.owner.invested)} · ${summary.owner.ownershipPct.toFixed(0)}%`}
            </AppText>
          </View>
          <AppText size="sm" weight="bold" tabular color={summary.owner.profitOrLoss >= 0 ? 'success' : 'danger'}>
            {formatRupees(summary.owner.profitOrLoss)}
          </AppText>
        </View>

        <View style={[styles.row, styles.ruled]}>
          <AppText size="sm" weight="bold">
            {summary.isProfit ? t('netProfit') : t('netLoss')}
          </AppText>
          <AppText size="md" weight="bold" tabular color={summary.isProfit ? 'success' : 'danger'}>
            {formatRupees(summary.net)}
          </AppText>
        </View>

        {!locked && hasInvestors ? (
          <AppButton label={t('settleTitle')} icon="check" onPress={() => { setPayoutAccountId(accounts[0]?.id ?? null); setSettleOpen(true); }} />
        ) : null}
      </AppCard>

      {/* Add investor money */}
      <MoneyEntrySheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('addInvestment')}
        header={
          <Pressable onPress={() => setPickInvestor(true)} style={styles.chip} accessibilityRole="button">
            <AppIcon name="investor" size={18} color="primary" />
            <AppText size="sm" weight="semibold" style={styles.flex} color={form.investorId ? 'textPrimary' : 'textSecondary'} numberOfLines={1}>
              {investorName(form.investorId) ?? t('selectInvestor')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>
        }
        amount={form.amount}
        onAmountChange={(amount) => patch({ amount })}
        accounts={accounts}
        accountId={form.accountId}
        onAccountChange={(accountId) => patch({ accountId })}
        date={form.date}
        onDateChange={(date) => patch({ date })}
        onSave={onSaveInvestment}
        saving={saving}
        saveDisabled={!form.investorId || form.amount <= 0 || !form.accountId}
      />

      <SelectSheet
        visible={pickInvestor}
        onClose={() => setPickInvestor(false)}
        options={investorOptions}
        selectedId={form.investorId ?? undefined}
        title={t('selectInvestor')}
        onSelect={(o) => patch({ investorId: o.id })}
      />

      {/* Settle the flip (by-ownership) */}
      <AppSheet
        visible={settleOpen}
        onClose={() => setSettleOpen(false)}
        title={t('settleTitle')}
        footer={<AppButton label={t('settleTitle')} icon="check" onPress={onSettle} loading={saving} fullWidth />}
      >
        <AppText size="sm" color="textSecondary">
          {summary.isProfit ? t('netProfit') : t('netLoss')}
        </AppText>
        <AppText size="display" weight="bold" tabular color={summary.isProfit ? 'success' : 'danger'}>
          {formatRupees(summary.net)}
        </AppText>
        <AppText size="sm" weight="semibold" color="textSecondary">
          {t('selectAccount')}
        </AppText>
        {accountOptions.map((o) => {
          const sel = payoutAccountId === o.id;
          return (
            <Pressable key={o.id} onPress={() => setPayoutAccountId(o.id)} style={styles.chip} accessibilityRole="button" accessibilityState={{ selected: sel }}>
              <AppIcon name={sel ? 'check' : 'bank'} size={18} color={sel ? 'accent' : 'textSecondary'} />
              <AppText size="sm" weight="semibold" style={styles.flex} numberOfLines={1}>
                {o.label}
              </AppText>
            </Pressable>
          );
        })}
      </AppSheet>
    </>
  );
}
