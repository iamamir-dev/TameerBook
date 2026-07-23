import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';

import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import { AppButton, AppHeader, AppText, ContactRow, LoadErrorState, StickyFooter } from '@/components/ui';
import {
  getTransaction,
  markAttendance,
  type AttendanceStatus,
  type LaborerKhataEntry,
  type LaborerProjectParticipation,
  type TransactionRow,
} from '@/db';
import { swallow } from '@/utils/log';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { todayISO } from '@/utils/date';

import { AttachProjectSheet } from '../components/AttachProjectSheet';
import { AttendanceCalendarSheet } from '../components/AttendanceCalendarSheet';
import { EditWageSheet } from '../components/EditWageSheet';
import { KhataHero } from '../components/KhataHero';
import { KhataHistoryList } from '../components/KhataHistoryList';
import { ParticipationCard } from '../components/ParticipationCard';
import { PayWorkerSheet } from '../components/PayWorkerSheet';
import { useKhataStatement } from '../hooks/useKhataStatement';
import { useLaborerKhata } from '../hooks/useLaborerKhata';
import { makeStyles } from '../styled/LaborerDetailScreen.styles';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type DetailRoute = RouteProp<RootStackParamList, 'LaborerDetail'>;

/**
 * Worker khata — everything about one worker: balance hero, per-project cards
 * (mark today, open the calendar, change the dihari), unified history, pay, and
 * attach to another project. Thin: data via `useLaborerKhata`, PDF via
 * `useKhataStatement`. Marking is optimistic (instant pill).
 */
export function LaborerDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { laborerId } = useRoute<DetailRoute>().params;
  const styles = makeStyles(theme);

  const { data, loadFailed, reload } = useLaborerKhata(laborerId);
  const { khata, accounts, projects } = data;
  const { run: runSave } = useSaveAction();
  const statement = useKhataStatement(khata);

  const [payOpen, setPayOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [wageFor, setWageFor] = useState<LaborerProjectParticipation | null>(null);
  const [calendarFor, setCalendarFor] = useState<LaborerProjectParticipation | null>(null);
  const [detailTxn, setDetailTxn] = useState<TransactionRow | null>(null);
  const [editPayment, setEditPayment] = useState<TransactionRow | null>(null);
  // Optimistic today-status overlay per participation (instant pill feedback).
  const [optimistic, setOptimistic] = useState<Record<string, AttendanceStatus>>({});
  const [savingPlId, setSavingPlId] = useState<string | null>(null);

  const canPay = (khata?.participations ?? []).some((p) => p.balance.balance > 0);

  // History grouped by project (each already date+time sorted by the query);
  // projects appear in order of their most recent activity.
  const historyGroups = useMemo(() => {
    const map = new Map<string, { plId: string; name: string; entries: LaborerKhataEntry[] }>();
    for (const e of khata?.history ?? []) {
      const g = map.get(e.projectLaborerId) ?? { plId: e.projectLaborerId, name: e.projectName, entries: [] };
      g.entries.push(e);
      map.set(e.projectLaborerId, g);
    }
    return [...map.values()];
  }, [khata]);

  const attachableProjects = useMemo(() => {
    const attached = new Set(
      (khata?.participations ?? [])
        .filter((p) => p.projectLaborer.status === 'ACTIVE')
        .map((p) => p.projectLaborer.project_id)
    );
    return projects.filter((p) => p.status === 'ACTIVE' && !attached.has(p.id));
  }, [projects, khata]);

  // Tap a history row: a payment opens the shared detail sheet (→ Edit), an
  // attendance row opens that project's calendar to re-mark the day.
  const onSelectHistory = (e: LaborerKhataEntry) => {
    if (e.kind === 'PAYMENT' && e.txnId) {
      void getTransaction(e.txnId)
        .then((txn) => txn && setDetailTxn(txn))
        .catch(swallow('labor:txn'));
      return;
    }
    const p = (khata?.participations ?? []).find((x) => x.projectLaborer.id === e.projectLaborerId);
    if (p) setCalendarFor(p);
  };

  const onMarkAttendance = (p: LaborerProjectParticipation, status: AttendanceStatus) => {
    const plId = p.projectLaborer.id;
    setOptimistic((m) => ({ ...m, [plId]: status })); // instant feedback
    void (async () => {
      setSavingPlId(plId);
      try {
        const ok = await runSave(async () => {
          await markAttendance({ projectLaborerId: plId, date: todayISO().slice(0, 10), status });
        });
        if (ok) await reload();
      } finally {
        setSavingPlId(null);
        // Drop the overlay: reloaded data now carries the real status (or the
        // write was blocked and we revert to it).
        setOptimistic((m) => {
          const { [plId]: _drop, ...rest } = m;
          return rest;
        });
      }
    })();
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        title={khata?.laborer.name ?? t('workerKhata')}
        subtitle={t('workerKhata')}
        onBack={() => navigation.goBack()}
        rightAction={
          attachableProjects.length > 0
            ? { icon: 'add', onPress: () => setAttachOpen(true), accessibilityLabel: t('includeInProject') }
            : undefined
        }
      />

      {loadFailed && !khata ? (
        <LoadErrorState onRetry={reload} />
      ) : khata ? (
        <ScrollView
          style={styles.flex}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: theme.spacing.xl }]}
        >
          <KhataHero earned={khata.totals.earned} taken={khata.totals.taken} balance={khata.totals.balance} />

          <View style={styles.identityRow}>
            {khata.laborer.photo_uri ? <Image source={{ uri: khata.laborer.photo_uri }} style={styles.workerAvatar} /> : null}
            <View style={styles.flexGrow}>
              <ContactRow phone={khata.laborer.phone} cnic={khata.laborer.cnic} />
            </View>
          </View>

          {khata.participations.length > 0 ? (
            <AppText size="lg" weight="bold">
              {t('projects')}
            </AppText>
          ) : null}
          {khata.participations.map((p) => (
            <ParticipationCard
              key={p.projectLaborer.id}
              participation={{ ...p, todayStatus: optimistic[p.projectLaborer.id] ?? p.todayStatus }}
              saving={savingPlId === p.projectLaborer.id}
              onMarkAttendance={(status) => onMarkAttendance(p, status)}
              onEditWage={() => setWageFor(p)}
              onOpenCalendar={() => setCalendarFor(p)}
            />
          ))}

          {khata.history.length > 0 ? (
            <AppText size="lg" weight="bold">
              {t('historyTitle')}
            </AppText>
          ) : null}
          {historyGroups.map((g) => (
            <View key={g.plId} style={styles.historyGroup}>
              <AppText size="md" weight="bold" color="accent" numberOfLines={1}>
                {g.name}
              </AppText>
              <KhataHistoryList history={g.entries} hideTitle hideProject onSelect={onSelectHistory} />
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.flex} />
      )}

      <StickyFooter>
        <View style={styles.footerRow}>
          <AppButton
            label={t('printLabel')}
            icon="print"
            variant="secondary"
            fullWidth={false}
            loading={statement.busy}
            disabled={!khata}
            onPress={statement.preview}
          />
          <View style={styles.flex}>
            <AppButton label={t('payWorker')} icon="moneyOut" onPress={() => setPayOpen(true)} disabled={!canPay} />
          </View>
        </View>
      </StickyFooter>

      <PayWorkerSheet
        visible={payOpen || !!editPayment}
        onClose={() => {
          setPayOpen(false);
          setEditPayment(null);
        }}
        participations={khata?.participations ?? []}
        accounts={accounts}
        editing={editPayment}
        onSaved={reload}
      />

      {/* Payment detail (shared sheet) → Edit reopens PayWorkerSheet in edit mode. */}
      <TransactionDetailSheet
        txn={detailTxn}
        onClose={() => setDetailTxn(null)}
        footer={
          detailTxn ? (
            <AppButton
              label={t('edit')}
              icon="edit"
              variant="secondary"
              onPress={() => {
                const txn = detailTxn;
                setDetailTxn(null);
                setEditPayment(txn);
              }}
            />
          ) : undefined
        }
      />

      <AttachProjectSheet
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        laborerId={laborerId}
        projects={attachableProjects}
        onSaved={reload}
      />

      <EditWageSheet
        visible={wageFor !== null}
        onClose={() => setWageFor(null)}
        projectLaborerId={wageFor?.projectLaborer.id ?? null}
        projectName={wageFor?.projectName ?? ''}
        currentWage={wageFor?.projectLaborer.daily_wage ?? 0}
        onSaved={reload}
      />

      <AttendanceCalendarSheet
        visible={calendarFor !== null}
        onClose={() => setCalendarFor(null)}
        projectLaborerId={calendarFor?.projectLaborer.id ?? null}
        projectName={calendarFor?.projectName ?? ''}
        onSaved={reload}
      />
    </View>
  );
}
