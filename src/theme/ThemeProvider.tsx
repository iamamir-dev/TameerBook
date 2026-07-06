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
 * Wraps the app and selects light/dark from the settings store. Because it
 * subscribes to `darkMode`, toggling that flag re-themes EVERY component that
 * reads `useTheme()` — no prop drilling, no per-screen colors.
 */
export function ThemeProvider({ children }: ThemeProviderProps): React.JSX.Element {
  const darkMode = useSettingsStore((state) => state.darkMode);

  const theme = useMemo<Theme>(() => getTheme(darkMode ? 'dark' : 'light'), [darkMode]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
