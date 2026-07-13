/**
 * theme.ts  THE SINGLE SOURCE OF TRUTH for TameerBook's visual design.
 *
 * Design language: "Soft Modern"  quiet-premium feel. Warm cream canvas,
 * crisp white cards, a near-black charcoal brand (hero card, primary buttons),
 * a single muted emerald-green accent, warm-gray text, generously rounded
 * corners (nothing sharp), and ultra-soft diffuse shadows instead of borders.
 *
 * RULE: No screen or component may hardcode a color, font size, spacing value,
 * radius, or shadow. Everything is read from the `Theme` returned by
 * `useTheme()`. Change a value here and it changes everywhere.
 *
 * Light mode is the default. A dark palette is provided so the structure is
 * ready; flip `useSettingsStore.darkMode` to switch (wired in ThemeProvider).
 */

import type { TextStyle, ViewStyle } from 'react-native';

/* -------------------------------------------------------------------------- */
/*  Colors                                                                    */
/* -------------------------------------------------------------------------- */

export interface ColorPalette {
  /** Brand near-black charcoal  hero card, primary surfaces, key text. */
  primary: string;
  /** Muted emerald green  the "+" FAB, primary actions, highlights. */
  accent: string;
  /** Green  money coming IN (aamdani). */
  success: string;
  /** Red  money going OUT (kharcha). */
  danger: string;
  /** Gold  investor / profit accents. */
  gold: string;
  /** Soft off-white app canvas behind cards. */
  background: string;
  /** Card / surface background. */
  card: string;
  /** Primary text. */
  textPrimary: string;
  /** Secondary / muted text (lighter, softer). */
  textSecondary: string;
  /** Hairline borders / dividers  used sparingly, shadows do the lifting. */
  border: string;

  /** Text/icons on a primary (charcoal) surface. */
  onPrimary: string;
  /** ~62% white  captions on the charcoal hero. */
  onPrimaryMuted: string;
  /** ~45% white  faint subtitles on the charcoal hero. */
  onPrimaryFaint: string;
  /** Translucent white chip background on the hero (icon circles). */
  onPrimaryChip: string;
  /** Translucent white divider on the hero. */
  onPrimaryDivider: string;
  /** Text/icons on an accent (green) surface. */
  onAccent: string;

  /** Always-dark "hero" card surface (the premium LIVE-style card)  charcoal
   *  in BOTH light and dark mode, so it never inverts. */
  heroBg: string;
  /** Solid white text/icons on the hero  white in BOTH modes. */
  onHero: string;

  /** 10% soft tints  used as pastel icon-chip / pill backgrounds. */
  primarySoft: string;
  successSoft: string;
  dangerSoft: string;
  accentSoft: string;
  goldSoft: string;

  /** Track color for slim progress bars / muted fills. */
  track: string;
  /** Overlay/scrim behind modals and sheets. */
  overlay: string;
}

const lightColors: ColorPalette = {
  primary: '#1D1C18',
  accent: '#1FA15D',
  success: '#1FA15D',
  danger: '#D64C3C',
  gold: '#BE9B4A',
  background: '#FDFCF9',
  card: '#FFFFFF',
  textPrimary: '#211F1B',
  textSecondary: '#9A958B',
  border: '#EFECE4',

  onPrimary: '#FFFFFF',
  onPrimaryMuted: 'rgba(255,255,255,0.62)',
  onPrimaryFaint: 'rgba(255,255,255,0.45)',
  onPrimaryChip: 'rgba(255,255,255,0.12)',
  onPrimaryDivider: 'rgba(255,255,255,0.14)',
  onAccent: '#FFFFFF',

  heroBg: '#1D1C18',
  onHero: '#FFFFFF',

  primarySoft: '#EDEAE2',
  successSoft: '#E4F1E8',
  dangerSoft: '#FBE9E6',
  accentSoft: '#E4F1E8',
  goldSoft: '#F2EBD8',

  track: '#EFECE4',
  overlay: 'rgba(28, 27, 24, 0.45)',
};

const darkColors: ColorPalette = {
  // In dark mode `primary` is a LIGHT cream so primary-colored text/icons and
  // outline buttons read on the dark surfaces; `onPrimary` is dark (text that
  // sits ON a primary fill). The dark "hero" card uses heroBg/onHero instead,
  // so it stays charcoal-with-white in both modes.
  primary: '#EAE4D8',
  accent: '#2BB06E',
  success: '#2BB06E',
  danger: '#F0655A',
  gold: '#D8B85A',
  background: '#100F0C',
  card: '#1C1B16',
  textPrimary: '#F0ECE3',
  textSecondary: '#9C968A',
  border: '#2A2820',

  onPrimary: '#1B1A16',
  onPrimaryMuted: 'rgba(255,255,255,0.62)',
  onPrimaryFaint: 'rgba(255,255,255,0.45)',
  onPrimaryChip: 'rgba(255,255,255,0.12)',
  onPrimaryDivider: 'rgba(255,255,255,0.14)',
  onAccent: '#FFFFFF',

  heroBg: '#1D1C18',
  onHero: '#FFFFFF',

  primarySoft: '#2C2A22',
  successSoft: '#16301F',
  dangerSoft: '#341B19',
  accentSoft: '#16301F',
  goldSoft: '#322C18',

  track: '#2A2820',
  overlay: 'rgba(0, 0, 0, 0.62)',
};

/* -------------------------------------------------------------------------- */
/*  Gradients                                                                 */
/* -------------------------------------------------------------------------- */

export interface Gradients {
  /** Warm charcoal pair for the hero balance card (expo-linear-gradient). */
  hero: readonly [string, string];
}

const lightGradients: Gradients = { hero: ['#2A2820', '#16150F'] };
const darkGradients: Gradients = { hero: ['#262420', '#131210'] };

/* -------------------------------------------------------------------------- */
/*  Typography                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Font sizes. Content text never goes below `xs` (13) per the UX rules.
 * `overline` (11) is reserved ONLY for the uppercase, letter-spaced micro
 * captions (e.g. "TOTAL BALANCE")  a decorative label, not reading content.
 */
export const fontSizes = {
  overline: 11,
  xs: 13,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 34,
} as const;

/**
 * Selectable font families (Settings → Font). RN doesn't reliably apply
 * numeric fontWeight to custom fonts on Android, so each weight token maps to
 * a concrete family name. Every option keeps the app's one-cut-heavier rule:
 * body = Medium 500, "semibold" = Bold 700, "bold" = ExtraBold 800.
 *
 * The first four are Latin-first (Urdu glyphs fall back to the OS font). The
 * `urdu*` families render Urdu/Arabic script properly — pick one when using
 * the app in Urdu. `isUrdu` flags them for grouping in the picker.
 */
export const FONT_OPTIONS = {
  rounded: {
    label: 'M PLUS Rounded',
    regular: 'MPLUSRounded1c_500Medium',
    semibold: 'MPLUSRounded1c_700Bold',
    bold: 'MPLUSRounded1c_800ExtraBold',
  },
  baloo: {
    label: 'Baloo 2',
    regular: 'Baloo2_500Medium',
    semibold: 'Baloo2_700Bold',
    bold: 'Baloo2_800ExtraBold',
  },
  serif: {
    label: 'Fraunces',
    regular: 'Fraunces_500Medium',
    semibold: 'Fraunces_700Bold',
    bold: 'Fraunces_800ExtraBold',
  },
  inter: {
    label: 'Inter',
    regular: 'Inter_500Medium',
    semibold: 'Inter_700Bold',
    bold: 'Inter_800ExtraBold',
  },
  // Urdu / Arabic-script families.
  urduNaskh: {
    label: 'اردو — Naskh',
    isUrdu: true,
    regular: 'NotoNaskhArabic_400Regular',
    semibold: 'NotoNaskhArabic_500Medium',
    bold: 'NotoNaskhArabic_700Bold',
  },
  urduSans: {
    label: 'اردو — Sans',
    isUrdu: true,
    regular: 'NotoSansArabic_500Medium',
    semibold: 'NotoSansArabic_700Bold',
    bold: 'NotoSansArabic_800ExtraBold',
  },
  urduNastaliq: {
    label: 'اردو — Nastaliq',
    isUrdu: true,
    regular: 'NotoNastaliqUrdu_400Regular',
    semibold: 'NotoNastaliqUrdu_500Medium',
    bold: 'NotoNastaliqUrdu_700Bold',
  },
  urduGulzar: {
    label: 'اردو — Gulzar',
    isUrdu: true,
    regular: 'Gulzar_400Regular',
    semibold: 'Gulzar_400Regular',
    bold: 'Gulzar_400Regular',
  },
} as const;

export type FontKey = keyof typeof FONT_OPTIONS;

/** Text-size steps selectable in Settings (multiplies every size token). */
export const FONT_SCALES = {
  small: 0.9,
  normal: 1,
  large: 1.1,
  xl: 1.22,
} as const;

export type FontScaleKey = keyof typeof FONT_SCALES;

/** The default font (the app's shipped look). */
export const fontFamilies = {
  regular: FONT_OPTIONS.rounded.regular,
  semibold: FONT_OPTIONS.rounded.semibold,
  bold: FONT_OPTIONS.rounded.bold,
} as const;

export interface Typography {
  fontFamily: string;
  sizes: typeof fontSizes;
  families: typeof fontFamilies;
  weights: {
    regular: string;
    semibold: string;
    bold: string;
  };
  lineHeights: Record<keyof typeof fontSizes, number>;
  /** Letter spacing for uppercase overline captions. */
  tracking: number;
  /** fontVariant for big tabular numbers (aligned digits). */
  tabularNums: TextStyle['fontVariant'];
}

const BASE_LINE_HEIGHTS: Record<keyof typeof fontSizes, number> = {
  overline: 14,
  xs: 18,
  sm: 20,
  md: 22,
  lg: 24,
  xl: 28,
  xxl: 34,
  display: 40,
};

/**
 * Compose the typography block for a font choice + text-size step (both from
 * Settings). Sizes and line heights scale together so rhythm is preserved.
 */
export function buildTypography(fontKey: FontKey = 'rounded', scaleKey: FontScaleKey = 'normal'): Typography {
  const font = FONT_OPTIONS[fontKey];
  const scale = FONT_SCALES[scaleKey];
  const scaled = <K extends string>(rec: Record<K, number>): Record<K, number> =>
    Object.fromEntries(
      (Object.entries(rec) as [K, number][]).map(([k, v]) => [k, Math.round(v * scale)])
    ) as Record<K, number>;

  const families = { regular: font.regular, semibold: font.semibold, bold: font.bold };
  return {
    fontFamily: families.regular,
    sizes: scaled(fontSizes) as Typography['sizes'],
    families: families as Typography['families'],
    weights: families,
    lineHeights: scaled(BASE_LINE_HEIGHTS),
    tracking: 1.2,
    tabularNums: ['tabular-nums'],
  };
}

const typography: Typography = buildTypography();

/* -------------------------------------------------------------------------- */
/*  Spacing, radius, shadows, touch                                           */
/* -------------------------------------------------------------------------- */

/** 4 → 32 spacing scale. Use these instead of magic numbers. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/**
 * Corner radii  everything is generously rounded, nothing sharp.
 * `md`/`lg` are kept (remapped to the soft values) for back-compat; new code
 * should prefer the semantic `chip` / `card` / `hero`.
 */
export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  chip: 14,
  card: 22,
  hero: 26,
  pill: 999,
} as const;

export interface Shadows {
  /** Ultra-soft elevation for resting cards  they float, never harsh. */
  card: ViewStyle;
  /** Stronger-soft elevation for floating elements (navbar pill, sheets). */
  raised: ViewStyle;
  /** Soft green glow under the "+" FAB. */
  fab: ViewStyle;
}

const shadows: Shadows = {
  card: {
    shadowColor: '#1A1712',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 3,
  },
  raised: {
    shadowColor: '#1A1712',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 10,
  },
  fab: {
    // Soft green glow  color matches `accent`.
    shadowColor: '#1FA15D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 10,
  },
};

export interface IconSpec {
  /** Stroke width for the soft lucide look. */
  strokeWidth: number;
  /** Default icon size. */
  size: number;
}

const icon: IconSpec = {
  strokeWidth: 1.8,
  size: 24,
};

export interface TouchSpec {
  /** Minimum touch target  every tappable element is at least this tall. */
  minTarget: number;
  /** Default hitSlop applied to small touchables. */
  hitSlop: { top: number; bottom: number; left: number; right: number };
}

const touch: TouchSpec = {
  minTarget: 56,
  hitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
};

/* -------------------------------------------------------------------------- */
/*  Theme assembly                                                            */
/* -------------------------------------------------------------------------- */

export type ThemeMode = 'light' | 'dark';

export interface Theme {
  mode: ThemeMode;
  darkMode: boolean;
  colors: ColorPalette;
  gradients: Gradients;
  typography: Typography;
  spacing: typeof spacing;
  radius: typeof radius;
  shadows: Shadows;
  icon: IconSpec;
  touch: TouchSpec;
}

export const lightTheme: Theme = {
  mode: 'light',
  darkMode: false,
  colors: lightColors,
  gradients: lightGradients,
  typography,
  spacing,
  radius,
  shadows,
  icon,
  touch,
};

export const darkTheme: Theme = {
  mode: 'dark',
  darkMode: true,
  colors: darkColors,
  gradients: darkGradients,
  typography,
  spacing,
  radius,
  shadows,
  icon,
  touch,
};

/**
 * Pick the theme for a mode, optionally recomposed with the user's font and
 * text-size choices (Settings). Defaults return the static shared objects.
 */
export const getTheme = (
  mode: ThemeMode,
  fontKey: FontKey = 'rounded',
  scaleKey: FontScaleKey = 'normal'
): Theme => {
  const base = mode === 'dark' ? darkTheme : lightTheme;
  if (fontKey === 'rounded' && scaleKey === 'normal') return base;
  return { ...base, typography: buildTypography(fontKey, scaleKey) };
};

/** Helper type for components that build text styles from the theme. */
export type ThemedTextStyle = TextStyle;
