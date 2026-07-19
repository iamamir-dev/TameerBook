import React, { useEffect, useState } from 'react';

import { AmountInput, AppButton, AppSheet } from '@/components/ui';
import { setLaborerWage } from '@/db';
import { useSaveAction } from '@/hooks';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** The participation whose dihari is being changed (null = closed). */
  projectLaborerId: string | null;
  projectName: string;
  currentWage: number;
  /** Called after saving (parent reloads the khata). */
  onSaved: () => Promise<void> | void;
}

/**
 * Change the agreed dihari for ONE project participation. Applies to future
 * attendance only — past accruals keep the wage snapshot they were marked at.
 */
export function EditWageSheet({
  visible,
  onClose,
  projectLaborerId,
  projectName,
  currentWage,
  onSaved,
}: Props): React.JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const [wage, setWage] = useState(currentWage);
  const { saving, run: runSave } = useSaveAction();

  useEffect(() => {
    if (visible) setWage(currentWage);
  }, [visible, currentWage]);

  const onSave = () => {
    if (!projectLaborerId || wage <= 0) return;
    void (async () => {
      const ok = await runSave(async () => {
        await setLaborerWage(projectLaborerId, wage);
        await onSaved();
      });
      if (ok) onClose();
    })();
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title={t('dailyWage')}
      subtitle={projectName}
      footer={<AppButton label={t('save')} icon="check" onPress={onSave} loading={saving} disabled={wage <= 0} />}
    >
      <AmountInput floating surface={theme.colors.card} label={t('dailyWage')} value={wage} onChange={setWage} />
    </AppSheet>
  );
}
