import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';

import { AppButton, AppHeader, AppText, ContactRow, LoadErrorState, StickyFooter } from '@/components/ui';
import { markAttendance, type AttendanceStatus, type LaborerProjectParticipation } from '@/db';
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
  // Optimistic today-status overlay per participation (instant pill feedback).
  const [optimistic, setOptimistic] = useState<Record<string, AttendanceStatus>>({});
  const [savingPlId, setSavingPlId] = useState<string | null>(null);

  const canPay = (khata?.participations ?? []).some((p) => p.balance.balance > 0);

  const attachableProjects = useMemo(() => {
    const attached = new Set(
      (khata?.participations ?? [])
        .filter((p) => p.projectLaborer.status === 'ACTIVE')
        .map((p) => p.projectLaborer.project_id)
    );
    return projects.filter((p) => p.status === 'ACTIVE' && !attached.has(p.id));
  }, [projects, khata]);

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

          <KhataHistoryList history={khata.history} />
        </ScrollView>
      ) : (
        <View style={styles.flex} />
      )}

      <StickyFooter>
        <View style={styles.footerRow}>
          <AppButton
            label={t('statement')}
            icon="statement"
            variant="secondary"
            fullWidth={false}
            loading={statement.busy}
            disabled={!khata}
            onPress={statement.share}
          />
          <View style={styles.flex}>
            <AppButton label={t('payWorker')} icon="moneyOut" onPress={() => setPayOpen(true)} disabled={!canPay} />
          </View>
        </View>
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
