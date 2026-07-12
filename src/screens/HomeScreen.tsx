import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/ProgressBar';
import { StageBadge } from '@/components/StageBadge';
import {
  AccountCard,
  AppCard,
  AppIcon,
  AppText,
  LedgerTable,
  type IconKey,
  type LedgerRow,
} from '@/components/ui';
import {
  getCompanyAssets,
  getTotalBalance,
  getUdhaarTotals,
  listAccountsWithBalance,
  type CompanyAssets,
  listCategories,
  listLaborersWithTotals,
  listPlots,
  listRecentTransactions,
  listTransferDeadlines,
  type AccountWithBalance,
  type CategoryRow,
  type PlotRow,
  type ProjectSummary,
  type TransactionRow,
  type UdhaarTotals,
} from '@/db';
import { useCategoryLabel, useFocusReload } from '@/hooks';
import { useTranslation } from '@/i18n';
import { FLOATING_BAR_CLEARANCE } from '@/navigation/TabBar';
import type { RootStackParamList } from '@/navigation/types';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { nearestTransferDeadline, type TransferDeadlineWarning } from '@/utils/date';
import { formatRupees } from '@/utils/money';
import { softToneColor, type ColorKey } from '@/utils/tones';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * "Soft Modern" Home dashboard  cash-flow first: the total across all
 * accounts up top, the accounts rail beneath it, quick links to Plots and
 * Udhaar, the projects rail, and recent activity as a notebook-style ledger.
 */
export function HomeScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const projects = useProjectsStore((s) => s.items);
  const refreshProjects = useProjectsStore((s) => s.refresh);
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const companyName =
    useCompanyStore((s) => s.companies.find((c) => c.id === activeCompanyId)?.name) ?? t('appName');

  // Which sections this Home shows (Settings → Home screen).
  const sections = useSettingsStore((s) => s.homeSections);

  const [total, setTotal] = useState(0);
  const [assets, setAssets] = useState<CompanyAssets | null>(null);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [udhaar, setUdhaar] = useState<UdhaarTotals>({ receivable: 0, payable: 0 });
  const [recent, setRecent] = useState<TransactionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [deadlineWarn, setDeadlineWarn] = useState<TransferDeadlineWarning | null>(null);
  const [ownedPlots, setOwnedPlots] = useState<PlotRow[]>([]);
  const [laborOwed, setLaborOwed] = useState(0);

  const loadData = useCallback(async () => {
    const [tot, accs, ud, txns, cats, deadlines, companyAssets, plots, workers] = await Promise.all([
      getTotalBalance(),
      listAccountsWithBalance(),
      getUdhaarTotals(),
      listRecentTransactions(8),
      listCategories(),
      listTransferDeadlines(),
      getCompanyAssets(),
      // Optional sections only pay their query cost when switched on.
      sections.plots ? listPlots() : Promise.resolve<PlotRow[]>([]),
      sections.labor ? listLaborersWithTotals() : Promise.resolve([]),
    ]);
    setTotal(tot);
    setAssets(companyAssets);
    setAccounts(accs);
    setUdhaar(ud);
    setRecent(txns);
    setCategories(cats);
    setDeadlineWarn(nearestTransferDeadline(deadlines));
    // Show every plot still held (OWNED first, then IN_PROJECT); sold ones
    // are history and stay off the dashboard.
    setOwnedPlots(
      plots
        .filter((p) => p.status !== 'SOLD')
        .sort((a, b) => (a.status === b.status ? 0 : a.status === 'OWNED' ? -1 : 1))
    );
    setLaborOwed(workers.reduce((sum, w) => sum + w.balance, 0));
  }, [sections.plots, sections.labor]);

  const load = useCallback(async () => {
    await Promise.all([refreshProjects(), loadData()]);
  }, [refreshProjects, loadData]);

  useFocusReload(load);

  const catLabel = useCategoryLabel();
  const catName = useCallback(
    (id: string | null): string => {
      if (!id) return '';
      const c = categories.find((x) => x.id === id);
      return c ? catLabel(c) : '';
    },
    [categories, catLabel]
  );

  const ledgerRows: LedgerRow[] = useMemo(
    () =>
      recent.map((txn) => ({
        id: txn.id,
        title:
          txn.description ||
          catName(txn.category_id) ||
          txn.counterparty_name ||
          t(txn.direction === 'IN' ? 'aamdani' : 'kharcha'),
        date: txn.date,
        amount: txn.amount,
        direction: txn.direction === 'IN' ? ('in' as const) : ('out' as const),
        typeLabel: catName(txn.category_id) || undefined,
      })),
    [recent, catName, t]
  );

  const accountTypeLabel = (a: AccountWithBalance) =>
    t(a.type === 'BANK' ? 'accountBank' : a.type === 'CASH' ? 'accountCash' : 'accountWallet');

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + theme.spacing.md,
            paddingBottom: insets.bottom + FLOATING_BAR_CLEARANCE,
          },
        ]}
      >
        {/* Header  avatar + greeting on the left, bell on the right */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <AppText size="lg" weight="bold" color="onPrimary">
              {companyName.charAt(0).toUpperCase()}
            </AppText>
          </View>
          <View style={styles.headerText}>
            <AppText size="sm" color="textSecondary">
              {t('greeting')}
            </AppText>
            <AppText size="xl" weight="bold" numberOfLines={1}>
              {companyName}
            </AppText>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            hitSlop={theme.touch.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={t('settings')}
            style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
          >
            <AppIcon name="settings" size={22} color="textPrimary" />
          </Pressable>
        </View>

        {/* Transfer deadline warning (within 7 days) */}
        {deadlineWarn ? (
          <Pressable
            onPress={() => navigation.navigate('PlotDetail', { plotId: deadlineWarn.plotId })}
            accessibilityRole="button"
            style={styles.warnChip}
          >
            <AppIcon name="today" size={18} color="danger" />
            <AppText size="sm" weight="bold" color="danger" style={styles.warnText} numberOfLines={2}>
              {t('deadlineSoon')}: {deadlineWarn.plotName} · {Math.max(0, deadlineWarn.days)} {t('daysLeftSuffix')}
            </AppText>
          </Pressable>
        ) : null}

        {/* Company hero → the FULL asset picture (cash + plots + construction
            + receivable). The Cash tile below opens the cash-only view. */}
        <Pressable
          onPress={() => navigation.navigate('Cash', { scope: 'assets' })}
          accessibilityRole="button"
          style={styles.hero}
        >
          <AppText size="overline" weight="semibold" color="textSecondary" uppercase>
            {t('totalAssets')}
          </AppText>
          <AppText size="display" weight="bold" color="primary" tabular numberOfLines={1} adjustsFontSizeToFit>
            {formatRupees(assets?.total ?? total)}
          </AppText>
          {assets && (assets.plotsValue > 0 || assets.constructionValue > 0 || udhaar.receivable > 0) ? (
            <AppText size="xs" color="textSecondary" numberOfLines={1}>
              {[
                assets.plotsValue > 0 ? `${t('assetPlots')} ${formatRupees(assets.plotsValue)}` : null,
                assets.constructionValue > 0
                  ? `${t('assetConstruction')} ${formatRupees(assets.constructionValue)}`
                  : null,
                udhaar.receivable > 0 ? `${t('receivable')} ${formatRupees(udhaar.receivable)}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </AppText>
          ) : null}

          <View style={styles.assetsBlock}>
            <View style={styles.assetsHead}>
              <AppIcon name="balance" size={16} color="accent" />
              <AppText size="sm" weight="bold" color="textSecondary">
                {t('totalBalance')}
              </AppText>
              <AppText size="lg" weight="bold" color="accent" tabular style={styles.assetsTotal}>
                {formatRupees(total)}
              </AppText>
            </View>
          </View>
        </Pressable>

        {/* Accounts rail */}
        <SectionHeader
          title={t('accountsTitle')}
          action={t('seeAll')}
          onAction={() => navigation.navigate('Cash')}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.railBleed} contentContainerStyle={styles.rail}>
          {accounts.map((a) => (
            <AccountCard
              key={a.id}
              compact
              name={a.name}
              type={a.type}
              balance={a.balance}
              typeLabel={accountTypeLabel(a)}
              onPress={() => navigation.navigate('AccountDetail', { accountId: a.id })}
            />
          ))}
          <Pressable
            onPress={() => navigation.navigate('Cash')}
            accessibilityRole="button"
            style={styles.addAccountCard}
          >
            <AppIcon name="add" size={22} color="accent" />
            <AppText size="sm" weight="semibold" color="accent">
              {t('addAccount')}
            </AppText>
          </Pressable>
        </ScrollView>

        {/* Shortcuts  Cash / Labor / Reports as one card, cells separated by
            light hairlines (Jazz-grid style). Udhaar + Transfer live inside
            the Cash hub; Accounts lives in Settings; Settings is the header
            gear. Only these three company-level sections are surfaced here. */}
        <View style={styles.sectionsCard}>
          <SectionTile icon="balance" tone="primary" label={t('tabCash')} onPress={() => navigation.navigate('Cash')} />
          <View style={styles.sectionDivider} />
          <SectionTile icon="dehari" tone="accent" label={t('laborTitle')} onPress={() => navigation.navigate('Labor')} />
          <View style={styles.sectionDivider} />
          <SectionTile icon="reports" tone="gold" label={t('reports')} onPress={() => navigation.navigate('Reports')} />
        </View>

        {/* Udhaar position (optional, off by default) */}
        {sections.udhaar ? (
          <>
            <SectionHeader title={t('udhaar')} action={t('seeAll')} onAction={() => navigation.navigate('Udhaar')} />
            <AppCard compact onPress={() => navigation.navigate('Udhaar')}>
              <View style={styles.splitRow}>
                <View style={styles.splitCol}>
                  <AppText size="xs" weight="semibold" color="textSecondary">
                    {t('receivable')}
                  </AppText>
                  <AppText size="md" weight="bold" color="success" tabular numberOfLines={1} adjustsFontSizeToFit>
                    {formatRupees(udhaar.receivable)}
                  </AppText>
                </View>
                <View style={styles.splitDivider} />
                <View style={styles.splitCol}>
                  <AppText size="xs" weight="semibold" color="textSecondary">
                    {t('payable')}
                  </AppText>
                  <AppText size="md" weight="bold" color={udhaar.payable > 0 ? 'danger' : 'textPrimary'} tabular numberOfLines={1} adjustsFontSizeToFit>
                    {formatRupees(udhaar.payable)}
                  </AppText>
                </View>
              </View>
            </AppCard>
          </>
        ) : null}

        {/* Labor position (optional, off by default) */}
        {sections.labor ? (
          <>
            <SectionHeader title={t('laborTitle')} action={t('seeAll')} onAction={() => navigation.navigate('Labor')} />
            <AppCard compact onPress={() => navigation.navigate('Labor')}>
              <View style={styles.splitRow}>
                <View style={styles.splitCol}>
                  <AppText size="xs" weight="semibold" color="textSecondary">
                    {t('outstanding')}
                  </AppText>
                  <AppText size="md" weight="bold" color={laborOwed > 0 ? 'danger' : 'textPrimary'} tabular numberOfLines={1} adjustsFontSizeToFit>
                    {formatRupees(laborOwed)}
                  </AppText>
                </View>
              </View>
            </AppCard>
          </>
        ) : null}

        {/* Owned plots (optional, off by default) */}
        {sections.plots ? (
          <>
            <SectionHeader
              title={t('plotsTitle')}
              action={t('seeAll')}
              onAction={() => navigation.navigate('Tabs', { screen: 'Plots' })}
            />
            <AppCard compact>
              {ownedPlots.length === 0 ? (
                <AppText size="sm" color="textSecondary" center style={styles.emptyPad}>
                  {t('noFreePlots')}
                </AppText>
              ) : (
                ownedPlots.map((p, i) => (
                  <Pressable
                    key={p.id}
                    onPress={() => navigation.navigate('PlotDetail', { plotId: p.id })}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.plotRow, i > 0 && styles.ruled, pressed && styles.pressed]}
                  >
                    <AppIcon name="plot" size={18} color="gold" />
                    <View style={styles.flex}>
                      <AppText size="sm" weight="semibold" numberOfLines={1}>
                        {p.name}
                      </AppText>
                      <AppText size="xs" color="textSecondary" numberOfLines={1}>
                        {[p.society, formatRupees(p.deal_price)].filter(Boolean).join(' · ')}
                      </AppText>
                    </View>
                    <StageBadge
                      tone={p.status === 'OWNED' ? 'success' : 'primary'}
                      label={t(p.status === 'OWNED' ? 'plotOwned' : 'plotInProject')}
                    />
                  </Pressable>
                ))
              )}
            </AppCard>
          </>
        ) : null}

        {/* My Projects */}
        <SectionHeader
          title={t('myProjects')}
          action={t('seeAll')}
          onAction={() => navigation.navigate('Tabs', { screen: 'Projects' })}
        />
        {projects.length === 0 ? (
          <AppCard onPress={() => navigation.navigate('NewProject')}>
            <View style={styles.emptyProjects}>
              <AppIcon name="add" size={22} color="accent" />
              <AppText size="sm" weight="semibold" color="accent">
                {t('newProject')}
              </AppText>
            </View>
          </AppCard>
        ) : (
          <View style={styles.projectList}>
            {projects.map((summary) => (
              <ProjectCard
                key={summary.project.id}
                summary={summary}
                onPress={() => navigation.navigate('ProjectDetail', { projectId: summary.project.id })}
              />
            ))}
          </View>
        )}

        {/* Recent activity  notebook-style ledger */}
        {sections.activity ? (
          <>
            <SectionHeader title={t('recentActivity')} />
            <AppCard compact>
              <LedgerTable rows={ledgerRows} emptyText={t('noAccountTxns')} />
            </AppCard>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

/* ------------------------------ helpers --------------------------------- */

function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.sectionHeader}>
      <AppText size="lg" weight="bold">
        {title}
      </AppText>
      {action ? (
        <Pressable onPress={onAction} hitSlop={theme.touch.hitSlop} accessibilityRole="button">
          <AppText size="sm" weight="semibold" color="accent">
            {action}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * One cell of the Home sections card (Cash / Labor / Reports): a soft-tinted
 * icon circle with the section name beneath. Cells sit side by side in one
 * white card, separated by light hairline dividers.
 */
function SectionTile({
  icon,
  tone,
  label,
  onPress,
}: {
  icon: IconKey;
  tone: ColorKey;
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.sectionTile, pressed && styles.pressed]}
    >
      <View style={[styles.sectionIcon, { backgroundColor: softToneColor(theme, tone) }]}>
        <AppIcon name={icon} size={22} color={tone} />
      </View>
      <AppText size="xs" weight="semibold" center numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

function ProjectCard({
  summary,
  onPress,
}: {
  summary: ProjectSummary;
  onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);
  const { project, progressPercent } = summary;
  const completed = project.status === 'COMPLETED';
  const percent = completed ? 100 : Math.round(progressPercent);

  return (
    <AppCard onPress={onPress} style={styles.projectCard}>
      <AppText size="md" weight="semibold" numberOfLines={1}>
        {project.name}
      </AppText>
      <StageBadge
        tone={completed ? 'success' : 'accent'}
        label={completed ? t('statusDone') : t('statusCurrent')}
      />

      <View style={styles.progressTrackWrap}>
        <ProgressBar percent={percent} tone={completed ? 'success' : 'accent'} />
      </View>

      {/* Cost breakdown  same notebook-style rows as the plot cards. */}
      <View style={styles.projectMath}>
        <View style={styles.projectMathRow}>
          <AppText size="xs" color="textSecondary">{t('phasePlot')}</AppText>
          <AppText size="xs" weight="semibold" tabular>{formatRupees(summary.cost.plotCost)}</AppText>
        </View>
        <View style={styles.projectMathRow}>
          <AppText size="xs" color="textSecondary">{t('phaseConstruction')}</AppText>
          <AppText size="xs" weight="semibold" tabular>{formatRupees(summary.cost.constructionCost)}</AppText>
        </View>
        {summary.saleReceived > 0 ? (
          <View style={styles.projectMathRow}>
            <AppText size="xs" color="textSecondary">{t('phaseSale')}</AppText>
            <AppText size="xs" weight="semibold" color="success" tabular>{formatRupees(summary.saleReceived)}</AppText>
          </View>
        ) : null}
        <View style={styles.projectMathTotal}>
          <AppText size="sm" weight="bold">{t('projectTotalCost')}</AppText>
          <AppText size="sm" weight="bold" tabular>{formatRupees(summary.cost.totalCost)}</AppText>
        </View>
      </View>
    </AppCard>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.lg,
    },
    /* header */
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: {
      flex: 1,
    },
    bell: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadows.card,
    },
    pressed: {
      opacity: 0.6,
    },
    /* deadline warning */
    warnChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.dangerSoft,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    warnText: { flex: 1 },
    /* hero */
    hero: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.hero,
      padding: theme.spacing.xl,
      gap: theme.spacing.xs,
      ...theme.shadows.card,
    },
    assetsBlock: {
      gap: theme.spacing.xs,
      marginTop: theme.spacing.md,
      paddingTop: theme.spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    assetsHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
    assetsTotal: { marginLeft: 'auto' },
    /* rails + quick links */
    /* Full-bleed rail: negative margin escapes the screen padding so cards
       are never clipped at the padded edge; inner padding restores alignment
       and vertical padding gives the soft shadows room to render. */
    railBleed: { marginHorizontal: -theme.spacing.lg },
    rail: {
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.xs,
    },
    addAccountCard: {
      width: 120,
      borderRadius: theme.radius.card,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xs,
    },
    /* optional sections: udhaar/labor split card + plot rows */
    flex: { flex: 1 },
    emptyPad: { paddingVertical: theme.spacing.lg },
    splitRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      paddingVertical: theme.spacing.xs,
    },
    splitCol: { flex: 1, alignItems: 'center', gap: 2 },
    splitDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginVertical: theme.spacing.xs,
    },
    plotRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      minHeight: 40,
    },
    ruled: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    sectionsCard: {
      flexDirection: 'row',
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.card,
      paddingVertical: theme.spacing.lg,
      ...theme.shadows.card,
    },
    sectionDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginVertical: theme.spacing.xs,
    },
    sectionTile: {
      flex: 1,
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    sectionIcon: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    /* sections */
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.spacing.sm,
    },
    emptyProjects: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
    },
    projectList: { gap: theme.spacing.md },
    projectCard: {
      gap: theme.spacing.sm,
    },
    projectMath: { gap: theme.spacing.xs },
    projectMathRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    projectMathTotal: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      paddingTop: theme.spacing.xs,
      marginTop: 2,
    },
    progressTrackWrap: {
      marginTop: theme.spacing.xs,
    },
    projectFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
  });
