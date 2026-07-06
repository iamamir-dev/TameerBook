import { useContext } from 'react';

import { ThemeContext } from './ThemeProvider';
import type { Theme } from './theme';

/**
 * The ONLY sanctioned way for components to read design tokens.
 *
 * Every color, font size, spacing value, radius, and shadow in the app comes
 * from the object returned here. If you find yourself typing a hex code or a
 * raw pixel number in a component, stop — add it to `theme.ts` instead.
 */
export const useTheme = (): Theme => useContext(ThemeContext);
