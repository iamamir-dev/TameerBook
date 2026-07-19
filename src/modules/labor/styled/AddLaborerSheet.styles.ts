import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

const AV = 64;

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    photoPicker: { alignSelf: 'flex-start' },
    avatar: { width: AV, height: AV, borderRadius: theme.radius.pill, backgroundColor: theme.colors.track },
    avatarFallback: {
      width: AV,
      height: AV,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cameraBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.card,
    },
  });
