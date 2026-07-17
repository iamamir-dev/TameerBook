import { StyleSheet } from 'react-native';

import type { Theme } from '@/theme/theme';

export const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.background },
    flex: { flex: 1 },
    flex2: { flex: 2 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.lg },
    dot: { width: 9, height: 9, borderRadius: theme.radius.pill, backgroundColor: theme.colors.border },
    dotActive: { backgroundColor: theme.colors.accent, width: 28 },
    dotDone: { backgroundColor: theme.colors.success },
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    optCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      padding: theme.spacing.lg,
      minHeight: theme.touch.minTarget,
    },
    optActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentSoft },
    scIcon: { width: 36, height: 36, borderRadius: theme.radius.chip, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
    scIconActive: { backgroundColor: theme.colors.accent },
    snapRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.sm },
    noteBox: { backgroundColor: theme.colors.primarySoft, borderRadius: theme.radius.md, padding: theme.spacing.md },
    checkRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.sm },
    checkbox: { width: 28, height: 28, borderRadius: theme.radius.sm, borderWidth: 2, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
    checkboxOn: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
    tblHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
    tblRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.sm },
    tblCol: { width: 64, textAlign: 'right' },
    footer: { flexDirection: 'row', gap: theme.spacing.md, padding: theme.spacing.lg },
  });
