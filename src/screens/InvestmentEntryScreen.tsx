import { type RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AmountInput,
  AppButton,
  AppHeader,
  AppIcon,
  AppText,
  SelectSheet,
  type IconKey,
  type SelectOption,
} from '@/components/ui';
import { addInvestment, type InvestorRow, listInvestors, type PaymentMode } from '@/db';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useEntryStore } from '@/stores/useEntryStore';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { todayISO } from '@/utils/date';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MODES: { mode: PaymentMode; labelKey: TranslationKey }[] = [
  { mode: 'CASH', labelKey: 'modeCash' },
  { mode: 'BANK', labelKey: 'modeBank' },
  { mode: 'JAZZCASH', labelKey: 'modeJazzcash' },
];

export function InvestmentEntryScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'Investment'>>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const projects = useProjectsStore((s) => s.items);
  const refreshProjects = useProjectsStore((s) => s.refresh);
  const lastProjectId = useEntryStore((s) => s.lastProjectId);
  const setLastProjectId = useEntryStore((s) => s.setLastProjectId);

  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [investorId, setInvestorId] = useState<string | null>(route.params?.investorId ?? null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState<PaymentMode>('CASH');
  const [date, setDate] = useState(todayISO().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [investorSheet, setInvestorSheet] = useState(false);
  const [projectSheet, setProjectSheet] = useState(false);
  const [dateSheet, setDateSheet] = useState(false);

  useEffect(() => {
    listInvestors().then(setInvestors).catch(() => undefined);
  }, []);
  useFocusEffect(
    useCallback(() => {
      refreshProjects().catch(() => undefined);
    }, [refreshProjects])
  );
  useEffect(() => {
    if (projectId) return;
    const fb = projects.find((p) => p.project.id === lastProjectId) ?? projects[0];
    if (fb) setProjectId(fb.project.id);
  }, [projects, lastProjectId, projectId]);

  const selectedProject = projects.find((p) => p.project.id === projectId)?.project ?? null;
  const selectedInvestor = investors.find((i) => i.id === investorId) ?? null;
  const dateLabel = date === todayISO().slice(0, 10) ? t('today') : dayjs(date).format('DD MMM YYYY');
  const dateOptions: SelectOption[] = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const d = dayjs().subtract(i, 'day');
        return { id: d.format('YYYY-MM-DD'), label: i === 0 ? t('today') : d.format('DD MMM YYYY') };
      }),
    [t]
  );

  const onSave = async () => {
    if (!investorId || !projectId || amount <= 0) return;
    setSaving(true);
    try {
      await addInvestment({ investorId, projectId, amount, date, mode });
      setLastProjectId(projectId);
      await refreshProjects();
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  if (projects.length === 0 || investors.length === 0) {
    return (
      <View style={styles.screen}>
        <AppHeader title={t('addInvestment')} onBack={() => navigation.goBack()} />
        <View style={styles.empty}>
          <AppText size="md" color="textSecondary" center>
            {investors.length === 0 ? t('noInvestorsDetail') : t('noProjectsDetail')}
          </AppText>
          {investors.length === 0 ? (
            <AppButton label={t('addInvestor')} icon="add" fullWidth={false} onPress={() => navigation.navigate('Tabs', { screen: 'Investors' })} />
          ) : (
            <AppButton label={t('newProject')} icon="add" fullWidth={false} onPress={() => navigation.navigate('NewProject')} />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader title={t('addInvestment')} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => setInvestorSheet(true)} style={styles.chip} accessibilityRole="button">
            <AppIcon name="investor" size={18} color="primary" />
            <AppText size="sm" weight="semibold" numberOfLines={1} style={styles.flex} color={selectedInvestor ? 'textPrimary' : 'textSecondary'}>
              {selectedInvestor?.name ?? t('selectInvestor')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          <Pressable onPress={() => setProjectSheet(true)} style={styles.chip} accessibilityRole="button">
            <AppIcon name="project" size={18} color="primary" />
            <AppText size="sm" weight="bold" numberOfLines={1} style={styles.flex}>
              {selectedProject?.name ?? t('selectProject')}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          <AmountInput value={amount} onChange={setAmount} autoFocus />

          <View style={styles.modeRow}>
            {MODES.map((m) => {
              const active = m.mode === mode;
              return (
                <Pressable key={m.mode} onPress={() => setMode(m.mode)} accessibilityRole="button" style={[styles.modeBtn, active && styles.modeBtnActive]}>
                  <AppText size="sm" weight="bold" color={active ? 'onPrimary' : 'textSecondary'}>
                    {t(m.labelKey)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={() => setDateSheet(true)} style={styles.chip} accessibilityRole="button">
            <AppIcon name="today" size={18} color="primary" />
            <AppText size="sm" weight="semibold" style={styles.flex}>
              {dateLabel}
            </AppText>
            <AppIcon name="forward" size={18} color="textSecondary" />
          </Pressable>

          <AppButton
            label={t('save')}
            icon="check"
            onPress={onSave}
            loading={saving}
            disabled={!investorId || !projectId || amount <= 0}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <SelectSheet visible={investorSheet} onClose={() => setInvestorSheet(false)} options={investors.map((i) => ({ id: i.id, label: i.name, icon: 'investor' as IconKey }))} selectedId={investorId ?? undefined} title={t('selectInvestor')} onSelect={(o) => setInvestorId(o.id)} />
      <SelectSheet visible={projectSheet} onClose={() => setProjectSheet(false)} options={projects.map((p) => ({ id: p.project.id, label: p.project.name, icon: 'project' as IconKey }))} selectedId={projectId ?? undefined} title={t('selectProject')} onSelect={(o) => setProjectId(o.id)} />
      <SelectSheet visible={dateSheet} onClose={() => setDateSheet(false)} options={dateOptions} selectedId={date} title={t('date')} searchable={false} onSelect={(o) => setDate(o.id)} />
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
    modeRow: { flexDirection: 'row', gap: theme.spacing.sm },
    modeBtn: {
      flex: 1,
      minHeight: theme.touch.minTarget,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.card,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
    },
    modeBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  });
