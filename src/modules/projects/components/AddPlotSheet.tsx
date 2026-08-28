import React, { useMemo } from 'react';

import { SelectSheet, type SelectOption } from '@/components/ui';
import type { PlotRow } from '@/db';
import { useTranslation } from '@/i18n';

const NEW_PLOT_ID = '__new_plot__';

interface AddPlotSheetProps {
  visible: boolean;
  onClose: () => void;
  /** OWNED (free) plots only — pre-filtered by the screen via `listPlots('OWNED')`. */
  plots: PlotRow[];
  /** Link the chosen plot to the project (the screen persists + refreshes). */
  onSelect: (plotId: string) => void;
  /** Create a brand-new plot, then come back and pick it. */
  onNewPlot: () => void;
}

/**
 * "Add plot later" picker on Project Detail (UC-2): a SelectSheet of the
 * OWNED plots (name + society/block), ALWAYS led by a "New plot" row so an
 * empty list is never a dead end — you can create a plot and return to pick it.
 */
export function AddPlotSheet({ visible, onClose, plots, onSelect, onNewPlot }: AddPlotSheetProps): React.JSX.Element {
  const { t } = useTranslation();

  const options: SelectOption[] = useMemo(
    () => [
      { id: NEW_PLOT_ID, label: t('newPlot'), icon: 'add' },
      ...plots.map((p) => ({
        id: p.id,
        label: p.name,
        subtitle: [p.society, p.block].filter(Boolean).join(' · ') || undefined,
        icon: 'plot' as const,
      })),
    ],
    [plots, t]
  );

  return (
    <SelectSheet
      visible={visible}
      onClose={onClose}
      options={options}
      title={t('addPlot')}
      searchable={false}
      onSelect={(o) => (o.id === NEW_PLOT_ID ? onNewPlot() : onSelect(o.id))}
    />
  );
}
