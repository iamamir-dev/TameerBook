import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import {
  AppButton,
  AppCard,
  AppHeader,
  AppIcon,
  AppText,
  ContactRow,
  SelectSheet,
  type IconKey,
  type SelectOption,
} from '@/components/ui';
import { getCompanyAssets, updateCompany, type CompanyAssets } from '@/db';
import { useFocusReload, useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/navigation/types';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { swallow } from '@/utils/log';
import { formatRupees } from '@/utils/money';
import { captureReceipt } from '@/utils/photo';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * The active company's own page (Settings → Company): logo (tap to change),
 * identity, and the live net-worth math — cash + plots + construction +
 * receivable. Editing identity and switching companies both live here.
 */
export function CompanyDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);

  const companies = useCompanyStore((s) => s.companies);
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const switchTo = useCompanyStore((s) => s.switchTo);
  const hydrate = useCompanyStore((s) => s.hydrate);
  const company = companies.find((c) => c.id === activeCompanyId) ?? null;

  const [assets, setAssets] = useState<CompanyAssets | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState('');
  const [owner, setOwner] = useState('');
  const [phone, setPhone] = useState('');
  const [switchOpen, setSwitchOpen] = useState(false);
  const { saving, run: runSave } = useSaveAction();

  const load = useCallback(async () => {
    setAssets(await getCompanyAssets());
  }, []);
  const { reload } = useFocusReload(load);

  const openEdit = () => {
    if (!company) return;
    setName(company.name);
    setOwner(company.owner_name ?? '');
    setPhone(company.phone ?? '');
    setEditOpen(true);
  };

  const onSaveEdit = async () => {
    if (!company || !name.trim()) return;
    const ok = await runSave(async () => {
      await updateCompany(company.id, {
        name,
        ownerName: owner.trim() || null,
        phone: phone.trim() || null,
      });
      await hydrate();
    });
    if (!ok) return;
    setEditOpen(false);
  };

  /** Tap the logo → replace it right away (no separate save step). */
  const onChangeLogo = () => {
    if (!company) return;
    void (async () => {
      const uri = await captureReceipt().catch(swallow('company:logo'));
      if (!uri) return;
      const ok = await runSave(async () => {
        await updateCompany(company.id, { logoUri: uri });
        await hydrate();
      });
      if (ok) await reload();
    })();
  };

  const NEW_COMPANY_ID = '__new__';
  const companyOptions = useMemo<SelectOption[]>(
    () => [
      ...companies.map((c) => ({
        id: c.id,
        label: c.name,
        subtitle: c.owner_name ?? undefined,
        icon: 'projects' as IconKey,
      })),
      { id: NEW_COMPANY_ID, label: t('newCompany'), icon: 'add' as IconKey },
    ],
    [companies, t]
  );

  return (
    <View style={styles.screen}>
      <AppHeader
        title={t('companyTitle')}
        onBack={() => navigation.goBack()}
        rightAction={{ icon: 'edit', onPress: openEdit, accessibilityLabel: t('edit') }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxxl }]}
      >
        {/* Identity — logo (tap to change), name, owner, phone. */}
        <AppCard style={styles.identity}>
          <Pressable onPress={onChangeLogo} accessibilityRole="button" accessibilityLabel={t('photo')} style={styles.logoWrap}>
            {company?.logo_uri ? (
              <Image source={{ uri: company.logo_uri }} style={styles.logo} />
            ) : (
              <View style={styles.logoFallback}>
                <AppText size="display" weight="bold" color="onPrimary">
                  {(company?.name ?? '?').charAt(0).toUpperCase()}
                </AppText>
              </View>
            )}
            <View style={styles.cameraBadge}>
              <AppIcon name="camera" size={14} color="onAccent" />
            </View>
          </Pressable>
          <AppText size="xl" weight="bold" center numberOfLines={1}>
            {company?.name ?? ''}
          </AppText>
          {company?.owner_name ? (
            <AppText size="sm" color="textSecondary" center numberOfLines={1}>
              {`${t('ownerName')}: ${company.owner_name}`}
            </AppText>
          ) : null}
          <ContactRow phone={company?.phone} />
        </AppCard>

        {/* Net worth — the same asset math as the Home hero, itemized. */}
        <AppText size="lg" weight="bold">
          {t('netWorthLabel')}
        </AppText>
        <AppCard style={styles.worth}>
          <AppText size="display" weight="bold" color="primary" tabular numberOfLines={1} adjustsFontSizeToFit>
            {formatRupees(assets?.total ?? 0)}
          </AppText>
          <View style={styles.divider} />
          <WorthRow label={t('cashLabel')} value={assets?.cash ?? 0} />
          <WorthRow label={t('assetPlots')} value={assets?.plotsValue ?? 0} />
          <WorthRow label={t('assetConstruction')} value={assets?.constructionValue ?? 0} />
          <WorthRow label={t('receivable')} value={assets?.receivable ?? 0} />
        </AppCard>

        {/* Switch / create workspace. */}
        <AppButton
          label={companies.length > 1 ? t('switchCompany') : t('newCompany')}
          icon={companies.length > 1 ? 'projects' : 'add'}
          variant="secondary"
          onPress={() =>
            companies.length > 1 ? setSwitchOpen(true) : navigation.navigate('NewCompany')
          }
        />
      </ScrollView>

      {/* Edit identity sheet */}
      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.backdrop} onPress={() => setEditOpen(false)} accessibilityRole="button" />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
            <View style={styles.grabber} />
            <AppText size="lg" weight="bold">
              {t('edit')}
            </AppText>
            <FloatingLabelInput label={t('companyName')} value={name} onChangeText={setName} />
            <FloatingLabelInput label={t('ownerName')} value={owner} onChangeText={setOwner} />
            <FloatingLabelInput label={t('phone')} value={phone} onChangeText={setPhone} mask="phone" />
            <AppButton label={t('save')} icon="check" onPress={() => void onSaveEdit()} loading={saving} disabled={!name.trim()} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <SelectSheet
        visible={switchOpen}
        onClose={() => setSwitchOpen(false)}
        options={companyOptions}
        selectedId={activeCompanyId ?? undefined}
        title={t('switchCompany')}
        searchable={false}
        onSelect={(o) => {
          setSwitchOpen(false);
          if (o.id === NEW_COMPANY_ID) navigation.navigate('NewCompany');
          else void switchTo(o.id);
        }}
      />
    </View>
  );
}

function WorthRow({ label, value }: { label: string; value: number }): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.row}>
      <AppText size="sm" color="textSecondary">
        {label}
      </AppText>
      <AppText size="sm" weight="semibold" tabular>
        {formatRupees(value)}
      </AppText>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    identity: { alignItems: 'center', gap: theme.spacing.sm },
    logoWrap: { alignSelf: 'center' },
    logo: { width: 88, height: 88, borderRadius: 24, backgroundColor: theme.colors.track },
    logoFallback: {
      width: 88,
      height: 88,
      borderRadius: 24,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cameraBadge: {
      position: 'absolute',
      right: -4,
      bottom: -4,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.card,
    },
    worth: { gap: theme.spacing.xs },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginVertical: theme.spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
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
