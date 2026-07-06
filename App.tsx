import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import {
  DefaultTheme,
  NavigationContainer,
  type Theme as NavTheme,
} from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initDatabase } from '@/db/database';
import { RootNavigator } from '@/navigation/RootNavigator';
import { rescheduleReminders } from '@/notifications/reminders';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { ThemeProvider, useTheme } from '@/theme';

/**
 * Inner app — lives INSIDE ThemeProvider so it can read `useTheme()` and feed
 * the matching palette to React Navigation (no white flash, consistent colors
 * in light/dark). The header now sits transparently on the canvas, so the
 * status bar follows the mode: dark icons on the light cream, light on dark.
 */
function ThemedApp(): React.JSX.Element {
  const theme = useTheme();

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

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={theme.darkMode ? 'light' : 'dark'} />
      <RootNavigator />
    </NavigationContainer>
  );
}

/**
 * App root. Loads the Inter font families (the theme references them by name,
 * so nothing renders until they're ready) and initializes the SQLite schema in
 * the background, then mounts the provider stack:
 *
 *   GestureHandlerRootView → SafeAreaProvider → ThemeProvider → Navigation
 */
export default function App(): React.JSX.Element {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    // Create tables once on launch, hydrate saved settings, then (re)schedule
    // local reminders from the (possibly restored) preferences.
    initDatabase()
      .then(() => useSettingsStore.getState().hydrate())
      .then(() => rescheduleReminders(useSettingsStore.getState().reminders))
      .catch(() => undefined);
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#1D1C18" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedApp />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
