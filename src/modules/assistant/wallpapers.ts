import type { Theme } from '@/theme/theme';

/**
 * Chat wallpapers. Each tile is the WhatsApp doodle rendered from the vector
 * (assets/wallpapers/doodle.svg) in one colourway by scripts/render-wallpapers.mjs,
 * so the lines stay crisp at any density. The colours here are design data
 * (like theme.ts), not styling: they must match what is baked into each tile.
 */
export const CHAT_WALLPAPERS = ['classic', 'white', 'sage', 'night'] as const;
export type ChatWallpaperId = (typeof CHAT_WALLPAPERS)[number];
export const DEFAULT_CHAT_WALLPAPER: ChatWallpaperId = 'white';

interface WallpaperDef {
  asset: number;
  /** The tile's own background; shown behind the tile and in the picker swatch. */
  canvas: string;
  /** A dark tile: drawn in full in both modes. Light tiles only tint the dark theme faintly. */
  dark: boolean;
  /** Outgoing bubble fill (null = the theme's brand primary), and its text. */
  outgoing: string | null;
}

/* eslint-disable @typescript-eslint/no-var-requires */
const DEFS: Record<ChatWallpaperId, WallpaperDef> = {
  classic: { asset: require('../../../assets/wallpapers/classic.png') as number, canvas: '#EFEAE2', dark: false, outgoing: null },
  white: { asset: require('../../../assets/wallpapers/white.png') as number, canvas: '#F6F5F2', dark: false, outgoing: null },
  sage: { asset: require('../../../assets/wallpapers/sage.png') as number, canvas: '#E3EEE6', dark: false, outgoing: '#15804A' },
  night: { asset: require('../../../assets/wallpapers/night.png') as number, canvas: '#0B1410', dark: true, outgoing: '#1F6F52' },
};
/* eslint-enable @typescript-eslint/no-var-requires */

export interface ResolvedWallpaper {
  asset: number;
  /** Colour under the tile. */
  canvas: string;
  /** Tile opacity: a light tile in the dark theme is only a faint texture. */
  tileOpacity: number;
  /** Outgoing bubble fill and text colour. */
  outgoing: string;
  outgoingText: string;
}

/** The chosen wallpaper as the screen should draw it in the current theme. */
export function resolveWallpaper(id: ChatWallpaperId, theme: Theme): ResolvedWallpaper {
  const def = DEFS[id] ?? DEFS[DEFAULT_CHAT_WALLPAPER];
  const faint = theme.darkMode && !def.dark;
  return {
    asset: def.asset,
    canvas: faint ? theme.colors.chatCanvas : def.canvas,
    tileOpacity: faint ? 0.1 : 1,
    // The brand charcoal vanishes on a dark tile, so dark tiles carry their own green.
    outgoing: def.outgoing ?? (def.dark ? DEFS.night.outgoing! : theme.colors.primary),
    outgoingText: def.outgoing || def.dark ? '#FFFFFF' : theme.colors.onPrimary,
  };
}

/** The swatch shown in the picker for each wallpaper. */
export const wallpaperSwatch = (id: ChatWallpaperId): string => DEFS[id].canvas;
