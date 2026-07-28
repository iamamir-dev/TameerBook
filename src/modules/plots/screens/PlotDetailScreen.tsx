import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import {
  ActionsDrawer,
  AddActionButton,
  AppButton,
  AppCard,
  AppHeader,
  AppText,
  LedgerTable,
  LoadErrorState,
  type DrawerAction,
  type LedgerRow,
} from '@/components/ui';
import {
  addDocument,
  deletePlotTransaction,
  markPlotTransferred,
  PAY_TYPE_LABEL_KEYS,
  type TransactionRow,
} from '@/db';
import { useCategoryLabel, useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { todayISO } from '@/utils/date';
import { pickDocumentImage } from '@/utils/photo';

import { PlotCategoryBreakdown } from '../components/PlotCategoryBreakdown';
import { PlotDocsGrid } from '../components/PlotDocsGrid';
import { PlotInvestorsSection } from '../components/PlotInvestorsSection';
import { PlotExpenseSheet } from '../components/PlotExpenseSheet';
import { PlotHeroCard } from '../components/PlotHeroCard';
import { PlotSaleCard } from '../components/PlotSaleCard';
import { PlotSellerCard } from '../components/PlotSellerCard';
import { SellerPaymentSheet } from '../components/SellerPaymentSheet';
import { SellPlotSheet, type SellPlotSheetMode } from '../components/SellPlotSheet';
import { usePlotDetail } from '../hooks/usePlots';
import { usePlotReport } from '../hooks/usePlotReport';
import { makeStyles } from '../styled/PlotDetailScreen.styles';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type PlotRoute = RouteProp<RootStackParamList, 'PlotDetail'>;

interface Sheets {
  pay: boolean;
  exp: boolean;
  sell: SellPlotSheetMode | null;
  actions: boolean;
  menu: boolean;
}
const CLOSED: Sheets = { pay: false, exp: false, sell: null, actions: false, menu: false };

/**
 * The core plot page — the owner's notebook for one plot: cost summary, seller
 * payments, plot expenses, documents, and the ledger. A thin orchestrator over
 * usePlotDetail + the plot cards/sheets.
 */
export function PlotDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { plotId } = useRoute<PlotRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const { data, loadFailed, reload } = usePlotDetail(plotId);
  const { summary, linkedProject, accounts, categories, docs, txns } = data;
  const { run: runSave } = useSaveAction();
  const catName = useCategoryLabel();
  const report = usePlotReport({ summary, txns, categories, linkedProject });

  const [sheets, setSheets] = useState<Sheets>(CLOSED);
  const patch = (p: Partial<Sheets>) => setSheets((s) => ({ ...s, ...p }));
  const [txnDetail, setTxnDetail] = useState<TransactionRow | null>(null);
  const [editing, setEditing] = useState<{ kind: 'pay' | 'exp' | 'receipt'; txn: TransactionRow } | null>(null);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const sellerHeadingId = useMemo(() => categories.find((c) => c.name_en === 'Seller Payment')?.id ?? null, [categories]);

  /** Which flow corrects this ledger row: buyer payment, seller payment, or expense. */
  const txnKind = (txn: TransactionRow): 'pay' | 'exp' | 'receipt' => {
    if (txn.phase === 'SALE') return 'receipt';
    const cat = catById.get(txn.category_id ?? '');
    // Seller payment = the legacy "Plot Payment" or any "Seller Payment" child.
    return cat?.name_en === 'Plot Payment' || (!!sellerHeadingId && cat?.parent_id === sellerHeadingId) ? 'pay' : 'exp';
  };

  /** Jump to Settings → Plot (Seller Payment / Buyer Payment / Expenses groups). */
  const onAddCategory = () => {
    setSheets(CLOSED);
    closeEdit();
    navigation.navigate('Categories', { sectionName: 'Plot', type: 'EXPENSE' });
  };

  const onEditTxn = (txn: TransactionRow) => {
    setTxnDetail(null);
    setEditing({ kind: txnKind(txn), txn });
  };

  const onDeleteTxn = (txn: TransactionRow) => {
    Alert.alert(t('delete'), t('deleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () =>
          void runSave(async () => {
            await deletePlotTransaction(txn.id);
            setTxnDetail(null);
            await reload();
          }),
      },
    ]);
  };

  const closeEdit = () => setEditing(null);

  const ledgerRows: LedgerRow[] = useMemo(
    () =>
      txns.map((txn) => {
        const cat = txn.category_id ? catById.get(txn.category_id) : undefined;
        const payLabel = txn.pay_type ? t(PAY_TYPE_LABEL_KEYS[txn.pay_type]) : undefined;
        const isSale = txn.phase === 'SALE';
        return {
          id: txn.id,
          title: txn.description || payLabel || (cat ? catName(cat) : t('transactions')),
          date: txn.date,
          amount: txn.amount,
          direction: isSale ? ('in' as const) : ('out' as const),
          typeLabel: payLabel ?? (cat ? catName(cat) : undefined),
          onPress: () => setTxnDetail(txn),
        };
      }),
    [txns, catById, catName, t]
  );

  // "By category" spend breakdown (paid-to-seller milestones + expenses).
  const breakdownRows = useMemo(() => {
    const byCat = new Map<string, { label: string; total: number }>();
    for (const txn of txns) {
      if (txn.direction !== 'OUT') continue;
      const cat = txn.category_id ? catById.get(txn.category_id) : undefined;
      const key = cat?.id ?? '__uncat__';
      const label = cat ? catName(cat) : t('addExpense');
      const prev = byCat.get(key);
      byCat.set(key, { label, total: (prev?.total ?? 0) + txn.amount });
    }
    return Array.from(byCat.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [txns, catById, catName, t]);

  const onAddDocument = async () => {
    const uri = await pickDocumentImage();
    if (!uri) return;
    await runSave(async () => {
      await addDocument({ entityType: 'plot', entityId: plotId, label: 'docOther', fileUri: uri });
      await reload();
    });
  };

  if (!summary) {
    return (
      <View style={styles.screen}>
        <AppHeader title={t('plotLabel')} onBack={() => navigation.goBack()} />
        {loadFailed ? <LoadErrorState onRetry={() => void reload()} /> : null}
      </View>
    );
  }

  const { plot, salePrice } = summary;
  const sold = plot.status === 'SOLD';
  const projectCompleted = linkedProject?.status === 'COMPLETED';
  // No NEW entries on a sold plot or one inside a completed project…
  const readOnly = sold || projectCompleted;
  // …but existing entries stay correctable unless the project is closed (so
  // fixing/removing a buyer payment can still un-sell a standalone plot).
  const canEditEntries = !projectCompleted;

  const onMarkTransferred = () => {
    patch({ actions: false });
    void runSave(async () => {
      await markPlotTransferred(plotId, todayISO().slice(0, 10));
      await reload();
    });
  };

  const drawerActions: DrawerAction[] = [
    { icon: 'rupee', label: t('sellerPayment'), onPress: () => patch({ actions: false, pay: true }) },
    { icon: 'kharcha', label: t('addExpense'), onPress: () => patch({ actions: false, exp: true }) },
    ...(!plot.project_id && salePrice <= 0
      ? [{ icon: 'tag' as const, label: t('sellPlot'), onPress: () => patch({ actions: false, sell: 'price' }) }]
      : []),
    ...(!plot.project_id && salePrice > 0 && !sold
      ? [{ icon: 'moneyIn' as const, label: t('addReceipt'), onPress: () => patch({ actions: false, sell: 'receipt' }) }]
      : []),
    ...(!plot.transfer_date
      ? [{ icon: 'today' as const, label: t('markTransferred'), onPress: onMarkTransferred }]
      : []),
  ];

  return (
    <View style={styles.screen}>
      <AppHeader
        title={plot.name}
        onBack={() => navigation.goBack()}
        rightAction={{ icon: 'more', onPress: () => patch({ menu: true }), accessibilityLabel: t('actions') }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        <PlotHeroCard
          summary={summary}
          linkedProject={linkedProject}
          onOpenProject={() => plot.project_id && navigation.navigate('ProjectDetail', { projectId: plot.project_id })}
        />

        <PlotSellerCard plot={plot} />

        {!plot.project_id && salePrice > 0 ? (
          <PlotSaleCard summary={summary} onAddReceipt={() => patch({ sell: 'receipt' })} />
        ) : null}

        <PlotCategoryBreakdown rows={breakdownRows} />

        {/* Musharakah investors — standalone flips only (project plots settle
            with the project). */}
        {!plot.project_id ? <PlotInvestorsSection plotId={plot.id} locked={readOnly} onChanged={reload} /> : null}

        {/* Ledger — the "+" opens the actions drawer. */}
        <View style={styles.sectionHeader}>
          <AppText size="lg" weight="bold" style={styles.flex}>
            {t('transactions')}
          </AppText>
          {!readOnly ? <AddActionButton onPress={() => patch({ actions: true })} accessibilityLabel={t('addPayment')} /> : null}
        </View>
        <AppCard compact>
          <LedgerTable rows={ledgerRows} emptyText={t('addFirstEntry')} />
        </AppCard>

        {/* Documents */}
        <AppText size="lg" weight="bold">
          {t('tabDocs')}
        </AppText>
        <PlotDocsGrid docs={docs} readOnly={readOnly} onAdd={onAddDocument} />
      </ScrollView>

      <ActionsDrawer
        visible={sheets.actions}
        onClose={() => patch({ actions: false })}
        title={plot.name}
        actions={drawerActions}
      />

      <ActionsDrawer
        visible={sheets.menu}
        onClose={() => patch({ menu: false })}
        title={plot.name}
        actions={[
          ...(!readOnly
            ? [{ icon: 'edit' as const, label: t('editPlot'), onPress: () => { patch({ menu: false }); navigation.navigate('EditPlot', { plotId: plot.id }); } }]
            : []),
          { icon: 'print' as const, label: t('printLabel'), onPress: () => { patch({ menu: false }); report.preview(); } },
          { icon: 'share' as const, label: t('shareLabel'), onPress: () => { patch({ menu: false }); report.share(); } },
        ]}
      />

      <SellerPaymentSheet
        visible={sheets.pay || editing?.kind === 'pay'}
        onClose={() => {
          patch({ pay: false });
          closeEdit();
        }}
        summary={summary}
        accounts={accounts}
        editing={editing?.kind === 'pay' ? editing.txn : null}
        onAddCategory={onAddCategory}
        onSaved={reload}
      />

      <PlotExpenseSheet
        visible={sheets.exp || editing?.kind === 'exp'}
        onClose={() => {
          patch({ exp: false });
          closeEdit();
        }}
        summary={summary}
        accounts={accounts}
        editing={editing?.kind === 'exp' ? editing.txn : null}
        onAddCategory={onAddCategory}
        onSaved={reload}
      />

      {!plot.project_id ? (
        <SellPlotSheet
          visible={sheets.sell !== null || editing?.kind === 'receipt'}
          mode={editing?.kind === 'receipt' ? 'receipt' : sheets.sell ?? 'price'}
          onClose={() => {
            patch({ sell: null });
            closeEdit();
          }}
          summary={summary}
          accounts={accounts}
          editing={editing?.kind === 'receipt' ? editing.txn : null}
          onAddCategory={onAddCategory}
          onSaved={reload}
        />
      ) : null}

      <TransactionDetailSheet
        txn={txnDetail}
        onClose={() => setTxnDetail(null)}
        footer={
          txnDetail && canEditEntries ? (
            <View style={styles.detailActions}>
              <View style={styles.flex}>
                <AppButton label={t('edit')} icon="edit" variant="secondary" onPress={() => onEditTxn(txnDetail)} />
              </View>
              <View style={styles.flex}>
                <AppButton label={t('delete')} icon="trash" variant="danger" onPress={() => onDeleteTxn(txnDetail)} />
              </View>
            </View>
          ) : undefined
        }
      />
    </View>
  );
}
