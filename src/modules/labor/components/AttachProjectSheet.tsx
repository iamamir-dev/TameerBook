import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AmountInput, AppButton, AppSheet, AppText } from '@/components/ui';
import { attachLaborerToProject, type ProjectRow } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';

import { makeStyles } from '../styled/AttachProjectSheet.styles';

interface Props {
  visible: boolean;
  onClose: () => void;
  laborerId: string;
  /** ACTIVE projects the worker is NOT already attached to. */
  projects: ProjectRow[];
  /** Called after attaching (parent reloads the khata). */
  onSaved: () => Promise<void> | void;
}

/**
 * Put a worker on a project FROM their khata: pick one of the company's active
 * projects and agree the dihari for it. On the shared `AppSheet`.
 */
export function AttachProjectSheet({
  visible,
  onClose,
  laborerId,
  projects,
  onSaved,
}: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(theme);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [wage, setWage] = useState(0);
  const { saving, run: runSave } = useSaveAction();

  useEffect(() => {
    if (visible) {
      setProjectId(null);
      setWage(0);
    }
  }, [visible]);

  const onSave = () => {
    if (!projectId || wage <= 0) return;
    void (async () => {
      const ok = await runSave(async () => {
        await attachLaborerToProject({ projectId, laborerId, dailyWage: wage });
        await onSaved();
      });
      if (ok) onClose();
    })();
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      icon="project"
      title={t('includeInProject')}
      footer={
        <AppButton label={t('save')} icon="check" onPress={onSave} loading={saving} disabled={!projectId || wage <= 0} />
      }
    >
      <View style={styles.chips}>
        {projects.map((p) => {
          const selected = p.id === projectId;
          return (
            <Pressable
              key={p.id}
              onPress={() => setProjectId(selected ? null : p.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && styles.chipActive]}
            >
              <AppText size="sm" weight="semibold" color={selected ? 'onPrimary' : 'textPrimary'} numberOfLines={1}>
                {p.name}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <AmountInput floating surface={theme.colors.card} label={t('dailyWage')} value={wage} onChange={setWage} />
    </AppSheet>
  );
}
