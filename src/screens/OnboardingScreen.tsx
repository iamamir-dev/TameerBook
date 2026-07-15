import React, { useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { AmountInput, AppButton, AppIcon, AppText, type IconKey } from '@/components/ui';
import { createCompany } from '@/db';
import { useTranslation } from '@/i18n';
import { swallow } from '@/utils/log';
import { captureReceipt } from '@/utils/photo';
import type { Language } from '@/i18n/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTheme } from '@/theme';
import type { ColorPalette, Theme } from '@/theme/theme';
import { reloadApp, syncLayoutDirection } from '@/utils/rtl';

type Phase = 'guide' | 'setup';

interface GuideSlide {
  /** Brand slide renders the real logo mark instead of an icon chip. */
  brand?: boolean;
  icon: IconKey;
  /** Theme color key for the icon stroke. */
  tone: keyof ColorPalette;
  /** Theme color key for the soft tinted circle behind the icon. */
  toneSoft: keyof ColorPalette;
  title: string;
  body: string;
}

/**
 * First-run onboarding  two phases in one standalone screen:
 *
 *  1. GUIDE  a paged, swipeable intro (welcome + cash / plots / projects /
 *     reports) with a persistent Skip, a stretching-dot indicator, and a
 *     full-width primary CTA.
 *  2. SETUP  a guided company form (only the name is required; owner, phone
 *     and opening cash are clearly optional with helper hints). `createCompany`
 *     seeds the default Cash-in-Hand account and activates the company, then
 *     `onDone()` hands control back to the app shell.
 */
export function OnboardingScreen({ onDone }: { onDone: () => void }): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  // Switch language during onboarding so an Urdu-first user isn't stuck in
  // English. Flipping to/from Urdu changes layout direction (RTL), which needs
  // a reload to apply — the reload just drops back into onboarding, translated.
  const onPickLanguage = (lang: Language) => {
    if (lang === language) return;
    setLanguage(lang);
    if (syncLayoutDirection(lang)) void reloadApp();
  };
  const styles = makeStyles(theme);
  const { width } = useWindowDimensions();

  const [phase, setPhase] = useState<Phase>('guide');
  const [page, setPage] = useState(0);
  const pagerRef = useRef<ScrollView>(null);

  /* --------------------------- setup form state -------------------------- */
  const [companyName, setCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);

  const pickLogo = async () => {
    const uri = await captureReceipt().catch(swallow('onboarding:logo'));
    if (uri) setLogoUri(uri);
  };
  const [phone, setPhone] = useState('');
  const [openingCash, setOpeningCash] = useState(0);
  const [saving, setSaving] = useState(false);

  const slides: GuideSlide[] = [
    { brand: true, icon: 'projects', tone: 'primary', toneSoft: 'primarySoft', title: t('appName'), body: t('obWelcomeBody') },
    { icon: 'balance', tone: 'accent', toneSoft: 'accentSoft', title: t('obCashTitle'), body: t('obCashBody') },
    { icon: 'plot', tone: 'gold', toneSoft: 'goldSoft', title: t('obPlotsTitle'), body: t('obPlotsBody') },
    { icon: 'projects', tone: 'primary', toneSoft: 'primarySoft', title: t('obProjectsTitle'), body: t('obProjectsBody') },
    { icon: 'dehari', tone: 'accent', toneSoft: 'accentSoft', title: t('obLaborTitle'), body: t('obLaborBody') },
    { icon: 'investors', tone: 'gold', toneSoft: 'goldSoft', title: t('obInvestorsTitle'), body: t('obInvestorsBody') },
    { icon: 'reports', tone: 'success', toneSoft: 'successSoft', title: t('obReportsTitle'), body: t('obReportsBody') },
  ];
  const lastPage = slides.length - 1;

  const goToPage = (index: number) => {
    const clamped = Math.max(0, Math.min(lastPage, index));
    pagerRef.current?.scrollTo({ x: clamped * width, animated: true });
    setPage(clamped);
  };

  const onNext = () => {
    if (page >= lastPage) setPhase('setup');
    else goToPage(page + 1);
  };

  const canCreate = companyName.trim().length > 0;

  const onCreate = async () => {
    const name = companyName.trim();
    if (!name || saving) return;
    setSaving(true);
    try {
      await createCompany({
        logoUri,
        name,
        ownerName: ownerName.trim() || null,
        phone: phone.trim() || null,
        openingCash,
      });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------- PHASE 2 -------------------------------- */
  if (phase === 'setup') {
    return (
      <View style={styles.screen}>
        {/* Back to the guide carousel */}
        <View style={[styles.setupHeader, { paddingTop: insets.top + theme.spacing.sm }]}>
          <Pressable
            onPress={() => setPhase('guide')}
            hitSlop={theme.touch.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={t('back')}
            style={({ pressed }) => [styles.backChip, pressed && styles.pressed]}
          >
            <AppIcon name="back" size={24} color="textPrimary" />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={[
              styles.setupContent,
              { paddingBottom: insets.bottom + theme.spacing.xxxl },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View entering={FadeInDown.duration(360)} style={styles.setupForm}>
              {/* Header  logo mark + welcome copy */}
              <View style={styles.setupIntro}>
                <Image
                  // eslint-disable-next-line @typescript-eslint/no-var-requires
                  source={require('../../assets/android-icon-foreground.png')}
                  style={styles.setupLogo}
                  resizeMode="contain"
                />
                <AppText size="overline" weight="semibold" color="accent" uppercase>
                  {t('setupFinalStep')}
                </AppText>
                <AppText size="xxl" weight="bold" center>
                  {t('companySetupTitle')}
                </AppText>
                <AppText size="sm" color="textSecondary" center style={styles.setupBody}>
                  {t('companySetupBody')}
                </AppText>
              </View>


              {/* Company logo — tap to add/replace (optional). */}
              <Pressable onPress={pickLogo} accessibilityRole="button" accessibilityLabel={t('photo')} style={stylesLogo.picker}>
                {logoUri ? (
                  <Image source={{ uri: logoUri }} style={stylesLogo.logo} />
                ) : (
                  <View style={stylesLogo.fallback}>
                    <AppIcon name="projects" size={26} color="primary" />
                  </View>
                )}
                <View style={stylesLogo.badge}>
                  <AppIcon name="camera" size={14} color="onAccent" />
                </View>
              </Pressable>

              {/* Required */}
              <FloatingLabelInput
                label={t('companyName')}
                value={companyName}
                onChangeText={setCompanyName}
                hint={t('companyNameHint')}
              />

              {/* Optional group */}
              <AppText size="overline" weight="semibold" color="textSecondary" uppercase style={styles.groupLabel}>
                {t('optionalDetails')}
              </AppText>
              <FloatingLabelInput label={t('ownerName')} value={ownerName} onChangeText={setOwnerName} />
              <FloatingLabelInput
                label={t('phone')}
                value={phone}
                onChangeText={setPhone}
                mask="phone"
                hint={t('hintPhone')}
              />
              <AmountInput
                floating
                surface={theme.colors.background}
                label={t('openingCash')}
                value={openingCash}
                onChange={setOpeningCash}
              />
              <AppText size="xs" color="textSecondary" style={styles.fieldHint}>
                {t('openingCashHint')}
              </AppText>

              <View style={styles.createBtn}>
                <AppButton
                  label={t('createCompanyLabel')}
                  icon="check"
                  onPress={onCreate}
                  loading={saving}
                  disabled={!canCreate}
                />
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  /* ------------------------------- PHASE 1 -------------------------------- */
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Persistent Skip (hidden on the last slide, where the CTA takes over) */}
      <View style={styles.topBar}>
        {/* Language toggle so an Urdu-first user can read onboarding in Urdu. */}
        <View style={styles.langToggle}>
          {(['en', 'ur'] as Language[]).map((lang) => {
            const active = language === lang;
            return (
              <Pressable
                key={lang}
                onPress={() => onPickLanguage(lang)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.langChip, active && styles.langChipActive]}
              >
                <AppText size="xs" weight="bold" color={active ? 'onAccent' : 'textSecondary'}>
                  {lang === 'en' ? 'English' : 'اردو'}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        {page < lastPage ? (
          <Pressable
            onPress={() => setPhase('setup')}
            hitSlop={theme.touch.hitSlop}
            accessibilityRole="button"
            style={({ pressed }) => [styles.skipTop, pressed && styles.pressed]}
          >
            <AppText size="sm" weight="semibold" color="textSecondary">
              {t('obSkip')}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setPage(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width)))
        }
        contentOffset={{ x: page * width, y: 0 }}
        style={styles.flex}
      >
        {slides.map((slide, index) => (
          <View key={slide.title} style={[styles.slide, { width }]}>
            <Animated.View
              entering={FadeInDown.delay(index === 0 ? 80 : 0).duration(420)}
              style={styles.slideInner}
            >
              {slide.brand ? (
                <Image
                  // eslint-disable-next-line @typescript-eslint/no-var-requires
                  source={require('../../assets/android-icon-foreground.png')}
                  style={styles.brandLogo}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.circleWrap}>
                  <View
                    style={[styles.slideCircle, { backgroundColor: theme.colors[slide.toneSoft] }]}
                  >
                    <AppIcon name={slide.icon} size={ICON_SIZE} color={slide.tone} />
                  </View>
                </View>
              )}
              <AppText size={slide.brand ? 'display' : 'xxl'} weight="bold" center>
                {slide.title}
              </AppText>
              <AppText size="md" color="textSecondary" center style={styles.slideBody}>
                {slide.body}
              </AppText>
            </Animated.View>
          </View>
        ))}
      </ScrollView>

      {/* Dots + full-width CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
        <View style={styles.dots}>
          {slides.map((slide, index) => (
            <Dot key={slide.title} active={index === page} />
          ))}
        </View>
        <Animated.View entering={FadeIn.duration(300)} style={styles.ctaWrap}>
          <AppButton
            label={t(page === lastPage ? 'obGetStarted' : 'next')}
            icon={page === lastPage ? 'check' : 'forward'}
            onPress={onNext}
          />
        </Animated.View>
      </View>
    </View>
  );
}

/** One page-indicator dot  the active one stretches into an accent pill. */
function Dot({ active }: { active: boolean }): React.JSX.Element {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const animated = useAnimatedStyle(
    () => ({ width: withTiming(active ? DOT_ACTIVE_WIDTH : DOT_SIZE, { duration: 220 }) }),
    [active]
  );
  return <Animated.View style={[styles.dot, active && styles.dotActive, animated]} />;
}

/* Structural constants (like AppHeader's CHIP)  visual tokens stay in theme. */
const ICON_SIZE = 56;
const CIRCLE = 132;
const CIRCLE_RING = 156;
const BRAND_BADGE = 96;
const DOT_SIZE = 8;
const DOT_ACTIVE_WIDTH = 24;
const BACK_CHIP = 46;

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    pressed: { opacity: 0.6 },

    /* top bar (Skip) */
    topBar: {
      height: theme.touch.minTarget,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
    },
    skipTop: {
      minHeight: 40,
      paddingHorizontal: theme.spacing.md,
      justifyContent: 'center',
    },
    langToggle: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.pill,
      padding: 3,
    },
    langChip: {
      paddingVertical: 6,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.pill,
    },
    langChipActive: { backgroundColor: theme.colors.accent },

    /* guide carousel */
    slide: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.xl,
    },
    slideInner: {
      alignItems: 'center',
      gap: theme.spacing.lg,
    },
    circleWrap: {
      width: CIRCLE_RING,
      height: CIRCLE_RING,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.sm,
      ...theme.shadows.card,
    },
    slideCircle: {
      width: CIRCLE,
      height: CIRCLE,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    /* the real logo mark (transparent PNG) on the cream canvas */
    brandLogo: {
      width: BRAND_BADGE * 1.9,
      height: BRAND_BADGE * 1.9,
      marginBottom: theme.spacing.sm,
    },
    slideBody: {
      paddingHorizontal: theme.spacing.lg,
      lineHeight: theme.typography.lineHeights.lg,
    },

    /* dots */
    dots: {
      flexDirection: 'row',
      alignSelf: 'center',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.xl,
    },
    dot: {
      width: DOT_SIZE,
      height: DOT_SIZE,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.track,
    },
    dotActive: { backgroundColor: theme.colors.accent },

    /* footer */
    footer: {
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.sm,
    },
    ctaWrap: {},

    /* setup form */
    setupHeader: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
    },
    backChip: {
      width: BACK_CHIP,
      height: BACK_CHIP,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadows.card,
    },
    setupContent: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: theme.spacing.xl,
    },
    setupForm: {
      gap: theme.spacing.lg,
    },
    setupIntro: {
      alignItems: 'center',
      gap: theme.spacing.xs,
      marginBottom: theme.spacing.sm,
    },
    setupLogo: {
      width: 84,
      height: 84,
      marginBottom: theme.spacing.xs,
    },
    setupBody: {
      lineHeight: theme.typography.lineHeights.md,
      paddingHorizontal: theme.spacing.sm,
    },
    groupLabel: {
      letterSpacing: theme.typography.tracking,
      marginTop: theme.spacing.xs,
    },
    fieldHint: {
      marginTop: -theme.spacing.sm,
      marginLeft: theme.spacing.sm,
    },
    createBtn: {
      marginTop: theme.spacing.md,
    },
  });

/** Shared look for the tappable company-logo picker (both create forms). */
const stylesLogo = StyleSheet.create({
  picker: { alignSelf: 'center' },
  logo: { width: 72, height: 72, borderRadius: 20 },
  fallback: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(127,127,127,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
