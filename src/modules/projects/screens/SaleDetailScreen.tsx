import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
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
  type LedgerRow,
} from '@/components/ui';
import {
  deleteSaleReceipt,
  PAY_TYPE_LABEL_KEYS,
  voidTransaction,
  type TransactionRow,
} from '@/db';
import { useCategoryLabel, useModuleCategories, useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { formatRupees } from '@/utils/money';

import { EditDealSheet } from '../components/EditDealSheet';
import { SaleCostSheet } from '../components/SaleCostSheet';
import { SaleReceiptSheet } from '../components/SaleReceiptSheet';
import { useSaleDetail } from '../hooks/useSaleDetail';
import { makeStyles } from '../styled/SaleDetailScreen.styles';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type SaleRoute = RouteProp<RootStackParamList, 'SaleDetail'>;

interface Sheets {
  receipt: boolean;
  cost: boolean;
  deal: boolean;
  actions: boolean;
}
const CLOSED: Sheets = { receipt: false, cost: false, deal: false, actions: false };

/**
 * The SALE phase of a project: the deal with the buyer (agreed price), money
 * received from the buyer, seller-side costs, and the notebook-style SALE
 * ledger — every entry editable in place. Thin orchestrator over useSaleDetail.
 */
export function SaleDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { projectId } = useRoute<SaleRoute>().params;
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const { data, reload } = useSaleDetail(projectId);
  const { summary, project, txns, accounts, buyers } = data;
  const { saving, run: runSave } = useSaveAction();
  const { data: saleCats } = useModuleCategories('sale');
  const catLabel = useCategoryLabel();

  const [sheets, setSheets] = useState<Sheets>(CLOSED);
  const patch = (p: Partial<Sheets>) => setSheets((s) => ({ ...s, ...p }));
  const [txnDetail, setTxnDetail] = useState<TransactionRow | null>(null);
  const [editing, setEditing] = useState<{ kind: 'receipt' | 'cost'; txn: TransactionRow } | null>(null);
  const closeEdit = () => setEditing(null);

  const sale = summary?.sale ?? null;
  // A completed project's sale phase is read-only history.
  const completed = project?.status === 'COMPLETED';

  const catById = useMemo(() => new Map(saleCats.map((c) => [c.id, c])), [saleCats]);

  /** Which flow corrects this ledger row: buyer receipt (IN) or sale cost (OUT). */
  const txnKind = (txn: TransactionRow): 'receipt' | 'cost' => (txn.direction === 'IN' ? 'receipt' : 'cost');

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
            if (txnKind(txn) === 'receipt') await deleteSaleReceipt(txn.id);
            else await voidTransaction(txn.id).then(() => undefined);
            setTxnDetail(null);
            await reload();
          }),
      },
    ]);
  };

  const ledgerRows: LedgerRow[] = useMemo(
    () =>
      txns.map((txn) => {
        const isReceipt = txn.direction === 'IN';
        const payLabel = txn.pay_type ? t(PAY_TYPE_LABEL_KEYS[txn.pay_type]) : undefined;
        const cat = txn.category_id ? catById.get(txn.category_id) : undefined;
        return {
          id: txn.id,
          title: isReceipt
            ? t('buyerPaymentTypes')
            : (cat ? catLabel(cat) : txn.description || t('kharcha')),
          date: txn.date,
          amount: txn.amount,
          direction: isReceipt ? ('in' as const) : ('out' as const),
          typeLabel: isReceipt ? payLabel : txn.description || undefined,
          onPress: () => setTxnDetail(txn),
        };
      }),
    [txns, catById, catLabel, t]
  );

  return (
    <View style={styles.screen}>
      <AppHeader title={t('phaseSale')} onBack={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        {!sale && completed ? null : !sale ? (
          /* No deal yet — one primary action opens the deal sheet. */
          <AppCard>
            <View style={styles.newDeal}>
              <AppText size="lg" weight="bold">
                {t('saleDeal')}
              </AppText>
              <AppText size="sm" color="textSecondary">
                {t('buyerName')}
              </AppText>
              <AppButton label={t('addNew')} icon="add" onPress={() => patch({ deal: true })} />
            </View>
          </AppCard>
        ) : (
          /* Deal hero — tap to edit (locked once the project completes). */
          <Pressable
            onPress={completed ? undefined : () => patch({ deal: true })}
            disabled={completed}
            accessibilityRole="button"
            style={styles.hero}
          >
            <AppText size="overline" weight="semibold" color="textSecondary" uppercase>
              {t('saleDeal')}
            </AppText>
            <AppText size="display" weight="bold" color="primary" tabular numberOfLines={1} adjustsFontSizeToFit>
              {formatRupees(sale.agreed_price)}
            </AppText>
            {sale.buyer_name ? (
              <AppText size="sm" color="textSecondary" numberOfLines={1}>
                {`${t('buyerName')}: ${sale.buyer_name}`}
              </AppText>
            ) : null}
            <View style={styles.heroMetrics}>
              <MetricRow label={t('buyerReceipts')} value={formatRupees(summary?.receiptsTotal ?? 0)} tone="success" />
              <MetricRow label={t('warnBuyerOwes')} value={formatRupees(summary?.outstanding ?? 0)} />
              <MetricRow label={t('saleCosts')} value={formatRupees(summary?.costs ?? 0)} tone="danger" />
            </View>
          </Pressable>
        )}

        {/* SALE ledger — the "+" opens the actions drawer. */}
        <View style={[styles.sectionHeaderRow, styles.sectionTitle]}>
          <AppText size="lg" weight="bold" style={styles.flex}>
            {t('transactions')}
          </AppText>
          {sale && !completed ? (
            <AddActionButton onPress={() => patch({ actions: true })} accessibilityLabel={t('addReceipt')} />
          ) : null}
        </View>
        <AppCard compact>
          <LedgerTable rows={ledgerRows} emptyText={t('noAccountTxns')} />
        </AppCard>
      </ScrollView>

      <ActionsDrawer
        visible={sheets.actions}
        onClose={() => patch({ actions: false })}
        title={project?.name ?? ''}
        actions={[
          { icon: 'moneyIn', label: t('addReceipt'), onPress: () => patch({ actions: false, receipt: true }) },
          { icon: 'moneyOut', label: t('addExpense'), onPress: () => patch({ actions: false, cost: true }) },
        ]}
      />

      {summary && sale ? (
        <SaleReceiptSheet
          visible={sheets.receipt || editing?.kind === 'receipt'}
          onClose={() => {
            patch({ receipt: false });
            closeEdit();
          }}
          summary={summary}
          accounts={accounts}
          editing={editing?.kind === 'receipt' ? editing.txn : null}
          onSaved={reload}
        />
      ) : null}

      <SaleCostSheet
        visible={sheets.cost || editing?.kind === 'cost'}
        onClose={() => {
          patch({ cost: false });
          closeEdit();
        }}
        projectId={projectId}
        accounts={accounts}
        editing={editing?.kind === 'cost' ? editing.txn : null}
        onSaved={reload}
      />

      <EditDealSheet
        visible={sheets.deal}
        onClose={() => patch({ deal: false })}
        projectId={projectId}
        sale={sale}
        buyers={buyers}
        onSaved={reload}
      />

      <TransactionDetailSheet
        txn={txnDetail}
        onClose={() => setTxnDetail(null)}
        footer={
          txnDetail && !completed ? (
            <View style={styles.detailActions}>
              <View style={styles.flex}>
                <AppButton label={t('edit')} icon="edit" variant="secondary" onPress={() => onEditTxn(txnDetail)} />
              </View>
              <View style={styles.flex}>
                <AppButton label={t('delete')} icon="trash" variant="danger" onPress={() => onDeleteTxn(txnDetail)} loading={saving} />
              </View>
            </View>
          ) : undefined
        }
      />
    </View>
  );
}

function MetricRow({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' }): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.metricRow}>
      <AppText size="sm" color="textSecondary">
        {label}
      </AppText>
      <AppText size="sm" weight="bold" tabular color={tone ?? 'textPrimary'}>
        {value}
      </AppText>
    </View>
  );
}
