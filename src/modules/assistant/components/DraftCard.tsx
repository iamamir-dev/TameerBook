import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { CREATE_KINDS, draftToEntryPrefill, draftToMaterialPrefill, type ResolvedDraft } from '@/ai';
import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { AmountInput, AppIcon, AppText, SelectSheet, type IconKey, type SelectOption } from '@/components/ui';
import {
  SYSTEM_CATEGORY_NAMES,
  getLaborerKhata,
  listAccountsWithBalance,
  listCategories,
  listPlots,
  listProjects,
  type AccountWithBalance,
  type CategoryRow,
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
import { draftAmount, draftDirection, draftFields, draftTitle, type DraftField } from '../utils/draftSummary';
import { navigateToTarget } from '../utils/navigateTarget';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface DraftCardProps {
  /** "Step 2 of 3" when this card is one of several dependent actions from one message. */
  step?: { index: number; total: number };
  resolved: ResolvedDraft;
  /** Restored outcome (the conversation is persisted across restarts). */
  settled?: { status: 'accepted' | 'rejected'; message?: string };
  /** Fires when the user accepts (message = what was saved) or rejects. */
  onSettled?: (status: 'accepted' | 'rejected', message?: string, poId?: string, used?: { account?: string; project?: string }) => void;
  /** Purchase order created or touched by an earlier step in the same message: later steps act on it. */
  poId?: string | null;
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

type Picker = 'account' | 'project' | 'participation' | 'plot' | 'category';

const SYSTEM_CATS = new Set<string>(SYSTEM_CATEGORY_NAMES);

/**
 * The inline approval card — the assistant's "I'm about to do this, OK?"
 * bubble. Shows what will be written, asks for anything the sentence left
 * out (name, amount, account, project, plot, which wages) right here, and
 * ends with Reject · Accept. Accept saves through the same repository guards
 * the forms use; nothing is written before that.
 */
export function DraftCard({ resolved, settled, onSettled, onDone, step, poId: linkedPoId }: DraftCardProps): React.JSX.Element {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(theme);
  const { saving, run } = useSaveAction();
  const lastAccountId = useEntryStore((s) => s.lastAccountId);
  const lastProjectId = useEntryStore((s) => s.lastProjectId);

  const d = resolved.draft;
  const needs = useMemo(() => draftNeeds(resolved), [resolved]);
  const fields = useMemo(() => draftFields(resolved, t), [resolved, t]);
  const amount = draftAmount(resolved);
  // Green tint on an expense read as "money in"; the surface is neutral now and
  // the direction lives on the amount, with a sign so colour is never alone.
  const direction = draftDirection(resolved);
  const isCreate = CREATE_KINDS.has(d.kind);
  const blocked = resolved.issues.length > 0;

  const [applied, setApplied] = useState<Applied | null>(settled?.status === 'accepted' ? { message: settled.message ?? '' } : null);
  const [rejected, setRejected] = useState(settled?.status === 'rejected');
  /** Why the last Accept failed, shown inside the card instead of a generic alert. */
  const [failed, setFailed] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [plots, setPlots] = useState<PlotRow[]>([]);
  const [parts, setParts] = useState<LaborerProjectParticipation[]>([]);
  const [partsLoaded, setPartsLoaded] = useState(false);
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
    // Accounts: to pick one, and to check the balance before money goes OUT.
    if (needs.account || direction === 'out' || d.kind === 'transfer') {
      listAccountsWithBalance()
        .then((rows) => {
          setAccounts(rows);
          setAccountId((cur) => cur ?? (rows.some((a) => a.id === lastAccountId) ? lastAccountId : rows[0]?.id ?? null));
        })
        .catch(swallow('draft:accounts'));
    }
    if (needs.category) {
      // The bookable leaves of this type, the same list the Entry form offers:
      // no system categories (posted by business logic), no headings.
      listCategories(d.kind === 'income' ? 'INCOME' : 'EXPENSE')
        .then((cats) => {
          const parents = new Set(cats.map((c) => c.parent_id).filter(Boolean) as string[]);
          setCategories(cats.filter((c) => !SYSTEM_CATS.has(c.name_en) && !c.is_system && !parents.has(c.id)));
        })
        .catch(swallow('draft:categories'));
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
          setPartsLoaded(true);
          setPlId((cur) => cur ?? (owed.length === 1 ? owed[0].projectLaborer.id : null));
        })
        .catch(swallow('draft:khata'));
    }
  }, [needs, blocked, resolved.worker, resolved.project, lastAccountId, lastProjectId, applied, rejected, direction, d.kind]);

  const account = accounts.find((a) => a.id === accountId);
  const category = categories.find((c) => c.id === categoryId);
  const catName = (c: CategoryRow) => (language === 'ur' ? c.name_ur : c.name_en);
  const project = projects.find((p) => p.id === projectId);
  const plot = plots.find((p) => p.id === plotId);
  const part = parts.find((p) => p.projectLaborer.id === plId);
  /** The draft needs a project but the user has not made one yet. */
  const noProjects = needs.project && projects.length === 0;
  // A free-text party on an expense / income / material is stored by name; only true misses warn.
  const freeParty = (d.kind === 'expense' || d.kind === 'income' || d.kind === 'material') && !resolved.party ? d.party : undefined;
  const unresolvedShown = resolved.unresolved.filter((n) => n !== freeParty);

  /**
   * Everything that must be true before Accept: the same rules the forms and
   * the repositories enforce, checked up front and listed on the card so the
   * user fixes them here instead of hitting a guard. `blocks` = Accept stays
   * off; a plain note (an unknown name the entry will simply keep) does not.
   */
  const finalAmount = amount ?? (amountTyped > 0 ? amountTyped : null);
  const payingFrom = accounts.find((a) => a.id === (resolved.account?.id ?? accountId));
  const lowBalance = (direction === 'out' || d.kind === 'transfer') && payingFrom && finalAmount != null && payingFrom.balance + 0.001 < finalAmount ? payingFrom : null;
  const checks: { text: string; blocks: boolean }[] = [];
  const check = (when: boolean, text: string, blocks = true) => when && checks.push({ text, blocks });
  check(needs.name && nameTyped.trim().length === 0, t('aiNeedName'));
  check(needs.amount && !(amountTyped > 0), t('aiNeedAmount'));
  check(needs.category && !categoryId, t('categoryRequired'));
  check(needs.account && !accountId, t('selectAccount'));
  check(needs.project && !projectId && !noProjects, t('selectProject'));
  check(noProjects, t('aiNoProjectsYet'));
  check(d.kind === 'payWorker' && !resolved.worker, t('aiNoWorkerFound'));
  check(needs.participation && !!resolved.worker && partsLoaded && parts.length === 0, t('aiNothingOwed'));
  check(needs.participation && !!resolved.worker && parts.length > 0 && !plId, t('aiChooseParticipation'));
  check(blocked && !plotId, t('aiPlotTaken'));
  check(!!lowBalance, `${t('insufficientFunds')} ${lowBalance?.name ?? ''} · ${formatRupees(lowBalance?.balance ?? 0)}`);
  check(unresolvedShown.length > 0, `${t('aiUnresolved')} ${unresolvedShown.join(', ')}`, false);
  const blocking = checks.filter((c) => c.blocks).length;
  const ready = blocking === 0;

  const accept = () => {
    setFailed(null);
    void run(async () => {
      const choices: DraftChoices = { amount: amountTyped || null, name: nameTyped.trim() || null, wage: wageTyped || null, plotId, accountId, projectId, categoryId, projectLaborerId: plId, poId: linkedPoId ?? null };
      const target = blocked && plotId ? { ...resolved, plot: { id: plotId, name: plot?.name ?? '' }, issues: [] } : resolved;
      try {
        const a = await applyDraft(target, choices);
        setApplied(a);
        onSettled?.('accepted', a.message, a.target && 'poId' in a.target ? a.target.poId : undefined, {
          account: account?.name ?? resolved.account?.name,
          project: project?.name ?? part?.projectName ?? resolved.project?.name,
        });
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
          : picker === 'category'
            ? categories.map((c) => ({ id: c.id, label: catName(c), icon: (c.icon as IconKey) || ('tag' as IconKey) }))
            : parts.map((p) => ({ id: p.projectLaborer.id, label: p.projectName, subtitle: formatRupees(p.balance.balance), icon: 'project' as IconKey }));

  /** A row the user can change: the value reads as a link, with a chevron; a missing required one reads as a to-do. */
  const pickRow = (label: string, value: string | undefined, which: Picker, optional = false, ruled = true) => (
    <Pressable key={which} onPress={() => setPicker(which)} accessibilityRole="button" style={({ pressed }) => [styles.row, styles.rowTap, ruled && styles.rowRuled, pressed && styles.pressed]}>
      <AppText size="xs" color="textSecondary" numberOfLines={1} style={styles.label}>
        {label}
      </AppText>
      <AppText size="sm" weight="semibold" color={value ? 'accent' : optional ? 'textSecondary' : 'gold'} numberOfLines={2} style={styles.value}>
        {value ?? (optional ? t('optional') : t('selectOne'))}
      </AppText>
      <AppIcon name="forward" size={16} color="textSecondary" />
    </Pressable>
  );

  const done = applied || rejected;
  // A field the card asks for below is not repeated as a spoken-but-unmatched row above it.
  const asked = new Set<string>();
  if (needs.category) asked.add(t('category'));
  if (needs.account) asked.add(t('accountLabel'));
  if (needs.project || needs.workerProject) asked.add(t('projectLabel'));
  if (needs.plot || blocked) asked.add(t('plotLabel'));
  // Once settled, what the user picked in the card is shown like any other field.
  const picked: DraftField[] = done
    ? [
        ...(needs.category && category ? [{ label: t('category'), value: catName(category) }] : []),
        ...((needs.project || needs.workerProject) && project ? [{ label: t('projectLabel'), value: project.name }] : []),
        ...(needs.participation && part ? [{ label: t('projectLabel'), value: part.projectName }] : []),
        ...((needs.plot || blocked) && plot ? [{ label: t('plotLabel'), value: plot.name }] : []),
        ...(needs.account && account ? [{ label: t('accountLabel'), value: account.name }] : []),
      ]
    : [];
  const shownFields = [...fields.filter((f) => !asked.has(f.label)), ...picked];
  const statusText = done
    ? applied
      ? t('aiSaved')
      : t('aiRejected')
    : blocked
      ? t('aiPlotTaken')
      : blocking > 0
        ? `${blocking} ${t('aiToFix')}`
        : isCreate
          ? t('aiReadyToAdd')
          : t('aiReadyToSave');
  const statusColor = applied ? 'success' : done ? 'textSecondary' : blocking > 0 || blocked ? 'gold' : 'textSecondary';

  return (
    <View style={[styles.card, rejected && styles.cardRejected]}>
      <View style={styles.head}>
        <View style={[styles.iconChip, !done && direction === 'out' && styles.iconChipOut, !done && direction === 'in' && styles.iconChipIn, applied && styles.iconChipDone, rejected && styles.iconChipMuted]}>
          <AppIcon name={applied ? 'checkCircle' : rejected ? 'close' : ICON[d.kind] ?? 'assistant'} size={18} color={applied ? 'success' : rejected ? 'textSecondary' : direction === 'out' ? 'danger' : 'accent'} />
        </View>
        <View style={styles.headText}>
          <AppText size="md" weight="bold" numberOfLines={1}>
            {draftTitle(resolved, t)}
          </AppText>
          <AppText size="xs" weight="semibold" color={statusColor} numberOfLines={1}>
            {statusText}
          </AppText>
        </View>
        {step ? (
          <View style={styles.stepPill}>
            <AppText size="xs" weight="bold" color="textSecondary">
              {`${step.index}/${step.total}`}
            </AppText>
          </View>
        ) : null}
      </View>

      {amount != null ? (
        <AppText
          size="xxl"
          weight="bold"
          tabular
          numberOfLines={1}
          adjustsFontSizeToFit
          color={done ? 'textSecondary' : direction === 'in' ? 'success' : direction === 'out' ? 'danger' : 'textPrimary'}
          style={styles.amount}
        >
          {direction === 'in' ? '+ ' : direction === 'out' ? '- ' : ''}
          {formatRupees(amount)}
        </AppText>
      ) : null}

      {shownFields.length > 0 || !done ? (
        <View style={styles.panel}>
          {shownFields.map((f, i) => (
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
              {needs.category ? pickRow(t('category'), category ? catName(category) : undefined, 'category', false, shownFields.length > 0) : null}
              {needs.project && !noProjects ? pickRow(t('projectLabel'), project?.name, 'project') : null}
              {needs.workerProject ? pickRow(t('projectLabel'), project?.name, 'project', true) : null}
              {needs.plot || blocked ? pickRow(t('plotLabel'), plot?.name, 'plot', !blocked) : null}
              {needs.participation && parts.length > 0 ? pickRow(t('projectLabel'), part ? `${part.projectName} · ${formatRupees(part.balance.balance)}` : undefined, 'participation') : null}
              {needs.account ? pickRow(t('accountLabel'), account?.name, 'account') : null}
            </>
          ) : null}
        </View>
      ) : null}

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

          {checks.length > 0 ? (
            <View style={styles.checks}>
              {checks.map((c) => (
                <View key={c.text} style={styles.check}>
                  <AppIcon name="alert" size={14} color="gold" />
                  <AppText size="xs" weight="semibold" color="gold" style={styles.checkText}>
                    {c.text}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}

          {failed ? (
            <View style={styles.warn}>
              <AppIcon name="alert" size={16} color="danger" />
              <AppText size="sm" weight="semibold" color="danger" style={styles.warnText}>
                {failed}
              </AppText>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                setRejected(true);
                onSettled?.('rejected');
              }}
              disabled={saving}
              accessibilityRole="button"
              style={({ pressed }) => [styles.btn, styles.btnReject, pressed && styles.pressed]}
            >
              <AppText size="sm" weight="bold" color="textSecondary">
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
                  <AppIcon name="check" size={16} color={ready ? 'onAccent' : 'textSecondary'} />
                  <AppText size="sm" weight="bold" color={ready ? 'onAccent' : 'textSecondary'}>
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
      ) : null}

      <SelectSheet
        visible={picker !== null}
        onClose={() => setPicker(null)}
        title={picker === 'account' ? t('aiChooseAccount') : picker === 'project' ? t('aiChooseProject') : picker === 'plot' ? t('plotsTitle') : picker === 'category' ? t('category') : t('aiChooseParticipation')}
        searchable={picker === 'plot' || picker === 'category'}
        options={pickerOptions}
        selectedId={(picker === 'account' ? accountId : picker === 'project' ? projectId : picker === 'plot' ? plotId : picker === 'category' ? categoryId : plId) ?? undefined}
        onSelect={(o) => {
          if (picker === 'account') setAccountId(o.id);
          else if (picker === 'project') setProjectId(o.id);
          else if (picker === 'plot') setPlotId(o.id);
          else if (picker === 'category') setCategoryId(o.id);
          else setPlId(o.id);
          setPicker(null);
        }}
      />
    </View>
  );
}
