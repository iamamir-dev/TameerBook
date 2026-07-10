import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AppCard, AppIcon, AppText } from '@/components/ui';
import type { MilestoneRow } from '@/db';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme/theme';
import { swallow } from '@/utils/log';

interface MilestoneChecklistProps {
  milestones: MilestoneRow[];
  /** Flip a milestone's DONE/PENDING status (the screen persists + refreshes). */
  onToggle: (m: MilestoneRow) => Promise<void>;
}

/**
 * Collapsible construction-milestone checklist (done count in the header,
 * tap a row to toggle). Owns its expanded/busy UI state; persisting the
 * toggle is the screen's job via `onToggle`.
 */
export function MilestoneChecklist({ milestones, onToggle }: MilestoneChecklistProps): React.JSX.Element | null {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (milestones.length === 0) return null;

  const msDone = milestones.filter((m) => m.status === 'DONE').length;

  const toggle = (m: MilestoneRow): void => {
    if (busy) return;
    setBusy(true);
    onToggle(m)
      .catch(swallow('construction:milestone'))
      .finally(() => setBusy(false));
  };

  return (
    <AppCard compact>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.msHeader}
      >
        <AppText size="md" weight="bold" style={styles.flex}>
          {t('milestonesTitle')}
        </AppText>
        <AppText size="xs" weight="bold" color="textSecondary" tabular>
          {msDone}/{milestones.length}
        </AppText>
        <AppIcon name={open ? 'dotCurrent' : 'forward'} size={18} color="textSecondary" />
      </Pressable>
      {open
        ? milestones.map((m) => {
          const done = m.status === 'DONE';
          return (
            <Pressable
              key={m.id}
              onPress={() => toggle(m)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityState={{ checked: done }}
              accessibilityLabel={`${t('markDone')}: ${m.name}`}
              style={({ pressed }) => [styles.msRow, pressed && styles.pressed]}
            >
              <AppIcon
                name={done ? 'checkCircle' : 'dotNext'}
                size={20}
                color={done ? 'success' : 'textSecondary'}
              />
              <AppText size="sm" weight={done ? 'bold' : 'regular'} style={styles.flex} numberOfLines={1}>
                {m.name}
              </AppText>
              <AppText size="xs" color="textSecondary" tabular>
                {m.pct_weight}%
              </AppText>
            </Pressable>
          );
        })
        : null}
    </AppCard>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    pressed: { opacity: 0.6 },
    msHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      minHeight: theme.touch.minTarget,
    },
    msRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      minHeight: theme.touch.minTarget,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
  });
