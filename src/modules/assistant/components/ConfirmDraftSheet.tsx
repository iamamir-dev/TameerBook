import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { CREATE_KINDS, type ResolvedDraft } from '@/ai';
import { AmountInput, AppButton, AppIcon, AppSheet, AppText, SelectSheet, type IconKey, type SelectOption } from '@/components/ui';
import {
  getLaborerKhata,
  listAccountsWithBalance,
  listProjects,
  type AccountWithBalance,
  type LaborerProjectParticipation,
  type ProjectRow,
} from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useEntryStore } from '@/stores/useEntryStore';
import { useTheme } from '@/theme';
import { swallow } from '@/utils/log';
import { formatRupees } from '@/utils/money';

import { makeStyles } from '../styled/ConfirmDraftSheet.styles';
import { applyDraft, draftNeeds, type Applied, type DraftChoices } from '../utils/applyDraft';
import { draftAmount, draftFields, draftTitle } from '../utils/draftSummary';

interface ConfirmDraftSheetProps {
  visible: boolean;
  resolved: ResolvedDraft;
  onClose: () => void;
  /** The write landed. */
  onSaved: (applied: Applied) => void;
  /** Money drafts only: open the manual form instead. */
  onEditInstead?: () => void;
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
};

/**
 * The permission step. Shows exactly what will be written — amount, every
 * matched name, the date — lets the user pick anything the sentence left out
 * (account, project, which wages), and only then saves through the same
 * repository guards the forms use.
 */
export function ConfirmDraftSheet({ visible, resolved, onClose, onSaved, onEditInstead }: ConfirmDraftSheetProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { saving, run } = useSaveAction();
  const lastAccountId = useEntryStore((s) => s.lastAccountId);
  const lastProjectId = useEntryStore((s) => s.lastProjectId);

  const d = resolved.draft;
  const needs = useMemo(() => draftNeeds(resolved), [resolved]);
  const fields = useMemo(() => draftFields(resolved, t), [resolved, t]);
  const amount = draftAmount(resolved);
  const isCreate = CREATE_KINDS.has(d.kind);

  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [parts, setParts] = useState<LaborerProjectParticipation[]>([]);
  const [amountTyped, setAmountTyped] = useState(0);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [plId, setPlId] = useState<string | null>(null);
  const [picker, setPicker] = useState<'account' | 'project' | 'participation' | null>(null);

  // Load only what this draft still needs; default to last-used / the only option.
  useEffect(() => {
    if (!visible) return;
    if (needs.account) {
      listAccountsWithBalance()
        .then((rows) => {
          setAccounts(rows);
          setAccountId((cur) => cur ?? (rows.some((a) => a.id === lastAccountId) ? lastAccountId : rows[0]?.id ?? null));
        })
        .catch(swallow('confirm:accounts'));
    }
    if (needs.project) {
      listProjects()
        .then((rows) => {
          const active = rows.filter((p) => p.status === 'ACTIVE');
          setProjects(active);
          setProjectId((cur) => cur ?? (active.some((p) => p.id === lastProjectId) ? lastProjectId : active.length === 1 ? active[0].id : null));
        })
        .catch(swallow('confirm:projects'));
    }
    if (needs.participation && resolved.worker) {
      getLaborerKhata(resolved.worker.id)
        .then((k) => {
          const owed = k.participations.filter((p) => p.balance.balance > 0);
          setParts(owed);
          setPlId((cur) => cur ?? (owed.length === 1 ? owed[0].projectLaborer.id : null));
        })
        .catch(swallow('confirm:khata'));
    }
  }, [visible, needs, resolved.worker, lastAccountId, lastProjectId]);

  const account = accounts.find((a) => a.id === accountId);
  const project = projects.find((p) => p.id === projectId);
  const part = parts.find((p) => p.projectLaborer.id === plId);
  const ready =
    (!needs.amount || amountTyped > 0) &&
    (!needs.account || !!accountId) &&
    (!needs.project || !!projectId) &&
    (!needs.participation || !!plId) &&
    !(d.kind === 'payWorker' && !resolved.worker);

  const confirm = () => {
    void run(async () => {
      const choices: DraftChoices = { amount: amountTyped || null, accountId, projectId, projectLaborerId: plId };
      const applied = await applyDraft(resolved, choices);
      onSaved(applied);
    }).then((ok) => ok && onClose());
  };

  const pickerOptions: SelectOption[] =
    picker === 'account'
      ? accounts.map((a) => ({ id: a.id, label: a.name, subtitle: formatRupees(a.balance), icon: (a.type === 'BANK' ? 'bank' : 'balance') as IconKey }))
      : picker === 'project'
        ? projects.map((p) => ({ id: p.id, label: p.name, icon: 'project' as IconKey }))
        : parts.map((p) => ({ id: p.projectLaborer.id, label: p.projectName, subtitle: formatRupees(p.balance.balance), icon: 'project' as IconKey }));

  const pickRow = (label: string, value: string | undefined, which: 'account' | 'project' | 'participation', ruled: boolean) => (
    <Pressable
      key={which}
      onPress={() => setPicker(which)}
      accessibilityRole="button"
      style={[styles.row, ruled && styles.ruled, !value && styles.pick]}
    >
      <AppText size="sm" color="textSecondary" style={styles.label}>
        {label}
      </AppText>
      <AppText size="sm" weight="bold" color={value ? 'textPrimary' : 'accent'} numberOfLines={1} style={styles.value}>
        {value ?? t('selectOne')}
      </AppText>
      <AppIcon name="forward" size={16} color="textSecondary" />
    </Pressable>
  );

  return (
    <>
      <AppSheet
        visible={visible}
        onClose={onClose}
        title={t('aiConfirmTitle')}
        footer={
          <View style={styles.footer}>
            <AppButton label={isCreate ? t('aiAddLabel') : t('aiSaveLabel')} icon="check" onPress={confirm} loading={saving} disabled={!ready} />
            {onEditInstead ? (
              <Pressable onPress={onEditInstead} accessibilityRole="button" style={styles.link}>
                <AppText size="sm" weight="semibold" color="textSecondary">
                  {t('aiEditInstead')}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        }
      >
        <View style={styles.body}>
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <AppIcon name={ICON[d.kind] ?? 'assistant'} size={24} color="accent" />
            </View>
            <AppText size="sm" weight="semibold" color="textSecondary">
              {draftTitle(resolved, t)}
            </AppText>
            {amount != null ? (
              <AppText size="xxl" weight="bold" tabular numberOfLines={1} adjustsFontSizeToFit>
                {formatRupees(amount)}
              </AppText>
            ) : !needs.amount ? (
              <AppText size="xl" weight="bold" numberOfLines={2} center>
                {'name' in d ? d.name : ''}
              </AppText>
            ) : null}
          </View>

          {/* The sentence had no amount: ask for it here, keyboard-first. */}
          {needs.amount ? <AmountInput label={t('amount')} value={amountTyped} onChange={setAmountTyped} autoFocus floating surface={theme.colors.card} /> : null}

          <View style={styles.card}>
            {fields.map((f, i) => (
              <View key={`${f.label}-${i}`} style={[styles.row, i > 0 && styles.ruled]}>
                <AppText size="sm" color="textSecondary" style={styles.label}>
                  {f.label}
                </AppText>
                <AppText size="sm" weight={f.money ? 'bold' : 'semibold'} tabular={f.money} color={f.unresolved ? 'gold' : 'textPrimary'} numberOfLines={2} style={styles.value}>
                  {f.value}
                </AppText>
                {f.unresolved ? <AppIcon name="alert" size={14} color="gold" /> : null}
              </View>
            ))}
            {needs.account ? pickRow(t('accountsTitle'), account ? `${account.name} · ${formatRupees(account.balance)}` : undefined, 'account', fields.length > 0) : null}
            {needs.project ? pickRow(t('projectLabel'), project?.name, 'project', true) : null}
            {needs.participation ? pickRow(t('aiChooseParticipation'), part ? `${part.projectName} · ${formatRupees(part.balance.balance)}` : undefined, 'participation', true) : null}
          </View>

          {d.kind === 'payWorker' && !resolved.worker ? (
            <View style={styles.warn}>
              <AppIcon name="alert" size={16} color="gold" />
              <AppText size="xs" weight="semibold" color="gold" style={styles.warnText}>
                {t('aiNoWorkerFound')}
              </AppText>
            </View>
          ) : needs.participation && resolved.worker && parts.length === 0 ? (
            <View style={styles.warn}>
              <AppIcon name="alert" size={16} color="gold" />
              <AppText size="xs" weight="semibold" color="gold" style={styles.warnText}>
                {t('aiNothingOwed')}
              </AppText>
            </View>
          ) : null}

          <AppText size="xs" color="textSecondary" center>
            {t('aiWillWrite')}
          </AppText>
        </View>
      </AppSheet>

      <SelectSheet
        visible={picker !== null}
        onClose={() => setPicker(null)}
        title={picker === 'account' ? t('aiChooseAccount') : picker === 'project' ? t('aiChooseProject') : t('aiChooseParticipation')}
        searchable={false}
        options={pickerOptions}
        selectedId={(picker === 'account' ? accountId : picker === 'project' ? projectId : plId) ?? undefined}
        onSelect={(o) => {
          if (picker === 'account') setAccountId(o.id);
          else if (picker === 'project') setProjectId(o.id);
          else setPlId(o.id);
          setPicker(null);
        }}
      />
    </>
  );
}
