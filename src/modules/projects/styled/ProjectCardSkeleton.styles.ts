import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';
import { softToneColor } from '@/utils/tones';

/** Placeholder mirroring ProjectCard while the list loads (theme palette). */
export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: { gap: theme.spacing.md, opacity: 0.85 },
    header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    iconChip: { width: 44, height: 44, borderRadius: theme.radius.chip, backgroundColor: softToneColor(theme, 'primary') },
    titleCol: { flex: 1, gap: theme.spacing.xs },
    bar: { height: 8, borderRadius: theme.radius.pill, backgroundColor: theme.colors.track },
    mathBlock: { gap: theme.spacing.sm },
    mathRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, marginVertical: theme.spacing.xs },
    block: { height: 12, borderRadius: 6, backgroundColor: theme.colors.track },
  });
