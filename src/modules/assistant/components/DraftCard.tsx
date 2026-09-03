import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';

import { draftToEntryPrefill, draftToMaterialPrefill, type ResolvedDraft } from '@/ai';
import { AppButton, AppIcon, AppText, SelectSheet, type IconKey } from '@/components/ui';
import {
  listProjectLaborers,
  listProjects,
  listUdhaar,
  markAllPresentForProject,
  markAttendance,
  type ProjectRow,
} from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { todayISO } from '@/utils/date';
import { swallow } from '@/utils/log';

import { makeStyles } from '../styled/DraftCard.styles';
import { draftSummary } from '../utils/draftSummary';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface DraftCardProps {
  resolved: ResolvedDraft;
  /** Toast after attendance lands. */
  onDone?: (message: string) => void;
}

/**
 * "Here is what I understood" — the draft the model extracted, with every
 * name already matched to the user's own data, and ONE action that lands on
 * the existing confirm screen. Attendance is the one draft applied from here,
 * and only after an explicit confirmation dialog.
 */
export function DraftCard({ resolved, onDone }: DraftCardProps): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(theme);
  const { saving, run } = useSaveAction();
  const [projectPick, setProjectPick] = useState<ProjectRow[] | null>(null);
  const [applied, setApplied] = useState(false);

  const d = resolved.draft;
  const { title, line } = draftSummary(resolved, t);

  const markAttendanceFor = (projectId: string) => {
    const date = d.kind === 'attendance' && d.date ? d.date : todayISO().slice(0, 10);
    Alert.alert(t('aiMarkAttendance'), line, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('confirm'),
        onPress: () => {
          void run(async () => {
            if (d.kind !== 'attendance') return;
            let n = 0;
            if (d.allPresent) n += await markAllPresentForProject(projectId, date);
            const pls = await listProjectLaborers(projectId);
            for (const m of resolved.marks) {
              if (!m.worker) continue;
              const pl = pls.find((p) => p.laborer.id === m.worker!.id);
              if (!pl) continue;
              await markAttendance({ projectLaborerId: pl.projectLaborer.id, date, status: m.mark.status });
              n++;
            }
            setApplied(true);
            onDone?.(`${n} · ${t('aiAttendanceDone')}`);
          });
        },
      },
    ]);
  };

  const act = () => {
    switch (d.kind) {
      case 'expense':
      case 'income': {
        const p = draftToEntryPrefill(resolved);
        if (p) navigation.navigate('Entry', p);
        return;
      }
      case 'material': {
        const p = draftToMaterialPrefill(resolved);
        if (p) navigation.navigate('MaterialEntry', { prefill: p });
        return;
      }
      case 'attendance': {
        if (resolved.project) {
          markAttendanceFor(resolved.project.id);
          return;
        }
        listProjects()
          .then((rows) => {
            const active = rows.filter((p) => p.status === 'ACTIVE');
            if (active.length === 1) markAttendanceFor(active[0].id);
            else setProjectPick(active);
          })
          .catch(swallow('assistant:projects'));
        return;
      }
      case 'payWorker':
        if (resolved.worker) navigation.navigate('LaborerDetail', { laborerId: resolved.worker.id });
        else navigation.navigate('Labor');
        return;
      case 'udhaarGive':
      case 'udhaarReturn':
        listUdhaar('OPEN')
          .then((rows) => {
            const q = d.person.toLowerCase();
            const hit = rows.find((u) => u.person_name.toLowerCase().includes(q));
            if (hit) navigation.navigate('UdhaarDetail', { udhaarId: hit.id });
            else navigation.navigate('Udhaar');
          })
          .catch(swallow('assistant:udhaar'));
        return;
      case 'transfer':
        navigation.navigate('Transfer', resolved.account ? { fromAccountId: resolved.account.id } : undefined);
        return;
    }
  };

  const actionLabel = d.kind === 'attendance' ? t('aiMarkAttendance') : t('aiOpenForm');
  const actionIcon: IconKey = d.kind === 'attendance' ? 'check' : 'forward';

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <AppIcon name="edit" size={18} color="accent" />
        <AppText size="sm" weight="bold" color="accent">
          {title}
        </AppText>
      </View>
      <AppText size="md" weight="semibold">
        {line}
      </AppText>
      {resolved.unresolved.length > 0 ? (
        <View style={styles.warn}>
          <AppIcon name="alert" size={16} color="gold" />
          <AppText size="xs" weight="semibold" color="gold" style={styles.warnText}>
            {t('aiUnresolved')} {resolved.unresolved.join(', ')}
          </AppText>
        </View>
      ) : null}
      <AppButton label={applied ? t('aiAttendanceDone') : actionLabel} icon={applied ? 'checkCircle' : actionIcon} iconRight={!applied && d.kind !== 'attendance'} onPress={act} loading={saving} disabled={applied} />

      <SelectSheet
        visible={projectPick !== null}
        onClose={() => setProjectPick(null)}
        title={t('selectProject')}
        searchable={false}
        options={(projectPick ?? []).map((p) => ({ id: p.id, label: p.name, icon: 'project' as IconKey }))}
        onSelect={(o) => {
          setProjectPick(null);
          markAttendanceFor(o.id);
        }}
      />
    </View>
  );
}
