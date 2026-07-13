import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AttachProjectSheet } from '@/components/labor/AttachProjectSheet';
import { AttendanceCalendarSheet } from '@/components/labor/AttendanceCalendarSheet';
import { EditWageSheet } from '@/components/labor/EditWageSheet';
import { KhataHero } from '@/components/labor/KhataHero';
import { KhataHistoryList } from '@/components/labor/KhataHistoryList';
import { ParticipationCard } from '@/components/labor/ParticipationCard';
import { PayWorkerSheet } from '@/components/labor/PayWorkerSheet';
import { AppButton, AppHeader, AppText, StickyFooter } from '@/components/ui';
import {
  getLaborerKhata,
  listAccountsWithBalance,
  listProjects,
  markAttendance,
  type AccountWithBalance,
  type AttendanceStatus,
  type LaborerKhata,
  type LaborerProjectParticipation,
  type ProjectRow,
} from '@/db';
import { useFocusReload, useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { todayISO } from '@/utils/date';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type DetailRoute = RouteProp<RootStackParamList, 'LaborerDetail'>;

/**
 * Worker khata — EVERYTHING about one worker, manageable right here: the
 * balance hero, per-project cards (mark today's attendance, open the month
 * calendar to mark any date, tap the dihari to change it), the unified
 * history, paying wages, and attaching the worker to another project ("+"
 * in the header). A payment always books to one project participation.
 */
export function LaborerDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { laborerId } = useRoute<DetailRoute>().params;
  const styles = makeStyles(theme);

  const [khata, setKhata] = useState<LaborerKhata | null>(null);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [wageFor, setWageFor] = useState<LaborerProjectParticipation | null>(null);
  const [calendarFor, setCalendarFor] = useState<LaborerProjectParticipation | null>(null);
  // Which participation's attendance save is in flight — only THAT card's
  // chips disable, not every card's.
  const [savingPlId, setSavingPlId] = useState<string | null>(null);

  const { run: runSave } = useSaveAction();

  const load = useCallback(async () => {
    const [k, accs, projs] = await Promise.all([
      getLaborerKhata(laborerId),
      listAccountsWithBalance(),
      listProjects(),
    ]);
    setKhata(k);
    setAccounts(accs);
    setProjects(projs);
  }, [laborerId]);

  const { reload } = useFocusReload(load);

  const canPay = (khata?.participations ?? []).some((p) => p.balance.balance > 0);

  // ACTIVE projects the worker is not already actively attached to.
  const attachableProjects = useMemo(() => {
    const attached = new Set(
      (khata?.participations ?? [])
        .filter((p) => p.projectLaborer.status === 'ACTIVE')
        .map((p) => p.projectLaborer.project_id)
    );
    return projects.filter((p) => p.status === 'ACTIVE' && !attached.has(p.id));
  }, [projects, khata]);

  /** Mark today's dihari on one project (one earning day across projects). */
  const onMarkAttendance = (p: LaborerProjectParticipation, status: AttendanceStatus) => {
    void (async () => {
      setSavingPlId(p.projectLaborer.id);
      try {
        const ok = await runSave(async () => {
          await markAttendance({
            projectLaborerId: p.projectLaborer.id,
            date: todayISO().slice(0, 10),
            status,
          });
        });
        if (ok) await reload();
      } finally {
        setSavingPlId(null);
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
            ? {
              icon: 'add',
              onPress: () => setAttachOpen(true),
              accessibilityLabel: t('includeInProject'),
            }
            : undefined
        }
      />

      {khata ? (
        <ScrollView
          style={styles.flex}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: theme.spacing.xl }]}
        >
          <KhataHero
            earned={khata.totals.earned}
            taken={khata.totals.taken}
            balance={khata.totals.balance}
          />

          {/* One card per project participation — attendance, dihari and
              balance all manageable in place. */}
          {khata.participations.length > 0 ? (
            <AppText size="lg" weight="bold">
              {t('projects')}
            </AppText>
          ) : null}
          {khata.participations.map((p) => (
            <ParticipationCard
              key={p.projectLaborer.id}
              participation={p}
              saving={savingPlId === p.projectLaborer.id}
              onMarkAttendance={(status) => onMarkAttendance(p, status)}
              onEditWage={() => setWageFor(p)}
              onOpenCalendar={() => setCalendarFor(p)}
            />
          ))}

          <KhataHistoryList history={khata.history} />
        </ScrollView>
      ) : (
        <View style={styles.flex} />
      )}

      <StickyFooter>
        <AppButton
          label={t('payWorker')}
          icon="moneyOut"
          onPress={() => setPayOpen(true)}
          disabled={!canPay}
        />
      </StickyFooter>

      <PayWorkerSheet
        visible={payOpen}
        onClose={() => setPayOpen(false)}
        participations={khata?.participations ?? []}
        accounts={accounts}
        onSaved={reload}
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

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  });
