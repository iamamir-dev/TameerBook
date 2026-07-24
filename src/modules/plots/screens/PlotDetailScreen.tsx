import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import {
  ActionsDrawer,
  AddActionButton,
  AppCard,
  AppHeader,
  AppText,
  LedgerTable,
  LoadErrorState,
  SelectSheet,
  type DrawerAction,
  type LedgerRow,
} from '@/components/ui';
import {
  addDocument,
  listDocuments,
  PAY_TYPE_LABEL_KEYS,
  setPlotStage,
  type TransactionRow,
} from '@/db';
import { useCategoryLabel, useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { pickDocumentImage } from '@/utils/photo';
import { stageTone } from '@/utils/tones';

import { PlotDocsGrid } from '../components/PlotDocsGrid';
import { PlotExpenseSheet } from '../components/PlotExpenseSheet';
import { PlotHeroCard } from '../components/PlotHeroCard';
import { PlotSaleCard } from '../components/PlotSaleCard';
import { PlotSellerCard } from '../components/PlotSellerCard';
import { SellerPaymentSheet } from '../components/SellerPaymentSheet';
import { SellPlotSheet, type SellPlotSheetMode } from '../components/SellPlotSheet';
import { usePlotDetail } from '../hooks/usePlots';
import { makeStyles } from '../styled/PlotDetailScreen.styles';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type PlotRoute = RouteProp<RootStackParamList, 'PlotDetail'>;

interface Sheets {
  pay: boolean;
  exp: boolean;
  sell: SellPlotSheetMode | null;
  actions: boolean;
  stage: boolean;
}
const CLOSED: Sheets = { pay: false, exp: false, sell: null, actions: false, stage: false };

/**
 * The core plot page — the owner's notebook for one plot: cost summary, seller
 * payments, plot expenses, documents, and the ledger. A thin orchestrator over
 * usePlotDetail + the plot cards/sheets.
 */
export function PlotDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { plotId } = useRoute<PlotRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const { data, loadFailed, reload } = usePlotDetail(plotId);
  const { summary, linkedProject, accounts, categories, docs, txns, stages } = data;
  const { run: runSave } = useSaveAction();
  const catName = useCategoryLabel();

  const [sheets, setSheets] = useState<Sheets>(CLOSED);
  const patch = (p: Partial<Sheets>) => setSheets((s) => ({ ...s, ...p }));
  const [txnDetail, setTxnDetail] = useState<TransactionRow | null>(null);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const ledgerRows: LedgerRow[] = useMemo(
    () =>
      txns.map((txn) => {
        const cat = txn.category_id ? catById.get(txn.category_id) : undefined;
        const payLabel = txn.pay_type ? t(PAY_TYPE_LABEL_KEYS[txn.pay_type]) : undefined;
        return {
          id: txn.id,
          title: txn.description || payLabel || (cat ? catName(cat) : t('transactions')),
          date: txn.date,
          amount: txn.amount,
          direction: 'out' as const,
          typeLabel: payLabel ?? (cat ? catName(cat) : undefined),
          onPress: () => setTxnDetail(txn),
        };
      }),
    [txns, catById, catName, t]
  );

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
  // No mutating actions on a sold plot or one inside a completed project.
  const readOnly = sold || linkedProject?.status === 'COMPLETED';
  const currentStage = stages.find((x) => x.id === plot.stage_id) ?? null;

  const drawerActions: DrawerAction[] = [
    { icon: 'rupee', label: t('sellerPayment'), onPress: () => patch({ actions: false, pay: true }) },
    { icon: 'kharcha', label: t('addExpense'), onPress: () => patch({ actions: false, exp: true }) },
    ...(!plot.project_id && salePrice <= 0
      ? [{ icon: 'tag' as const, label: t('sellPlot'), onPress: () => patch({ actions: false, sell: 'price' }) }]
      : []),
    ...(!plot.project_id && salePrice > 0 && !sold
      ? [{ icon: 'moneyIn' as const, label: t('addReceipt'), onPress: () => patch({ actions: false, sell: 'receipt' }) }]
      : []),
  ];

  return (
    <View style={styles.screen}>
      <AppHeader
        title={plot.name}
        onBack={() => navigation.goBack()}
        rightAction={
          readOnly
            ? undefined
            : { icon: 'edit', onPress: () => navigation.navigate('EditPlot', { plotId: plot.id }), accessibilityLabel: t('editPlot') }
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        <PlotHeroCard
          summary={summary}
          stage={currentStage}
          readOnly={readOnly}
          onPressStage={() => patch({ stage: true })}
          linkedProject={linkedProject}
          onOpenProject={() => plot.project_id && navigation.navigate('ProjectDetail', { projectId: plot.project_id })}
        />

        <PlotSellerCard plot={plot} />

        {!plot.project_id && salePrice > 0 ? (
          <PlotSaleCard summary={summary} onAddReceipt={() => patch({ sell: 'receipt' })} />
        ) : null}

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

      <SellerPaymentSheet
        visible={sheets.pay}
        onClose={() => patch({ pay: false })}
        summary={summary}
        accounts={accounts}
        onSaved={reload}
      />

      <PlotExpenseSheet
        visible={sheets.exp}
        onClose={() => patch({ exp: false })}
        summary={summary}
        accounts={accounts}
        onSaved={reload}
      />

      <SelectSheet
        visible={sheets.stage}
        onClose={() => patch({ stage: false })}
        title={t('setStatusLabel')}
        searchable={false}
        selectedId={plot.stage_id ?? '__none__'}
        options={[
          { id: '__none__', label: t('noStatus') },
          ...stages.map((st) => ({
            id: st.id,
            label: language === 'ur' ? st.name_ur : st.name_en,
            dotColor: theme.colors[stageTone(st)],
          })),
        ]}
        onSelect={(o) => {
          patch({ stage: false });
          void (async () => {
            const ok = await runSave(() => setPlotStage(plotId, o.id === '__none__' ? null : o.id));
            if (ok) await reload();
          })();
        }}
      />

      {!plot.project_id ? (
        <SellPlotSheet
          visible={sheets.sell !== null}
          mode={sheets.sell ?? 'price'}
          onClose={() => patch({ sell: null })}
          summary={summary}
          accounts={accounts}
          onSaved={reload}
        />
      ) : null}

      <TransactionDetailSheet txn={txnDetail} onClose={() => setTxnDetail(null)} />
    </View>
  );
}
