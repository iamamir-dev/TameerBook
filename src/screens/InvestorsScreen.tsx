import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InvestorPersonSheet } from '@/components/InvestorPersonSheet';
import { AppCard, AppHeader, AppIcon, AppText, EmptyState, PhoneChip, SearchBar } from '@/components/ui';
import {
  deleteInvestor,
  isInvestorInUse,
  type InvestorWithCapital,
  listInvestorsWithCapital,
} from '@/db';
import { useFocusReload, useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { FLOATING_BAR_CLEARANCE } from '@/navigation/TabBar';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatRupees } from '@/utils/money';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function InvestorsScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [investors, setInvestors] = useState<InvestorWithCapital[]>([]);
  const [query, setQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<InvestorWithCapital | null>(null);
  const [menuFor, setMenuFor] = useState<InvestorWithCapital | null>(null);

  const load = useCallback(async () => {
    setInvestors(await listInvestorsWithCapital());
  }, []);

  const { loaded, reload } = useFocusReload(load);
  const { run: runSave } = useSaveAction();

  const openAdd = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = (inv: InvestorWithCapital) => {
    setMenuFor(null);
    setEditing(inv);
    setSheetOpen(true);
  };

  // The shared person modal saved a new/edited investor — refresh the list.
  const onSaved = () => {
    setSheetOpen(false);
    setEditing(null);
    void reload();
  };

  const onDelete = (inv: InvestorWithCapital) => {
    setMenuFor(null);
    Alert.alert(inv.name, t('deleteInvestorConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          await runSave(async () => {
            try {
              await deleteInvestor(inv.id);
            } catch (e) {
              // Business guard with its own message — keep the specific alert.
              if (isInvestorInUse(e)) {
                Alert.alert(t('investorInUse'));
                return;
              }
              throw e;
            }
            await reload();
          });
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        title={t('investors')}
        rightAction={{ icon: 'add', onPress: openAdd, accessibilityLabel: t('addInvestor') }}
      />

      {investors.length === 0 ? (
        // Only claim "no investors" once the first load has finished — before
        // that the plain screen shell avoids an empty-state flash.
        loaded ? (
          <EmptyState
            bottomInset={insets.bottom + FLOATING_BAR_CLEARANCE}
            icon="investors"
            title={t('noInvestorsYet')}
            message={t('noInvestorsDetail')}
            actionLabel={t('addInvestor')}
            actionIcon="add"
            onAction={openAdd}
          />
        ) : null
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + FLOATING_BAR_CLEARANCE }]}
        >
          {investors.length > 5 ? <SearchBar value={query} onChange={setQuery} /> : null}
          {investors
            .filter((inv) => {
              const q = query.trim().toLowerCase();
              if (!q) return true;
              return inv.name.toLowerCase().includes(q) || (inv.phone ?? '').includes(query.trim());
            })
            .map((inv) => (
            <AppCard
              key={inv.id}
              onPress={() => navigation.navigate('InvestorProfile', { investorId: inv.id })}
              onLongPress={() => setMenuFor(inv)}
            >
              <View style={styles.row}>
                <Avatar uri={inv.photo_uri} name={inv.name} styles={styles} />
                <View style={styles.info}>
                  <AppText size="md" weight="bold" numberOfLines={1}>
                    {inv.name}
                  </AppText>
                  {inv.phone ? <PhoneChip phone={inv.phone} compact /> : null}
                </View>
                <View style={styles.capBox}>
                  <AppText size="xs" color="textSecondary">
                    {t('paidInCapital')}
                  </AppText>
                  <AppText size="md" weight="bold" color="gold" tabular>
                    {formatRupees(inv.received)}
                  </AppText>
                  {inv.committed_amount > inv.received ? (
                    <AppText size="xs" color="textSecondary" tabular>
                      {`${t('committedAmount')} ${formatRupees(inv.committed_amount)}`}
                    </AppText>
                  ) : null}
                </View>
              </View>
            </AppCard>
          ))}
        </ScrollView>
      )}

      {/* Add / edit investor — the ONE shared person modal (identity + money) */}
      <InvestorPersonSheet
        visible={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setEditing(null);
        }}
        editing={editing}
        onSaved={onSaved}
      />

      {/* Long-press action menu — Edit / Delete */}
      <Modal
        visible={menuFor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuFor(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setMenuFor(null)} />
        <View style={[styles.menuSheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText size="md" weight="bold" numberOfLines={1} style={styles.menuTitle}>
            {menuFor?.name ?? ''}
          </AppText>
          <Pressable
            onPress={() => menuFor && openEdit(menuFor)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
          >
            <AppIcon name="document" size={22} color="primary" />
            <AppText size="md" weight="semibold">
              {t('edit')}
            </AppText>
          </Pressable>
          <Pressable
            onPress={() => menuFor && onDelete(menuFor)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
          >
            <AppIcon name="trash" size={22} color="danger" />
            <AppText size="md" weight="semibold" color="danger">
              {t('delete')}
            </AppText>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function Avatar({
  uri,
  name,
  styles,
}: {
  uri: string | null;
  name: string;
  styles: ReturnType<typeof makeStyles>;
}): React.JSX.Element {
  if (uri) return <Image source={{ uri }} style={styles.avatar} />;
  return (
    <View style={styles.avatarFallback}>
      <AppText size="lg" weight="bold" color="onPrimary">
        {name.trim().charAt(0).toUpperCase() || '?'}
      </AppText>
    </View>
  );
}

const AV = 48;

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    info: { flex: 1, gap: 2 },
    capBox: { alignItems: 'flex-end' },
    avatar: { width: AV, height: AV, borderRadius: theme.radius.pill, backgroundColor: theme.colors.track },
    avatarFallback: {
      width: AV,
      height: AV,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.overlay },
    grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: theme.radius.pill, backgroundColor: theme.colors.track },
    menuSheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: theme.radius.hero,
      borderTopRightRadius: theme.radius.hero,
      padding: theme.spacing.xl,
      gap: theme.spacing.xs,
      ...theme.shadows.raised,
    },
    menuTitle: { marginBottom: theme.spacing.sm },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      minHeight: theme.touch.minTarget,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.md,
    },
    menuRowPressed: { backgroundColor: theme.colors.track },
  });
