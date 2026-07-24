import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon, AppText } from '@/components/ui';
import {
  getAccount,
  getCategory,
  getProject,
  listDocuments,
  type TransactionRow,
} from '@/db';
import { useSheetAnimation } from '@/hooks';
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
  /** When set, shows a button that jumps to the transaction's own page. */
  onOpen?: () => void;
  /** Label for the onOpen button (e.g. "View purchase order"). */
  openLabel?: string;
}

/**
 * THE transaction detail sheet, self-sufficient: give it a TransactionRow and
 * it resolves its own category/account/project names and attached receipt
 * photo. Structured like a document — amount hero, a Details section of
 * labeled rows, and the receipt photo (tap to view full-screen).
 */
export function TransactionDetailSheet({ txn, onClose, footer, onOpen, openLabel }: Props): React.JSX.Element {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [catName, setCatName] = useState('');
  const [accName, setAccName] = useState('');
  const [projName, setProjName] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [viewer, setViewer] = useState(false);

  // Smooth slide/fade; keep the last txn on screen while the sheet animates out.
  const { mounted, backdropStyle, sheetStyle } = useSheetAnimation(txn !== null);
  const [shown, setShown] = useState<TransactionRow | null>(txn);
  useEffect(() => {
    if (txn) setShown(txn);
  }, [txn]);

  useEffect(() => {
    if (!txn) return;
    setCatName('');
    setAccName('');
    setProjName('');
    setReceiptUri(null);
    setViewer(false);
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
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" />
      </Animated.View>
      {shown ? (
        <Animated.View style={[styles.sheet, sheetStyle, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />

          {/* Amount hero */}
          <AppText size="xxl" weight="bold" tabular color={shown.direction === 'IN' ? 'success' : 'danger'}>
            {shown.direction === 'IN' ? '+ ' : '− '}
            {`Rs ${formatPakistaniGrouping(shown.amount)}`}
          </AppText>
          <AppText size="md" weight="semibold">
            {catName || (shown.direction === 'IN' ? t('aamdani') : t('kharcha'))}
          </AppText>

          {/* Details — labeled rows, like a document. */}
          <AppText size="sm" weight="bold" color="accent" style={styles.sectionTitle}>
            {t('detailsSection')}
          </AppText>
          <DetailRow label={t('date')} value={dayjs(shown.date).format('DD MMM YYYY')} />
          {catName ? <DetailRow label={t('category')} value={catName} /> : null}
          {accName ? <DetailRow label={t('accountLabel')} value={accName} /> : null}
          {projName ? <DetailRow label={t('projectLabel')} value={projName} /> : null}
          {shown.counterparty_name ? <DetailRow label={t('party')} value={shown.counterparty_name} /> : null}
          {shown.description ? <DetailRow label={t('note')} value={shown.description} /> : null}

          {/* Receipt photo — tap for the full-screen view. */}
          {receiptUri ? (
            <>
              <AppText size="sm" weight="bold" color="accent" style={styles.sectionTitle}>
                {t('photoReceipt')}
              </AppText>
              <Pressable onPress={() => setViewer(true)} accessibilityRole="imagebutton" accessibilityLabel={t('photoReceipt')}>
                <Image source={{ uri: receiptUri }} style={styles.receipt} resizeMode="cover" />
                <View style={styles.zoomBadge}>
                  <AppIcon name="search" size={16} color="onHero" />
                </View>
              </Pressable>
            </>
          ) : null}

          {onOpen ? (
            <Pressable
              onPress={onOpen}
              accessibilityRole="button"
              style={({ pressed }) => [styles.openBtn, pressed && styles.openPressed]}
            >
              <AppText size="sm" weight="bold" color="accent">{openLabel ?? ''}</AppText>
              <AppIcon name="forward" size={16} color="accent" />
            </Pressable>
          ) : null}

          {footer}
        </Animated.View>
      ) : null}

      {/* Full-screen receipt viewer */}
      <Modal visible={viewer} transparent animationType="fade" onRequestClose={() => setViewer(false)}>
        <View style={styles.viewer}>
          {receiptUri ? <Image source={{ uri: receiptUri }} style={styles.viewerImage} resizeMode="contain" /> : null}
          <Pressable
            onPress={() => setViewer(false)}
            accessibilityRole="button"
            style={[styles.viewerClose, { top: insets.top + theme.spacing.md }]}
          >
            <AppIcon name="close" size={28} color="onHero" />
          </Pressable>
        </View>
      </Modal>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.row}>
      <AppText size="sm" color="textSecondary" style={styles.rowLabel}>
        {label}
      </AppText>
      <AppText size="sm" weight="semibold" style={styles.rowValue} numberOfLines={2}>
        {value}
      </AppText>
    </View>
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
    sectionTitle: { marginTop: theme.spacing.sm },
    openBtn: {
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
    },
    openPressed: { opacity: 0.6 },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    rowLabel: { width: 96 },
    rowValue: { flex: 1, textAlign: 'right' },
    receipt: {
      width: '100%',
      height: 180,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.track,
    },
    zoomBadge: {
      position: 'absolute',
      right: theme.spacing.sm,
      bottom: theme.spacing.sm,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
    viewerImage: { width: '100%', height: '85%' },
    viewerClose: {
      position: 'absolute',
      right: theme.spacing.lg,
      width: 48,
      height: 48,
      borderRadius: theme.radius.pill,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
