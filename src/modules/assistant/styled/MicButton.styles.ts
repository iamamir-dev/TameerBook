import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    round: {
      width: theme.touch.minTarget,
      height: theme.touch.minTarget,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primarySoft,
    },
    recording: { backgroundColor: theme.colors.danger },
    busy: { backgroundColor: theme.colors.track },
    pressed: { opacity: 0.85 },
  });
