import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui';
import {
  getAccount,
  getCategory,
  getProject,
  listDocuments,
  type TransactionRow,
} from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { swallow } from '@/utils/log';
import { formatPakistaniGrouping } from '@/utils/money';

interface Props {
  txn: TransactionRow | null;
  onClose: () => void;
  /** Optional extra footer content (e.g. the fix-mistake actions). */
  footer?: React.ReactNode;
}

/**
 * THE transaction detail sheet, self-sufficient: give it a TransactionRow and
 * it resolves its own category/account/project names and attached receipt
 * photo. Every transaction list in the app opens this same sheet, so a tapped
 * entry always reads the same way everywhere.
 */
export function TransactionDetailSheet({ txn, onClose, footer }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [catName, setCatName] = useState('');
  const [accName, setAccName] = useState('');
  const [projName, setProjName] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);

  useEffect(() => {
    if (!txn) return;
    setCatName('');
    setAccName('');
    setProjName('');
    setReceiptUri(null);
    void (async () => {
      const [cat, acc, proj, docs] = await Promise.all([
        txn.category_id ? getCategory(txn.category_id) : null,
        txn.account_id ? getAccount(txn.account_id) : null,
        txn.project_id ? getProject(txn.project_id) : null,
        listDocuments('transaction', txn.id),
      ]);
      setCatName(cat ? (language === 'ur' ? cat.name_ur : cat.name_en) : '');
      setAccName(acc?.name ?? '');
      setProjName(proj?.name ?? '');
      setReceiptUri(docs[0]?.file_uri ?? null);
    })().catch(swallow('TxnDetail:load'));
  }, [txn, language]);

  return (
    <Modal visible={txn !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
      {txn ? (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText size="xxl" weight="bold" tabular color={txn.direction === 'IN' ? 'success' : 'danger'}>
            {txn.direction === 'IN' ? '+ ' : '− '}
            {`Rs ${formatPakistaniGrouping(txn.amount)}`}
          </AppText>
          <AppText size="md" weight="semibold">
            {catName || (txn.direction === 'IN' ? t('aamdani') : t('kharcha'))}
          </AppText>
          {txn.description ? (
            <AppText size="sm" color="textSecondary">
              {txn.description}
            </AppText>
          ) : null}
          {txn.counterparty_name ? (
            <AppText size="sm" color="textSecondary">
              {txn.counterparty_name}
            </AppText>
          ) : null}
          <AppText size="sm" color="textSecondary">
            {[dayjs(txn.date).format('DD MMM YYYY'), accName, projName].filter(Boolean).join(' · ')}
          </AppText>

          {/* Attached receipt/bill photo, when the entry has one. */}
          {receiptUri ? (
            <Image source={{ uri: receiptUri }} style={styles.receipt} resizeMode="cover" />
          ) : null}

          {footer}
        </View>
      ) : null}
    </Modal>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
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
      gap: theme.spacing.sm,
      ...theme.shadows.raised,
    },
    grabber: {
      alignSelf: 'center',
      width: 44,
      height: 5,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.track,
      marginBottom: theme.spacing.sm,
    },
    receipt: {
      width: '100%',
      height: 200,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.track,
      marginTop: theme.spacing.sm,
    },
  });
