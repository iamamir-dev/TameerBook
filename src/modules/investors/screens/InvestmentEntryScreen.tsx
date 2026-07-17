import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import {
  AccountPickerRow,
  AmountInput,
  AppButton,
  AppHeader,
  AppIcon,
  AppText,
  DateField,
  SelectSheet,
  StickyFooter,
  type IconKey,
} from '@/components/ui';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';

import { useInvestmentEntry } from '../hooks/useInvestmentEntry';
import { makeStyles } from '../styled/InvestmentEntryScreen.styles';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function InvestmentEntryScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'Investment'>>();
  const styles = makeStyles(theme);

  const { projects, investors, accounts, form, patch, saving, canSave, save } = useInvestmentEntry(
    route.params?.investorId ?? null
  );
  const [investorSheet, setInvestorSheet] = useState(false);
  const [projectSheet, setProjectSheet] = useState(false);

  const selectedInvestor = investors.find((i) => i.id === form.investorId) ?? null;
  const selectedProject = projects.find((p) => p.project.id === form.projectId)?.project ?? null;

  if (projects.length === 0 || investors.length === 0 || accounts.length === 0) {
    return (
      <View style={styles.screen}>
        <AppHeader title={t('addInvestment')} onBack={() => navigation.goBack()} />
        <View style={styles.empty}>
          <AppText size="md" color="textSecondary" center>
            {investors.length === 0
              ? t('noInvestorsDetail')
              : projects.length === 0
                ? t('noProjectsDetail')
                : t('obCashBody')}
          </AppText>
          {investors.length === 0 ? (
            <AppButton label={t('addInvestor')} icon="add" fullWidth={false} onPress={() => navigation.navigate('Tabs', { screen: 'Investors' })} />
          ) : projects.length === 0 ? (
            <AppButton label={t('newProject')} icon="add" fullWidth={false} onPress={() => navigation.navigate('NewProject')} />
          ) : (
            <AppButton label={t('addAccount')} icon="balance" fullWidth={false} onPress={() => navigation.navigate('Accounts')} />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader title={t('addInvestment')} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: theme.spacing.xl }]}
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

          <AmountInput value={form.amount} onChange={(v) => patch({ amount: v })} autoFocus />

          <AccountPickerRow accounts={accounts} selectedId={form.accountId} onSelect={(id) => patch({ accountId: id })} />

          <DateField value={form.date} onChange={(d) => patch({ date: d })} />
        </ScrollView>

        <StickyFooter>
          <AppButton label={t('save')} icon="check" onPress={() => save(() => navigation.goBack())} loading={saving} disabled={!canSave} />
        </StickyFooter>
      </KeyboardAvoidingView>

      <SelectSheet visible={investorSheet} onClose={() => setInvestorSheet(false)} options={investors.map((i) => ({ id: i.id, label: i.name, icon: 'investor' as IconKey }))} selectedId={form.investorId ?? undefined} title={t('selectInvestor')} onSelect={(o) => patch({ investorId: o.id })} />
      <SelectSheet visible={projectSheet} onClose={() => setProjectSheet(false)} options={projects.map((p) => ({ id: p.project.id, label: p.project.name, icon: 'project' as IconKey }))} selectedId={form.projectId ?? undefined} title={t('selectProject')} onSelect={(o) => patch({ projectId: o.id })} />
    </View>
  );
}
