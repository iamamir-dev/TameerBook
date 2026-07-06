import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { AppButton, AppCard, AppHeader, AppIcon, AppText, EmptyState } from '@/components/ui';
import { addInvestor, type InvestorWithCapital, listInvestorsWithCapital } from '@/db';
import { useTranslation } from '@/i18n';
import { FLOATING_BAR_CLEARANCE } from '@/navigation/TabBar';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { formatRupees } from '@/utils/money';
import { captureReceipt } from '@/utils/photo';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function InvestorsScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const [investors, setInvestors] = useState<InvestorWithCapital[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cnic, setCnic] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setInvestors(await listInvestorsWithCapital());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  const resetForm = () => {
    setName('');
    setPhone('');
    setCnic('');
    setPhotoUri(null);
  };

  // Save the new investor. `andInvest` then jumps to the investment screen
  // pre-filled with the new investor so you can record their first investment.
  const onSave = async (andInvest = false) => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const created = await addInvestor({ name: name.trim(), phone: phone || null, cnic: cnic || null, photoUri });
      resetForm();
      setAddOpen(false);
      await load();
      if (andInvest) navigation.navigate('Investment', { investorId: created.id });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader title={t('investors')} />

      {investors.length === 0 ? (
        <EmptyState
          icon="investors"
          title={t('noInvestorsYet')}
          message={t('noInvestorsDetail')}
          actionLabel={t('addInvestor')}
          actionIcon="add"
          onAction={() => setAddOpen(true)}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + FLOATING_BAR_CLEARANCE + 72 }]}
        >
          {investors.map((inv) => (
            <AppCard key={inv.id} onPress={() => navigation.navigate('InvestorProfile', { investorId: inv.id })}>
              <View style={styles.row}>
                <Avatar uri={inv.photo_uri} name={inv.name} styles={styles} />
                <View style={styles.info}>
                  <AppText size="md" weight="bold" numberOfLines={1}>
                    {inv.name}
                  </AppText>
                  {inv.phone ? (
                    <AppText size="xs" color="textSecondary">
                      {inv.phone}
                    </AppText>
                  ) : null}
                </View>
                <View style={styles.capBox}>
                  <AppText size="xs" color="textSecondary">
                    {t('totalCapital')}
                  </AppText>
                  <AppText size="md" weight="bold" color="gold" tabular>
                    {formatRupees(inv.totalCapital)}
                  </AppText>
                </View>
              </View>
            </AppCard>
          ))}
        </ScrollView>
      )}

      <Pressable
        onPress={() => setAddOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('addInvestor')}
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + FLOATING_BAR_CLEARANCE + theme.spacing.sm },
          pressed && styles.fabPressed,
        ]}
      >
        <AppIcon name="add" size={22} color="onAccent" strokeWidth={2.4} />
        <AppText size="sm" weight="bold" color="onAccent">
          {t('addInvestor')}
        </AppText>
      </Pressable>

      {/* Add investor modal */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAddOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          <AppText size="lg" weight="bold">
            {t('addInvestor')}
          </AppText>
          <View style={styles.photoRow}>
            <Avatar uri={photoUri} name={name} styles={styles} />
            <View style={styles.flex}>
              <AppButton
                label={t('photo')}
                icon="camera"
                variant="secondary"
                onPress={async () => {
                  const uri = await captureReceipt();
                  if (uri) setPhotoUri(uri);
                }}
              />
            </View>
          </View>
          <FloatingLabelInput label={t('personName')} value={name} onChangeText={setName} />
          <FloatingLabelInput label={t('phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <FloatingLabelInput label={t('cnic')} value={cnic} onChangeText={setCnic} />
          <AppButton
            label={t('addInvestment')}
            icon="add"
            onPress={() => onSave(true)}
            loading={saving}
            disabled={!name.trim()}
          />
          <AppButton label={t('save')} icon="check" variant="secondary" onPress={() => onSave(false)} loading={saving} />
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
    flex: { flex: 1 },
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
    fab: {
      position: 'absolute',
      right: theme.spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      height: theme.touch.minTarget,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accent,
      ...theme.shadows.fab,
    },
    fabPressed: { opacity: 0.9 },
    photoRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
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
      gap: theme.spacing.md,
      ...theme.shadows.raised,
    },
    grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: theme.radius.pill, backgroundColor: theme.colors.track },
  });
