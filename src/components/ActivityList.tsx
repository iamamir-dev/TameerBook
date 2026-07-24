import React, { useState } from 'react';

import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import {
  AppButton,
  AppSheet,
  AppText,
  LabelValueRow,
  LedgerTable,
  type LedgerRow,
} from '@/components/ui';
import type { TransactionRow } from '@/db';
import { useTranslation } from '@/i18n';
import { formatPakistaniGrouping } from '@/utils/money';

export interface ActivityDetailRow {
  label: string;
  value: string;
}

export interface ActivityItem {
  id: string;
  title: string;
  /** ISO date shown under the title. */
  date: string;
  amount: number;
  direction: 'in' | 'out';
  /** Small tag under the amount (e.g. the entry type). */
  typeLabel?: string;
  /** Backing transaction → the rich detail sheet + (if `editable`) an Edit action. */
  txn?: TransactionRow;
  /** Read-only detail rows for non-transaction items (e.g. settlement entries). */
  detail?: ActivityDetailRow[];
  /** Show the Edit action in the detail sheet (transaction-backed rows only). */
  editable?: boolean;
}

interface ActivityListProps {
  items: ActivityItem[];
  emptyText?: string;
  /** Fired when the user taps Edit on an editable, transaction-backed row. The
   *  module supplies the context-correct edit sheet (kept out of here so the
   *  list stays reusable). */
  onEdit?: (txn: TransactionRow) => void;
  /** Row id to tint (e.g. after jumping to it from Home/Transactions). */
  highlightId?: string | null;
}

/**
 * The one activity/ledger list for the whole app: notebook-style rows
 * (`LedgerTable`) that open a detail drawer on tap, matching the Home "Recent
 * Activity" feel. Transaction-backed rows open the rich `TransactionDetailSheet`
 * (with an optional Edit action); non-transaction rows (settlement output) open
 * a read-only info sheet. Reusable across modules — the caller maps its data to
 * `ActivityItem[]` and handles edit via `onEdit`.
 */
export function ActivityList({ items, emptyText, onEdit, highlightId }: ActivityListProps): React.JSX.Element {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<ActivityItem | null>(null);

  const rows: LedgerRow[] = items.map((it) => ({
    id: it.id,
    title: it.title,
    date: it.date,
    amount: it.amount,
    direction: it.direction,
    typeLabel: it.typeLabel,
    onPress: () => setSelected(it),
  }));

  const info = selected && !selected.txn ? selected : null;

  return (
    <>
      <LedgerTable
        rows={rows}
        emptyText={emptyText}
        // highlightId comes in as a transaction id; map it to its row id.
        highlightId={highlightId ? items.find((it) => it.txn?.id === highlightId)?.id ?? highlightId : undefined}
      />

      {/* Transaction-backed rows → rich detail (+ optional edit). */}
      <TransactionDetailSheet
        txn={selected?.txn ?? null}
        onClose={() => setSelected(null)}
        footer={
          selected?.txn && selected.editable && onEdit ? (
            <AppButton
              label={t('edit')}
              icon="edit"
              variant="secondary"
              onPress={() => {
                const txn = selected.txn!;
                setSelected(null);
                onEdit(txn);
              }}
            />
          ) : undefined
        }
      />

      {/* Non-transaction rows (settlement output) → read-only info. */}
      <AppSheet visible={info !== null} onClose={() => setSelected(null)} title={info?.title}>
        {info ? (
          <>
            <AppText size="xxl" weight="bold" tabular color={info.direction === 'in' ? 'success' : 'danger'}>
              {`${info.direction === 'in' ? '+ ' : '− '}Rs ${formatPakistaniGrouping(info.amount)}`}
            </AppText>
            {(info.detail ?? []).map((d) => (
              <LabelValueRow key={d.label} label={d.label} value={d.value} />
            ))}
          </>
        ) : null}
      </AppSheet>
    </>
  );
}
