import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { ActivityList } from '@/components/ActivityList';
import {
  ActionsDrawer,
  AddActionButton,
  AppCard,
  AppHeader,
  AppText,
  ContactRow,
  type DrawerAction,
} from '@/components/ui';
import type { TransactionRow } from '@/db';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useTheme } from '@/theme';
import { swallow } from '@/utils/log';

import { InvestorHero } from '../components/InvestorHero';
import { InvestorMoneySheet, type MoneyMode } from '../components/InvestorMoneySheet';
import { InvestorPersonSheet } from '../components/InvestorPersonSheet';
import { ProjectReturnsCard } from '../components/ProjectReturnsCard';
import { useInvestorProfile } from '../hooks/useInvestorProfile';
import { useInvestorStatement } from '../hooks/useInvestorStatement';
import { makeStyles } from '../styled/InvestorProfileScreen.styles';
import { buildInvestorActivityItems } from '../utils/investorActivity';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ProfileRoute = RouteProp<RootStackParamList, 'InvestorProfile'>;

export function InvestorProfileScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { investorId, focusTxnId } = useRoute<ProfileRoute>().params;
  const styles = makeStyles(theme);

  const { data, reload } = useInvestorProfile(investorId);
  const { investor, summary, returns, activity, accounts } = data;

  // Jumped in from a linked transaction: flash + scroll to the capital timeline.
  const scrollRef = useRef<ScrollView>(null);
  const timelineYRef = useRef(0);
  const focusHandled = useRef(false);
  const [highlightTxn, setHighlightTxn] = useState<string | null>(null);
  useEffect(() => {
    if (!focusTxnId || focusHandled.current || activity.length === 0) return;
    focusHandled.current = true;
    setHighlightTxn(focusTxnId);
    const s = setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, timelineYRef.current - 80), animated: true }), 350);
    const c = setTimeout(() => setHighlightTxn(null), 3200);
    return () => { clearTimeout(s); clearTimeout(c); };
  }, [focusTxnId, activity]);

  const projects = useProjectsStore((s) => s.items);
  const refreshProjects = useProjectsStore((s) => s.refresh);
  useEffect(() => {
    void refreshProjects().catch(swallow('investor:projects'));
  }, [refreshProjects]);

  const [editOpen, setEditOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [moneyMode, setMoneyMode] = useState<MoneyMode>(null);
  const [editTxn, setEditTxn] = useState<TransactionRow | null>(null);

  const statement = useInvestorStatement({ investor, summary, activity });

  const canExit = returns.some((r) => !r.settled);
  const defaultProjectId = returns[0]?.projectId ?? projects[0]?.project.id ?? null;

  const openMoney = (mode: MoneyMode) => {
    setActionsOpen(false);
    setEditTxn(null);
    setMoneyMode(mode);
  };
  const onEditTxn = (txn: TransactionRow) => {
    setEditTxn(txn);
    setMoneyMode('edit');
  };
  const closeMoney = () => {
    setMoneyMode(null);
    setEditTxn(null);
  };
  const onMoneySaved = () => {
    closeMoney();
    void reload();
  };

  const drawerActions: DrawerAction[] = [
    { icon: 'investor', label: t('newInvestment'), onPress: () => openMoney('new') },
    { icon: 'moneyIn', label: t('investFromBalance'), onPress: () => openMoney('balance') },
    {
      icon: 'statement',
      label: t('statement'),
      loading: statement.busy,
      onPress: () => {
        setActionsOpen(false);
        statement.share();
      },
    },
    ...(canExit
      ? [{ icon: 'forward' as const, label: t('exitTitle'), onPress: () => navigation.navigate('ExitWizard', { investorId }) }]
      : []),
  ];

  return (
    <View style={styles.screen}>
      <AppHeader
        title={investor?.name ?? t('investors')}
        onBack={() => navigation.goBack()}
        rightAction={
          investor
            ? { icon: 'edit', onPress: () => setEditOpen(true), accessibilityLabel: t('editInvestor') }
            : undefined
        }
      />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: theme.spacing.xl }]}
      >
        <InvestorHero summary={summary} />

        <ContactRow phone={investor?.phone} cnic={investor?.cnic} />
        {investor?.bank_info ? (
          <AppText size="sm" color="textSecondary">
            {`${t('bankDetails')}: ${investor.bank_info}`}
          </AppText>
        ) : null}

        <ProjectReturnsCard
          returns={returns}
          onOpenProject={(projectId) => navigation.navigate('ProjectDetail', { projectId })}
        />

        <View
          style={styles.sectionHeader}
          onLayout={(e) => { timelineYRef.current = e.nativeEvent.layout.y; }}
        >
          <AppText size="lg" weight="bold">
            {t('capitalTimeline')}
          </AppText>
          <AddActionButton onPress={() => setActionsOpen(true)} accessibilityLabel={t('addMoney')} />
        </View>
        <AppCard compact>
          <ActivityList
            items={buildInvestorActivityItems(activity, t)}
            emptyText={t('emptyLedger')}
            onEdit={onEditTxn}
            highlightId={highlightTxn}
          />
        </AppCard>
      </ScrollView>

      <ActionsDrawer
        visible={actionsOpen}
        onClose={() => setActionsOpen(false)}
        title={investor?.name ?? ''}
        actions={drawerActions}
      />

      <InvestorMoneySheet
        investorId={investorId}
        mode={moneyMode}
        editTxn={editTxn}
        projects={projects.map((p) => ({ id: p.project.id, name: p.project.name }))}
        accounts={accounts}
        available={summary?.available ?? 0}
        defaultProjectId={defaultProjectId}
        onClose={closeMoney}
        onSaved={onMoneySaved}
      />

      <InvestorPersonSheet
        visible={editOpen}
        editing={investor}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          void reload();
        }}
      />
    </View>
  );
}
