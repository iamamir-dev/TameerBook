import React, { createContext, useMemo, type ReactNode } from 'react';

import { useSettingsStore } from '@/stores/useSettingsStore';

import { getTheme, lightTheme, type Theme } from './theme';

/**
 * Context that carries the active Theme down the tree. Defaults to the light
 * theme so any accidental use outside the provider still renders sensibly.
 */
export const ThemeContext = createContext<Theme>(lightTheme);

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Wraps the app and composes the theme from the settings store: light/dark,
 * the chosen font family, and the text-size step. Because it subscribes to
 * those flags, changing any of them re-themes EVERY component that reads
 * `useTheme()`  no prop drilling, no per-screen styles.
 */
export function ThemeProvider({ children }: ThemeProviderProps): React.JSX.Element {
  const darkMode = useSettingsStore((state) => state.darkMode);
  const fontFamily = useSettingsStore((state) => state.fontFamily);
  const fontScale = useSettingsStore((state) => state.fontScale);

  const theme = useMemo<Theme>(
    () => getTheme(darkMode ? 'dark' : 'light', fontFamily, fontScale),
    [darkMode, fontFamily, fontScale]
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
