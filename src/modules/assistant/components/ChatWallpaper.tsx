import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTheme } from '@/theme';

import { resolveWallpaper } from '../wallpapers';

/**
 * The chat's wallpaper: the doodle tile the user picked in Settings, repeated
 * edge to edge over its own canvas colour. A light tile in the dark theme is
 * laid faintly over the app's dark canvas so it stays a texture. Sits behind
 * the message list and never receives touches.
 */
export function ChatWallpaper(): React.JSX.Element {
  const theme = useTheme();
  const id = useSettingsStore((s) => s.chatWallpaper);
  const wp = resolveWallpaper(id, theme);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: wp.canvas }]}>
      <Image source={wp.asset} resizeMode="repeat" style={[StyleSheet.absoluteFill, { opacity: wp.tileOpacity }]} accessibilityIgnoresInvertColors />
    </View>
  );
}
