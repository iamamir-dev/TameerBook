import { useFonts } from 'expo-font';
import {
  DefaultTheme,
  NavigationContainer,
  type Theme as NavTheme,
} from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary, ErrorFallback } from '@/components/ErrorBoundary';
import { AppText } from '@/components/ui';
import { initDatabase } from '@/db/database';
import { useTranslation } from '@/i18n';
import { RootNavigator } from '@/navigation/RootNavigator';
import { rescheduleReminders } from '@/notifications/reminders';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { ThemeProvider, useTheme } from '@/theme';
import { reportError, swallow } from '@/utils/log';
import { reloadApp, syncLayoutDirection } from '@/utils/rtl';

/** Minimum time (ms) the branded splash stays up so it never just flickers. */
const SPLASH_MIN_MS = 1300;

/**
 * The in-app branded splash: charcoal canvas, the app logo settling in with a
 * soft ease-out (a gentle fade + scale-up, no bounce) and the wordmark rising
 * beneath it after a short beat. Shown while the database initializes (and at
 * least SPLASH_MIN_MS so the entrance reads as intended).
 */
function Splash(): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();

  // Two eased 0→1 drivers, the wordmark staggered a beat behind the logo, so
  // the entrance reads as one soft choreographed settle (no spring bounce).
  const logo = useSharedValue(0);
  const word = useSharedValue(0);
  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    logo.value = withTiming(1, { duration: 640, easing: ease });
    word.value = withDelay(240, withTiming(1, { duration: 520, easing: ease }));
  }, [logo, word]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logo.value,
    transform: [
      // 0.86 → 1 scale + a small downward settle: the mark eases into place.
      { scale: 0.86 + logo.value * 0.14 },
      { translateY: (1 - logo.value) * -12 },
    ],
  }));

  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: (1 - word.value) * 10 }],
  }));

  return (
    <Animated.View
      exiting={FadeOut.duration(360)}
      style={[styles.splash, { backgroundColor: theme.colors.heroBg }]}
    >
      <Animated.View style={[styles.splashBadge, logoStyle]}>
        {/* The real app icon, rounded like the launcher tile. */}
        <Image
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          source={require('./assets/icon.png')}
          style={styles.splashLogo}
          resizeMode="cover"
        />
      </Animated.View>
      <Animated.View style={wordStyle}>
        <AppText size="xxl" weight="bold" color="onHero">
          {t('appName')}
        </AppText>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Inner app  lives INSIDE ThemeProvider so it can read `useTheme()` and feed
 * the matching palette to React Navigation. Gates on boot state:
 * splash (booting) → onboarding (no company yet) → the app.
 */
function ThemedApp(): React.JSX.Element {
  const theme = useTheme();
  const [booted, setBooted] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [bootError, setBootError] = useState(false);
  const [bootErrorDetail, setBootErrorDetail] = useState<string | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);
  const companyReady = useCompanyStore((s) => s.ready);
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const switchCount = useCompanyStore((s) => s.switchCount);

  useEffect(() => {
    const start = Date.now();
    // Create tables once on launch, hydrate settings + the active company,
    // then (re)schedule local reminders from the restored preferences.
    initDatabase()
      .then(() => useSettingsStore.getState().hydrate())
      .then(() => {
        // Align layout direction (RTL for Urdu) with the restored language.
        // If the native flag was out of sync, reload so it applies — this
        // self-heals and runs at most once (after reload it already matches).
        if (syncLayoutDirection(useSettingsStore.getState().language)) {
          void reloadApp();
          return new Promise<never>(() => {}); // hold here; the reload takes over
        }
      })
      .then(() => useCompanyStore.getState().hydrate())
      // Reminders are a NON-critical subsystem: skip without a company (fresh
      // install boots straight to onboarding) and never fail the boot for them.
      .then(() =>
        useCompanyStore.getState().activeCompanyId
          ? rescheduleReminders(useSettingsStore.getState().reminders).catch(swallow('App:reminders'))
          : undefined
      )
      // A boot failure used to be swallowed, leaving the splash up forever.
      // Now it's logged and the user gets a retry screen instead.
      .catch((e) => {
        reportError('App:boot', e);
        // Surface the reason on the retry screen — release builds have no
        // console, so without this a boot crash is an opaque "try again".
        const msg = e instanceof Error ? (e.stack || e.message) : String(e);
        setBootErrorDetail(msg);
        setBootError(true);
      })
      .finally(() => {
        setBooted(true);
        const remaining = Math.max(0, SPLASH_MIN_MS - (Date.now() - start));
        setTimeout(() => setSplashDone(true), remaining);
      });
  }, [bootAttempt]);

  const navTheme: NavTheme = {
    ...DefaultTheme,
    dark: theme.darkMode,
    colors: {
      ...DefaultTheme.colors,
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.card,
      text: theme.colors.textPrimary,
      border: theme.colors.border,
      notification: theme.colors.accent,
    },
  };

  const showSplash = !bootError && (!booted || !splashDone || !companyReady);
  const needsOnboarding = !showSplash && !bootError && !activeCompanyId;

  return (
    <View style={styles.flex}>
      <StatusBar style={showSplash || theme.darkMode ? 'light' : 'dark'} />
      {bootError && booted ? (
        <ErrorFallback
          detail={bootErrorDetail}
          onRetry={() => {
            setBootError(false);
            setBootErrorDetail(null);
            setBooted(false);
            setBootAttempt((n) => n + 1);
          }}
        />
      ) : showSplash ? (
        <Splash />
      ) : needsOnboarding ? (
        <OnboardingScreen
          onDone={() => {
            // createCompany already activated it — re-hydrate, then schedule
            // the reminders boot skipped while no company existed.
            void useCompanyStore
              .getState()
              .hydrate()
              .then(() => rescheduleReminders(useSettingsStore.getState().reminders))
              .catch(swallow('App:onboarding-hydrate'));
          }}
        />
      ) : (
        // Re-key the whole tree on company switch so every screen refetches.
        <NavigationContainer key={`${activeCompanyId}-${switchCount}`} theme={navTheme}>
          <ErrorBoundary>
            <RootNavigator />
          </ErrorBoundary>
        </NavigationContainer>
      )}
    </View>
  );
}

/**
 * App root. Loads the M PLUS Rounded 1c font families (the theme references them by name,
 * so nothing renders until they're ready), then mounts the provider stack:
 *
 *   GestureHandlerRootView → SafeAreaProvider → ThemeProvider → ThemedApp
 */
export default function App(): React.JSX.Element {
  // Every selectable family (Settings → Font) loads up front, so switching
  // fonts re-themes instantly with no flash of fallback text. These are
  // LOCAL Latin-subset files (assets/fonts) — the Google-font packages ship
  // full CJK/Cyrillic glyph sets (M PLUS alone was ~10 MB); the subsets are
  // ~70 KB each. Urdu script falls back to the OS font per-glyph as before.
  const [fontsLoaded] = useFonts({
    MPLUSRounded1c_500Medium: require('./assets/fonts/MPLUSRounded1c_500Medium.ttf'),
    MPLUSRounded1c_700Bold: require('./assets/fonts/MPLUSRounded1c_700Bold.ttf'),
    MPLUSRounded1c_800ExtraBold: require('./assets/fonts/MPLUSRounded1c_800ExtraBold.ttf'),
    Baloo2_500Medium: require('./assets/fonts/Baloo2_500Medium.ttf'),
    Baloo2_700Bold: require('./assets/fonts/Baloo2_700Bold.ttf'),
    Baloo2_800ExtraBold: require('./assets/fonts/Baloo2_800ExtraBold.ttf'),
    Fraunces_500Medium: require('./assets/fonts/Fraunces_500Medium.ttf'),
    Fraunces_700Bold: require('./assets/fonts/Fraunces_700Bold.ttf'),
    Fraunces_800ExtraBold: require('./assets/fonts/Fraunces_800ExtraBold.ttf'),
    Inter_500Medium: require('./assets/fonts/Inter_500Medium.ttf'),
    Inter_700Bold: require('./assets/fonts/Inter_700Bold.ttf'),
    Inter_800ExtraBold: require('./assets/fonts/Inter_800ExtraBold.ttf'),
    // Urdu / Arabic-script families (subset to the Arabic ranges).
    NotoNaskhArabic_400Regular: require('./assets/fonts/NotoNaskhArabic_400Regular.ttf'),
    NotoNaskhArabic_500Medium: require('./assets/fonts/NotoNaskhArabic_500Medium.ttf'),
    NotoNaskhArabic_700Bold: require('./assets/fonts/NotoNaskhArabic_700Bold.ttf'),
    NotoSansArabic_500Medium: require('./assets/fonts/NotoSansArabic_500Medium.ttf'),
    NotoSansArabic_700Bold: require('./assets/fonts/NotoSansArabic_700Bold.ttf'),
    NotoSansArabic_800ExtraBold: require('./assets/fonts/NotoSansArabic_800ExtraBold.ttf'),
    NotoNastaliqUrdu_400Regular: require('./assets/fonts/NotoNastaliqUrdu_400Regular.ttf'),
    NotoNastaliqUrdu_500Medium: require('./assets/fonts/NotoNastaliqUrdu_500Medium.ttf'),
    NotoNastaliqUrdu_700Bold: require('./assets/fonts/NotoNastaliqUrdu_700Bold.ttf'),
    Gulzar_400Regular: require('./assets/fonts/Gulzar_400Regular.ttf'),
  });

  if (!fontsLoaded) {
    // Match the splash canvas so launch feels seamless (no white flash).
    return <View style={[styles.flex, { backgroundColor: '#1D1C18' }]} />;
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedApp />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  splashBadge: {
    width: 116,
    height: 116,
    borderRadius: 30,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    width: '100%',
    height: '100%',
  },
});
