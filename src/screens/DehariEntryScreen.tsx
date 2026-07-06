import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { AmountInput, AppButton, AppHeader, AppIcon, AppText, SelectSheet, type IconKey, type SelectOption } from '@/components/ui';
import { addParty, addTransaction, getCategoryByNameEn, listParties, type PartyRow } from '@/db';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useEntryStore } from '@/stores/useEntryStore';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { todayISO } from '@/utils/date';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const ADD_PARTY_ID = '__add__';

export function DehariEntryScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const projects = useProjectsStore((s) => s.items);
  const refreshProjects = useProjectsStore((s) => s.refresh);
  const lastProjectId = useEntryStore((s) => s.lastProjectId);
  const setLastProjectId = useEntryStore((s) => s.setLastProjectId);

  const [parties, setParties] = useState<PartyRow[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [desc, setDesc] = useState('');
  const [partyId, setPartyId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [projectSheet, setProjectSheet] = useState(false);
  const [partySheet, setPartySheet] = useState(false);
  const [dateSheet, setDateSheet] = useState(false);
  const [addPartyOpen, setAddPartyOpen] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');

  const loadParties = useCallback(async () => setParties(await listParties()), []);
  useEffect(() => {
    loadParties().catch(() => undefined);
  }, [loadParties]);

  useFocusEffect(
    useCallback(() => {
      refreshProjects().catch(() => undefined);
    }, [refreshProjects])
  );
  useEffect(() => {
    if (projectId) return;
    const fallback = projects.find((p) => p.project.id === lastProjectId) ?? projects[0];
    if (fallback) setProjectId(fallback.project.id);
  }, [projects, lastProjectId, projectId]);

  const selectedProject = projects.find((p) => p.project.id === projectId)?.project ?? null;
  const selectedParty = parties.find((p) => p.id === partyId) ?? null;
  const dateLabel = date === todayISO().slice(0, 10) ? t('today') : dayjs(date).format('DD MMM YYYY');

  const dateOptions: SelectOption[] = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const d = dayjs().subtract(i, 'day');
        return { id: d.format('YYYY-MM-DD'), label: i === 0 ? t('today') : d.format('DD MMM YYYY') };
      }),
    [t]
  );
  const partyOptions: SelectOption[] = useMemo(
    () => [
      { id: ADD_PARTY_ID, label: t('addNew'), icon: 'add' },
      ...parties.map((p) => ({ id: p.id, label: p.name, icon: 'dehari' as IconKey })),
    ],
    [parties, t]
  );

  const onSave = async () => {
    if (!projectId || amount <= 0) return;
    setSaving(true);
    try {
      const cat = await getCategoryByNameEn('Labor Dehari');
      await addTransaction({
        projectId,
        direction: 'OUT',
        categoryId: cat?.id ?? null,
        amount,
        date,
        mode: 'CASH',
        partyId,
        description: desc || null,
      });
      setLastProjectId(projectId);
      await refreshProjects();
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  const onAddParty = async () => {
    const name = newPartyName.trim();
    if (!name) return;
    const created = await addParty({ type: 'LABOR', name });
    await loadParties();
    setPartyId(created.id);
    setNewPartyName('');
    setAddPartyOpen(false);
  };

  if (projects.length === 0) {
    return (
      <View style={styles.screen}>
        <AppHeader title={t('dehari')} onBack={() => navigation.goBack()} />
        <View style={styles.empty}>
          <AppText size="md" color="textSecondary" center>
            {t('noProjectsDetail')}
          </AppText>
          <AppButton label={t('newProject')} icon="add" fullWidth={false} onPress={() => navigation.navigate('NewProject')} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader title={t('dehari')} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => setProjectSheet(true)} style={styles.chip} accessibilityRole="button">
            <AppIcon name="project" size={18} color="primary" />
            <AppText size="sm" weight="bold" numberOfLines={1} style={styles.flex}>
              {selectedProject?.name ?? t('selectProject')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          <AmountInput value={amount} onChange={setAmount} autoFocus />
          <FloatingLabelInput label={t('note')} value={desc} onChangeText={setDesc} />

          <Pressable onPress={() => setPartySheet(true)} style={styles.chip} accessibilityRole="button">
            <AppIcon name="dehari" size={18} color="primary" />
            <AppText size="sm" weight="semibold" numberOfLines={1} style={styles.flex} color={selectedParty ? 'textPrimary' : 'textSecondary'}>
              {selectedParty?.name ?? t('paidTo')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          <Pressable onPress={() => setDateSheet(true)} style={styles.chip} accessibilityRole="button">
            <AppIcon name="today" size={18} color="primary" />
            <AppText size="sm" weight="semibold" style={styles.flex}>
              {dateLabel}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          <AppButton label={t('save')} icon="check" onPress={onSave} loading={saving} />
        </ScrollView>
      </KeyboardAvoidingView>

      <SelectSheet visible={projectSheet} onClose={() => setProjectSheet(false)} options={projects.map((p) => ({ id: p.project.id, label: p.project.name, icon: 'project' as IconKey }))} selectedId={projectId ?? undefined} title={t('selectProject')} onSelect={(o) => setProjectId(o.id)} />
      <SelectSheet visible={partySheet} onClose={() => setPartySheet(false)} options={partyOptions} selectedId={partyId ?? undefined} title={t('paidTo')} onSelect={(o) => (o.id === ADD_PARTY_ID ? setAddPartyOpen(true) : setPartyId(o.id))} />
      <SelectSheet visible={dateSheet} onClose={() => setDateSheet(false)} options={dateOptions} selectedId={date} title={t('date')} searchable={false} onSelect={(o) => setDate(o.id)} />

      <Modal visible={addPartyOpen} transparent animationType="fade" onRequestClose={() => setAddPartyOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAddPartyOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText size="lg" weight="bold">
            {t('addNew')}
          </AppText>
          <FloatingLabelInput label={t('paidTo')} value={newPartyName} onChangeText={setNewPartyName} />
          <AppButton label={t('save')} icon="check" onPress={onAddParty} />
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.lg, padding: theme.spacing.xl },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.lg,
      minHeight: theme.touch.minTarget,
    },
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
  });
