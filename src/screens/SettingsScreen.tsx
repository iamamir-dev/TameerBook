import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  AppCard,
  AppHeader,
  AppIcon,
  AppText,
  AppToggle,
  SelectSheet,
  type IconKey,
  type SelectOption,
} from '@/components/ui';
import { useTranslation, type TranslationKey } from '@/i18n';
import type { Language } from '@/i18n/types';
import type { RootStackParamList } from '@/navigation/types';
import { rescheduleReminders } from '@/notifications/reminders';
import { useCompanyStore } from '@/stores/useCompanyStore';
import {
  useSettingsStore,
  type HomeSectionKey,
  type ReminderKey,
} from '@/stores/useSettingsStore';
import { useTheme } from '@/theme';
import { FONT_OPTIONS, FONT_SCALES, type FontKey, type FontScaleKey, type Theme } from '@/theme/theme';
import { swallow } from '@/utils/log';
import { reloadApp, syncLayoutDirection } from '@/utils/rtl';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const APP_VERSION: string = (require('../../app.json') as { expo: { version: string } }).expo
  .version;

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Settings placeholder. The two live controls are the LANGUAGE picker (en /
 * Roman Urdu) and the DARK MODE switch  both write to `useSettingsStore`, so
 * flipping either re-themes / re-translates the whole app instantly. The
 * structure is RTL-ready: adding an Urdu-script dictionary + flipping
 * I18nManager is the only remaining step.
 */
export function SettingsScreen(): React.JSX.Element {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(theme);

  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const darkMode = useSettingsStore((s) => s.darkMode);
  const setDarkMode = useSettingsStore((s) => s.setDarkMode);
  const reminders = useSettingsStore((s) => s.reminders);
  const setReminder = useSettingsStore((s) => s.setReminder);
  const investorProfitPct = useSettingsStore((s) => s.investorProfitPct);
  const setInvestorProfitPct = useSettingsStore((s) => s.setInvestorProfitPct);
  const donationPct = useSettingsStore((s) => s.donationPct);
  const setDonationPct = useSettingsStore((s) => s.setDonationPct);

  const onToggleReminder = (key: ReminderKey, value: boolean) => {
    setReminder(key, value);
    rescheduleReminders({ ...reminders, [key]: value }).catch(swallow('settings:rescheduleReminders'));
  };

  /**
   * Switch language and, when the layout direction changes (Urdu = RTL,
   * English = LTR), reload so the whole app mirrors. The choice is already
   * persisted, so it survives the reload.
   */
  const onChangeLanguage = (lang: Language) => {
    setLanguage(lang);
    setLangSheetOpen(false);
    if (syncLayoutDirection(lang)) {
      Alert.alert(t('language'), t('restartForRtl'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('done'), onPress: () => void reloadApp() },
      ]);
    }
  };

  const REMINDER_ROWS: { key: ReminderKey; labelKey: TranslationKey }[] = [
    { key: 'daily', labelKey: 'remDaily' },
    { key: 'deadline', labelKey: 'remDeadline' },
    { key: 'udhaar', labelKey: 'remUdhaar' },
    { key: 'buyer', labelKey: 'remBuyer' },
  ];

  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const setFontFamily = useSettingsStore((s) => s.setFontFamily);
  const fontScale = useSettingsStore((s) => s.fontScale);
  const setFontScale = useSettingsStore((s) => s.setFontScale);
  const homeSections = useSettingsStore((s) => s.homeSections);
  const setHomeSection = useSettingsStore((s) => s.setHomeSection);

  /** Optional Home sections (the essentials always show) — labels reuse the
   *  app's own terms. */
  const HOME_ROWS: { key: HomeSectionKey; labelKey: TranslationKey }[] = [
    { key: 'activity', labelKey: 'recentActivity' },
    { key: 'plots', labelKey: 'plotsTitle' },
    { key: 'labor', labelKey: 'laborTitle' },
    { key: 'udhaar', labelKey: 'udhaar' },
  ];

  const FONT_SIZE_LABEL: Record<FontScaleKey, TranslationKey> = {
    small: 'fsSmall',
    normal: 'fsNormal',
    large: 'fsLarge',
    xl: 'fsXL',
  };

  const [langSheetOpen, setLangSheetOpen] = useState(false);
  const [companySheetOpen, setCompanySheetOpen] = useState(false);
  const [fontSheetOpen, setFontSheetOpen] = useState(false);
  const [sizeSheetOpen, setSizeSheetOpen] = useState(false);

  const fontOptions = useMemo<SelectOption[]>(
    () =>
      (Object.keys(FONT_OPTIONS) as FontKey[]).map((key) => ({
        id: key,
        label: FONT_OPTIONS[key].label,
        icon: 'language' as IconKey,
      })),
    []
  );

  const sizeOptions = useMemo<SelectOption[]>(
    () =>
      (Object.keys(FONT_SCALES) as FontScaleKey[]).map((key) => ({
        id: key,
        label: t(FONT_SIZE_LABEL[key]),
        icon: 'language' as IconKey,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t]
  );

  const companies = useCompanyStore((st) => st.companies);
  const activeCompanyId = useCompanyStore((st) => st.activeCompanyId);
  const switchTo = useCompanyStore((st) => st.switchTo);
  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? null;

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

  /** Language options for the bottom-sheet picker. */
  const languageOptions = useMemo<SelectOption[]>(
    () => [
      { id: 'ur', label: t('urdu'), icon: 'language' },
      { id: 'en', label: t('english'), icon: 'language' },
    ],
    [t]
  );

  const languageLabels: Record<Language, string> = {
    ur: t('urdu'),
    en: t('english'),
  };
  const currentLanguageLabel = languageLabels[language];
  const appVersion = APP_VERSION;

  return (
    <View style={styles.screen}>
      <AppHeader title={t('settings')} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* "Go to…" — navigation entries, separated from preferences below. */}
        <AppText size="sm" weight="bold" color="textSecondary" style={styles.sectionTitle}>
          {t('goToSection')}
        </AppText>
        <AppCard compact>
          {/* Company  the active workspace; switch or create another */}
          <SettingRow
            icon="projects"
            label={t('companyTitle')}
            value={activeCompany?.name ?? ''}
            onPress={() => setCompanySheetOpen(true)}
          />

          <Divider />

          {/* Accounts  cash / bank / wallet balances. The single entry point
              for account management (Udhaar lives in the Cash hub, not here). */}
          <SettingRow
            icon="balance"
            label={t('accountsTitle')}
            onPress={() => navigation.navigate('Accounts')}
          />

          <Divider />

          {/* Reports hub */}
          <SettingRow
            icon="reports"
            label={t('reports')}
            onPress={() => navigation.navigate('Reports')}
          />

          <Divider />

          {/* Categories & materials manager */}
          <SettingRow
            icon="ledger"
            label={t('manageCategories')}
            onPress={() => navigation.navigate('Categories')}
          />

          <Divider />

          {/* Display statuses for projects & plots */}
          <SettingRow
            icon="tag"
            label={t('statusesTitle')}
            onPress={() => navigation.navigate('Statuses')}
          />
        </AppCard>

        {/* Preferences — language, theme, type, version. */}
        <AppText size="sm" weight="bold" color="textSecondary" style={styles.sectionTitle}>
          {t('preferencesSection')}
        </AppText>
        <AppCard compact>
          {/* Language  opens the big-row picker sheet */}
          <SettingRow
            icon="language"
            label={t('language')}
            value={currentLanguageLabel}
            onPress={() => setLangSheetOpen(true)}
          />

          <Divider />

          {/* Dark mode  structure ready, light is the default */}
          <SettingRow
            icon="moon"
            label={t('darkMode')}
            trailing={
              <AppToggle value={darkMode} onValueChange={setDarkMode} accessibilityLabel={t('darkMode')} />
            }
          />

          <Divider />

          {/* Font family  re-themes every screen instantly */}
          <SettingRow
            icon="font"
            label={t('fontFamilyLabel')}
            value={FONT_OPTIONS[fontFamily].label}
            onPress={() => setFontSheetOpen(true)}
          />

          <Divider />

          {/* Text size  scales every size token app-wide */}
          <SettingRow
            icon="textSize"
            label={t('fontSizeLabel')}
            value={t(FONT_SIZE_LABEL[fontScale])}
            onPress={() => setSizeSheetOpen(true)}
          />

          <Divider />

          {/* Version  read-only */}
          <SettingRow
            icon="settings"
            label={t('appVersion')}
            value={appVersion}
            onLongPress={() => navigation.navigate('DevTools')}
          />
        </AppCard>

        {/* Home screen  choose which sections Home shows */}
        <AppText size="sm" weight="bold" color="textSecondary" style={styles.sectionTitle}>
          {t('homeSettingsTitle')}
        </AppText>
        <AppCard compact>
          {HOME_ROWS.map((r, i) => (
            <View key={r.key}>
              {i > 0 ? <Divider /> : null}
              <SettingRow
                icon="home"
                label={t(r.labelKey)}
                trailing={
                  <AppToggle
                    value={homeSections[r.key]}
                    onValueChange={(v) => setHomeSection(r.key, v)}
                    accessibilityLabel={t(r.labelKey)}
                  />
                }
              />
            </View>
          ))}
        </AppCard>

        {/* Reminders */}
        <AppText size="sm" weight="bold" color="textSecondary" style={styles.sectionTitle}>
          {t('reminders')}
        </AppText>
        <AppCard compact>
          {REMINDER_ROWS.map((r, i) => (
            <View key={r.key}>
              {i > 0 ? <Divider /> : null}
              <SettingRow
                icon="bell"
                label={t(r.labelKey)}
                trailing={
                  <AppToggle
                    value={reminders[r.key]}
                    onValueChange={(v) => onToggleReminder(r.key, v)}
                    accessibilityLabel={t(r.labelKey)}
                  />
                }
              />
            </View>
          ))}
        </AppCard>
        {/* Profit sharing  global default investor % (loss always by capital) */}
        <AppText size="sm" weight="bold" color="textSecondary" style={styles.sectionTitle}>
          {t('profitSharing')}
        </AppText>
        <AppCard compact>
          <View style={styles.row}>
            <View style={styles.iconChip}>
              <AppIcon name="investor" size={24} color="primary" />
            </View>
            <AppText size="md" weight="semibold" style={styles.rowLabel}>
              {t('investorProfitShare')}
            </AppText>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => setInvestorProfitPct(investorProfitPct - 5)}
                hitSlop={theme.touch.hitSlop}
                accessibilityRole="button"
                accessibilityLabel="-5%"
                style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
              >
                <AppText size="lg" weight="bold" color="primary">
                  −
                </AppText>
              </Pressable>
              <AppText size="md" weight="bold" tabular style={styles.stepValue}>
                {investorProfitPct}%
              </AppText>
              <Pressable
                onPress={() => setInvestorProfitPct(investorProfitPct + 5)}
                hitSlop={theme.touch.hitSlop}
                accessibilityRole="button"
                accessibilityLabel="+5%"
                style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
              >
                <AppText size="lg" weight="bold" color="primary">
                  +
                </AppText>
              </Pressable>
            </View>
          </View>
          <AppText size="xs" color="textSecondary" style={styles.note}>
            {t('profitShareNote')}
          </AppText>

          <Divider />

          {/* Donation %  charity share deducted from each profit */}
          <View style={styles.row}>
            <View style={styles.iconChip}>
              <AppIcon name="investor" size={24} color="primary" />
            </View>
            <AppText size="md" weight="semibold" style={styles.rowLabel}>
              {t('donationPctLabel')}
            </AppText>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => setDonationPct(donationPct - 1)}
                hitSlop={theme.touch.hitSlop}
                accessibilityRole="button"
                accessibilityLabel="-1%"
                style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
              >
                <AppText size="lg" weight="bold" color="primary">
                  −
                </AppText>
              </Pressable>
              <AppText size="md" weight="bold" tabular style={styles.stepValue}>
                {donationPct}%
              </AppText>
              <Pressable
                onPress={() => setDonationPct(donationPct + 1)}
                hitSlop={theme.touch.hitSlop}
                accessibilityRole="button"
                accessibilityLabel="+1%"
                style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
              >
                <AppText size="lg" weight="bold" color="primary">
                  +
                </AppText>
              </Pressable>
            </View>
          </View>
          <AppText size="xs" color="textSecondary" style={styles.note}>
            {t('donationNote')}
          </AppText>
        </AppCard>
      </ScrollView>

      <SelectSheet
        visible={companySheetOpen}
        onClose={() => setCompanySheetOpen(false)}
        options={companyOptions}
        selectedId={activeCompanyId ?? undefined}
        title={t('switchCompany')}
        searchable={false}
        onSelect={(o) => {
          if (o.id === NEW_COMPANY_ID) navigation.navigate('NewCompany');
          else switchTo(o.id).catch(swallow('settings:switchCompany'));
        }}
      />

      <SelectSheet
        visible={langSheetOpen}
        onClose={() => setLangSheetOpen(false)}
        options={languageOptions}
        selectedId={language}
        title={t('language')}
        searchable={false}
        onSelect={(option) => onChangeLanguage(option.id as Language)}
      />

      <SelectSheet
        visible={fontSheetOpen}
        onClose={() => setFontSheetOpen(false)}
        options={fontOptions}
        selectedId={fontFamily}
        title={t('fontFamilyLabel')}
        searchable={false}
        onSelect={(option) => setFontFamily(option.id as FontKey)}
      />

      <SelectSheet
        visible={sizeSheetOpen}
        onClose={() => setSizeSheetOpen(false)}
        options={sizeOptions}
        selectedId={fontScale}
        title={t('fontSizeLabel')}
        searchable={false}
        onSelect={(option) => setFontScale(option.id as FontScaleKey)}
      />
    </View>
  );
}

/* ------------------------------ helpers --------------------------------- */

interface SettingRowProps {
  icon: IconKey;
  label: string;
  /** Read-only value shown on the right (mutually exclusive with `trailing`). */
  value?: string;
  /** Custom trailing control (e.g. a Switch). */
  trailing?: React.ReactNode;
  onPress?: () => void;
  /** Hidden affordance (e.g. long-press app version to open Dev Tools). */
  onLongPress?: () => void;
}

/** One settings line: leading icon chip + label, optional value / control. */
function SettingRow({
  icon,
  label,
  value,
  trailing,
  onPress,
  onLongPress,
}: SettingRowProps): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const body = (
    <View style={styles.row}>
      <View style={styles.iconChip}>
        <AppIcon name={icon} size={24} color="primary" />
      </View>
      <AppText size="md" weight="semibold" style={styles.rowLabel}>
        {label}
      </AppText>
      {trailing ? (
        trailing
      ) : (
        <View style={styles.valueWrap}>
          {value ? (
            <AppText size="md" color="textSecondary">
              {value}
            </AppText>
          ) : null}
          {onPress ? <AppIcon name="forward" size={22} color="textSecondary" /> : null}
        </View>
      )}
    </View>
  );

  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={theme.touch.hitSlop}
        style={({ pressed }) => (pressed ? styles.pressed : undefined)}
      >
        {body}
      </Pressable>
    );
  }
  return body;
}

function Divider(): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return <View style={styles.divider} />;
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    sectionTitle: {
      marginTop: theme.spacing.sm,
    },
    row: {
      minHeight: theme.touch.minTarget,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    iconChip: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowLabel: {
      flex: 1,
    },
    valueWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
    },
    pressed: {
      opacity: 0.6,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    stepBtn: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepValue: {
      minWidth: 48,
      textAlign: 'center',
    },
    note: {
      marginTop: theme.spacing.sm,
      marginLeft: 52,
    },
  });
