import React, { useMemo } from 'react';

import { SelectSheet, type SelectOption } from '@/components/ui';
import type { PlotRow } from '@/db';
import { useTranslation } from '@/i18n';

interface AddPlotSheetProps {
  visible: boolean;
  onClose: () => void;
  /** OWNED (free) plots only — pre-filtered by the screen via `listPlots('OWNED')`. */
  plots: PlotRow[];
  /** Link the chosen plot to the project (the screen persists + refreshes). */
  onSelect: (plotId: string) => void;
}

/**
 * "Add plot later" picker on Project Detail (UC-2): a SelectSheet of the
 * OWNED plots, labelled by name with society/block as the subtitle.
 */
export function AddPlotSheet({ visible, onClose, plots, onSelect }: AddPlotSheetProps): React.JSX.Element {
  const { t } = useTranslation();

  const options: SelectOption[] = useMemo(
    () =>
      plots.map((p) => ({
        id: p.id,
        label: p.name,
        subtitle: [p.society, p.block].filter(Boolean).join(' · ') || undefined,
        icon: 'plot',
      })),
    [plots]
  );

  return (
    <SelectSheet
      visible={visible}
      onClose={onClose}
      options={options}
      title={t('addPlot')}
      onSelect={(o) => onSelect(o.id)}
    />
  );
}
