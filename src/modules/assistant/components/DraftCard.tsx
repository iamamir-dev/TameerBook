import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { CREATE_KINDS, draftToEntryPrefill, draftToMaterialPrefill, type ResolvedDraft } from '@/ai';
import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { AmountInput, AppIcon, AppText, SelectSheet, type IconKey, type SelectOption } from '@/components/ui';
import {
  getLaborerKhata,
  listAccountsWithBalance,
  listPlots,
  listProjects,
  type AccountWithBalance,
  type LaborerProjectParticipation,
  type PlotRow,
  type ProjectRow,
} from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useEntryStore } from '@/stores/useEntryStore';
import { useTheme } from '@/theme';
import { swallow } from '@/utils/log';
import { formatRupees } from '@/utils/money';

import { makeStyles } from '../styled/DraftCard.styles';
import { applyDraft, draftNeeds, type Applied, type DraftChoices } from '../utils/applyDraft';
import { draftAmount, draftFields, draftTitle } from '../utils/draftSummary';
import { navigateToTarget } from '../utils/navigateTarget';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface DraftCardProps {
  resolved: ResolvedDraft;
  /** Restored outcome (the conversation is persisted across restarts). */
  settled?: { status: 'accepted' | 'rejected'; message?: string };
  /** Fires when the user accepts (message = what was saved) or rejects. */
  onSettled?: (status: 'accepted' | 'rejected', message?: string) => void;
  /** Toast after the write lands. */
  onDone?: (message: string) => void;
}

const ICON: Record<string, IconKey> = {
  expense: 'kharcha',
  income: 'aamdani',
  material: 'material',
  attendance: 'dehari',
  payWorker: 'dehari',
  udhaarGive: 'ledger',
  udhaarReturn: 'ledger',
  transfer: 'netFlow',
  createWorker: 'dehari',
  createParty: 'investor',
  createInvestor: 'investor',
  createAccount: 'bank',
  createPlot: 'plot',
  createProject: 'project',
  createPurchaseOrder: 'truck',
  receiveDelivery: 'truck',
  payPurchaseOrder: 'material',
  plotPayment: 'plot',
  plotExpense: 'plot',
  setSale: 'tag',
  saleReceipt: 'aamdani',
  saleCost: 'kharcha',
  investorPayment: 'investor',
  markTransferred: 'transfer',
};

type Picker = 'account' | 'project' | 'participation' | 'plot';

/**
 * The inline approval card — the assistant's "I'm about to do this, OK?"
 * bubble. Shows what will be written, asks for anything the sentence left
 * out (name, amount, account, project, plot, which wages) right here, and
 * ends with Reject · Accept. Accept saves through the same repository guards
 * the forms use; nothing is written before that.
 */
export function DraftCard({ resolved, settled, onSettled, onDone }: DraftCardProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(theme);
  const { saving, run } = useSaveAction();
  const lastAccountId = useEntryStore((s) => s.lastAccountId);
  const lastProjectId = useEntryStore((s) => s.lastProjectId);

  const d = resolved.draft;
  const needs = useMemo(() => draftNeeds(resolved), [resolved]);
  const fields = useMemo(() => draftFields(resolved, t), [resolved, t]);
  const amount = draftAmount(resolved);
  const isCreate = CREATE_KINDS.has(d.kind);
  const blocked = resolved.issues.length > 0;

  const [applied, setApplied] = useState<Applied | null>(settled?.status === 'accepted' ? { message: settled.message ?? '' } : null);
  const [rejected, setRejected] = useState(settled?.status === 'rejected');
  /** Why the last Accept failed, shown inside the card instead of a generic alert. */
  const [failed, setFailed] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [plots, setPlots] = useState<PlotRow[]>([]);
  const [parts, setParts] = useState<LaborerProjectParticipation[]>([]);
  const [amountTyped, setAmountTyped] = useState(0);
  const [nameTyped, setNameTyped] = useState('');
  const [wageTyped, setWageTyped] = useState(0);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [plotId, setPlotId] = useState<string | null>(null);
  const [plId, setPlId] = useState<string | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);

  // Load only what this draft still needs; default to last-used / the only option.
  useEffect(() => {
    if (applied || rejected) return;
    if (needs.account) {
      listAccountsWithBalance()
        .then((rows) => {
          setAccounts(rows);
          setAccountId((cur) => cur ?? (rows.some((a) => a.id === lastAccountId) ? lastAccountId : rows[0]?.id ?? null));
        })
        .catch(swallow('draft:accounts'));
    }
    if (needs.plot || blocked) {
      listPlots()
        .then((rows) => setPlots(rows.filter((p) => !p.project_id && p.status !== 'SOLD')))
        .catch(swallow('draft:plots'));
    }
    if (needs.project || needs.workerProject) {
      listProjects()
        .then((rows) => {
          const active = rows.filter((p) => p.status === 'ACTIVE');
          setProjects(active);
          if (needs.project) setProjectId((cur) => cur ?? (active.some((p) => p.id === lastProjectId) ? lastProjectId : active.length === 1 ? active[0].id : null));
        })
        .catch(swallow('draft:projects'));
    }
    if (needs.participation && resolved.worker) {
      getLaborerKhata(resolved.worker.id)
        .then((k) => {
          const owed = k.participations.filter((p) => p.balance.balance > 0);
          setParts(owed);
          setPlId((cur) => cur ?? (owed.length === 1 ? owed[0].projectLaborer.id : null));
        })
        .catch(swallow('draft:khata'));
    }
  }, [needs, blocked, resolved.worker, lastAccountId, lastProjectId, applied, rejected]);

  const account = accounts.find((a) => a.id === accountId);
  const project = projects.find((p) => p.id === projectId);
  const plot = plots.find((p) => p.id === plotId);
  const part = parts.find((p) => p.projectLaborer.id === plId);
  // A taken plot can be swapped for a free one right here.
  const plotFixed = blocked ? !!plotId : true;
  const ready =
    plotFixed &&
    (!needs.name || nameTyped.trim().length > 0) &&
    (!needs.amount || amountTyped > 0) &&
    (!needs.account || !!accountId) &&
    (!needs.project || !!projectId) &&
    (!needs.participation || !!plId) &&
    !(d.kind === 'payWorker' && !resolved.worker);

  const accept = () => {
    setFailed(null);
    void run(async () => {
      const choices: DraftChoices = { amount: amountTyped || null, name: nameTyped.trim() || null, wage: wageTyped || null, plotId, accountId, projectId, projectLaborerId: plId };
      const target = blocked && plotId ? { ...resolved, plot: { id: plotId, name: plot?.name ?? '' }, issues: [] } : resolved;
      try {
        const a = await applyDraft(target, choices);
        setApplied(a);
        onSettled?.('accepted', a.message);
        onDone?.(a.message);
      } catch (e) {
        // Repository guards throw readable reasons ("No sale is set for this
        // project yet"). Keep them in the card, where the user is looking.
        setFailed(e instanceof Error && e.message ? e.message : t('errorBody'));
      }
    });
  };

  const editInstead =
    d.kind === 'expense' || d.kind === 'income'
      ? () => {
          const p = draftToEntryPrefill(resolved);
          if (p) navigation.navigate('Entry', p);
        }
      : d.kind === 'material'
        ? () => {
            const p = draftToMaterialPrefill(resolved);
            if (p) navigation.navigate('MaterialEntry', { prefill: p });
          }
        : undefined;

  const pickerOptions: SelectOption[] =
    picker === 'account'
      ? accounts.map((a) => ({ id: a.id, label: a.name, subtitle: formatRupees(a.balance), icon: (a.type === 'BANK' ? 'bank' : 'balance') as IconKey }))
      : picker === 'project'
        ? projects.map((p) => ({ id: p.id, label: p.name, icon: 'project' as IconKey }))
        : picker === 'plot'
          ? plots.map((p) => ({ id: p.id, label: p.name, subtitle: formatRupees(p.deal_price), icon: 'plot' as IconKey }))
          : parts.map((p) => ({ id: p.projectLaborer.id, label: p.projectName, subtitle: formatRupees(p.balance.balance), icon: 'project' as IconKey }));

  const pickRow = (label: string, value: string | undefined, which: Picker, optional = false) => (
    <Pressable key={which} onPress={() => setPicker(which)} accessibilityRole="button" style={[styles.row, styles.rowRuled]}>
      <AppText size="xs" color="textSecondary" numberOfLines={1} style={styles.label}>
        {label}
      </AppText>
      <AppText size="sm" weight="semibold" color={value ? 'accent' : optional ? 'textSecondary' : 'accent'} numberOfLines={2} style={styles.value}>
        {value ?? (optional ? t('optional') : t('selectOne'))}
      </AppText>
    </Pressable>
  );

  const done = applied || rejected;
  // A free-text party on an expense / income / material is stored by name; only true misses warn.
  const freeParty = (d.kind === 'expense' || d.kind === 'income' || d.kind === 'material') && !resolved.party ? d.party : undefined;
  const unresolvedShown = resolved.unresolved.filter((n) => n !== freeParty);

  return (
    <View style={[styles.card, done && styles.cardDone]}>
      <View style={styles.head}>
        <View style={[styles.iconChip, applied && styles.iconChipDone, rejected && styles.iconChipMuted]}>
          <AppIcon name={applied ? 'checkCircle' : rejected ? 'close' : ICON[d.kind] ?? 'assistant'} size={16} color={applied ? 'success' : rejected ? 'textSecondary' : 'accent'} />
        </View>
        <View style={styles.headText}>
          <AppText size="sm" weight="bold" numberOfLines={1}>
            {draftTitle(resolved, t)}
          </AppText>
          {done ? (
            <View style={[styles.statusPill, rejected && styles.statusPillMuted]}>
              <AppIcon name={applied ? 'check' : 'close'} size={11} color={applied ? 'success' : 'textSecondary'} />
              <AppText size="xs" weight="bold" color={applied ? 'success' : 'textSecondary'} numberOfLines={1}>
                {applied ? t('aiSaved') : t('aiRejected')}
              </AppText>
            </View>
          ) : (
            <AppText size="xs" color="textSecondary" numberOfLines={1}>
              {blocked ? t('aiPlotTaken') : ready ? (isCreate ? t('aiReadyToAdd') : t('aiWillWrite')) : t('aiFillMissing')}
            </AppText>
          )}
        </View>
        {amount != null ? (
          <AppText size="lg" weight="bold" tabular numberOfLines={1} adjustsFontSizeToFit style={styles.headAmount}>
            {formatRupees(amount)}
          </AppText>
        ) : null}
      </View>

      <View style={[styles.panel, done && styles.panelDone]}>
        {fields.map((f, i) => (
          <View key={`${f.label}-${i}`} style={[styles.row, i > 0 && styles.rowRuled]}>
            <AppText size="xs" color="textSecondary" style={styles.label} numberOfLines={1}>
              {f.label}
            </AppText>
            <AppText size="sm" weight={f.money ? 'bold' : 'semibold'} tabular={f.money} color={f.unresolved ? 'gold' : 'textPrimary'} numberOfLines={2} style={styles.value}>
              {f.value}
            </AppText>
            {f.unresolved ? <AppIcon name="alert" size={14} color="gold" /> : null}
          </View>
        ))}
        {!done ? (
          <>
            {needs.account ? pickRow(t('accountLabel'), account ? `${account.name} · ${formatRupees(account.balance)}` : undefined, 'account') : null}
            {needs.project ? pickRow(t('projectLabel'), project?.name, 'project') : null}
            {needs.participation ? pickRow(t('aiChooseParticipation'), part ? `${part.projectName} · ${formatRupees(part.balance.balance)}` : undefined, 'participation') : null}
            {needs.plot || blocked ? pickRow(t('plotLabel'), plot?.name, 'plot', !blocked) : null}
            {needs.workerProject ? pickRow(t('projectLabel'), project?.name, 'project', true) : null}
          </>
        ) : null}
      </View>

      {!done ? (
        <>

          {needs.name || needs.amount || (needs.workerProject && d.kind === 'createWorker' && !d.wage) ? (
            <View style={styles.inputs}>
              {needs.name ? <FloatingLabelInput label={t('name')} value={nameTyped} onChangeText={setNameTyped} /> : null}
              {needs.amount ? <AmountInput label={t('amount')} value={amountTyped} onChange={setAmountTyped} floating surface={theme.colors.card} /> : null}
              {needs.workerProject && d.kind === 'createWorker' && !d.wage ? (
                <AmountInput label={t('aiWage')} value={wageTyped} onChange={setWageTyped} floating surface={theme.colors.card} />
              ) : null}
            </View>
          ) : null}

          {failed ? (
            <View style={styles.warn}>
              <AppIcon name="alert" size={14} color="danger" />
              <AppText size="xs" weight="semibold" color="danger" style={styles.warnText}>
                {failed}
              </AppText>
            </View>
          ) : null}

          {blocked ? (
            <View style={styles.warn}>
              <AppIcon name="alert" size={14} color="gold" />
              <AppText size="xs" weight="semibold" color="gold" style={styles.warnText}>
                {t('aiPlotTaken')}
              </AppText>
            </View>
          ) : unresolvedShown.length > 0 ? (
            <View style={styles.warn}>
              <AppIcon name="alert" size={14} color="gold" />
              <AppText size="xs" weight="semibold" color="gold" style={styles.warnText}>
                {t('aiUnresolved')} {unresolvedShown.join(', ')}
              </AppText>
            </View>
          ) : d.kind === 'payWorker' && !resolved.worker ? (
            <View style={styles.warn}>
              <AppIcon name="alert" size={14} color="gold" />
              <AppText size="xs" weight="semibold" color="gold" style={styles.warnText}>
                {t('aiNoWorkerFound')}
              </AppText>
            </View>
          ) : needs.participation && resolved.worker && parts.length === 0 ? (
            <View style={styles.warn}>
              <AppIcon name="alert" size={14} color="gold" />
              <AppText size="xs" weight="semibold" color="gold" style={styles.warnText}>
                {t('aiNothingOwed')}
              </AppText>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                setRejected(true);
                onSettled?.('rejected');
              }}
              disabled={saving} accessibilityRole="button" style={({ pressed }) => [styles.btn, styles.btnReject, pressed && styles.pressed]}>
              <AppText size="xs" weight="bold" color="textSecondary">
                {t('aiReject')}
              </AppText>
            </Pressable>
            <Pressable
              onPress={accept}
              disabled={!ready || saving}
              accessibilityRole="button"
              style={({ pressed }) => [styles.btn, ready ? styles.btnAccept : styles.btnAcceptDisabled, pressed && styles.pressed]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={theme.colors.onAccent} />
              ) : (
                <>
                  <AppIcon name="check" size={14} color={ready ? 'onAccent' : 'textSecondary'} />
                  <AppText size="xs" weight="bold" color={ready ? 'onAccent' : 'textSecondary'}>
                    {isCreate ? t('aiAddLabel') : t('aiAccept')}
                  </AppText>
                </>
              )}
            </Pressable>
          </View>
          {editInstead ? (
            <Pressable onPress={editInstead} accessibilityRole="button" style={styles.editLink}>
              <AppText size="xs" weight="semibold" color="textSecondary">
                {t('aiEditInstead')}
              </AppText>
            </Pressable>
          ) : null}
        </>
      ) : applied?.target ? (
        <Pressable onPress={() => navigateToTarget(navigation, applied.target!)} accessibilityRole="button" style={styles.doneRow}>
          <AppText size="xs" color="textSecondary" numberOfLines={1} style={styles.doneText}>
            {applied.message}
          </AppText>
          <AppText size="sm" weight="bold" color="accent">
            {t('aiView')}
          </AppText>
          <AppIcon name="forward" size={14} color="accent" />
        </Pressable>
      ) : (
        <View style={styles.panelGap} />
      )}

      <SelectSheet
        visible={picker !== null}
        onClose={() => setPicker(null)}
        title={picker === 'account' ? t('aiChooseAccount') : picker === 'project' ? t('aiChooseProject') : picker === 'plot' ? t('plotsTitle') : t('aiChooseParticipation')}
        searchable={picker === 'plot'}
        options={pickerOptions}
        selectedId={(picker === 'account' ? accountId : picker === 'project' ? projectId : picker === 'plot' ? plotId : plId) ?? undefined}
        onSelect={(o) => {
          if (picker === 'account') setAccountId(o.id);
          else if (picker === 'project') setProjectId(o.id);
          else if (picker === 'plot') setPlotId(o.id);
          else setPlId(o.id);
          setPicker(null);
        }}
      />
    </View>
  );
}
