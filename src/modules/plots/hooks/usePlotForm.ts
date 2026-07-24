import { useState } from 'react';

import type { PlotRow, SizeUnit } from '@/db';

import { composePlotName, hasPlotAddress } from '../utils/plotName';

export interface PlotForm {
  society: string;
  block: string;
  plotNo: string;
  size: string;
  sizeUnit: SizeUnit;
  dealPrice: number;
  sellerName: string;
  sellerPhone: string;
  /** ISO date (YYYY-MM-DD) or null when no transfer deadline is set. */
  deadline: string | null;
}

const EMPTY: PlotForm = {
  society: '',
  block: '',
  plotNo: '',
  size: '',
  sizeUnit: 'MARLA',
  dealPrice: 0,
  sellerName: '',
  sellerPhone: '',
  deadline: null,
};

export interface UsePlotForm {
  form: PlotForm;
  patch: (p: Partial<PlotForm>) => void;
  /** Load an existing plot's values into the form (Edit prefill). */
  prefill: (plot: PlotRow) => void;
  canSave: boolean;
  /** The shared field set both createPlot and updatePlot accept. The plot's
   *  NAME is its address (there is no separate name field). */
  buildInput: () => {
    name: string;
    society: string | null;
    block: string | null;
    plotNo: string | null;
    sizeValue: number | null;
    sizeUnit: SizeUnit | null;
    dealPrice: number;
    sellerName: string | null;
    sellerPhone: string | null;
    transferDeadline: string | null;
  };
}

/**
 * The ONE plot form state, shared by New and Edit (which were near-identical
 * 240-line screens). A plot has no separate name — its address IS its name, so
 * `buildInput` composes the name from society/block/plot-no and `canSave`
 * requires at least one address part (plus a deal price).
 */
export function usePlotForm(): UsePlotForm {
  const [form, setForm] = useState<PlotForm>(EMPTY);
  const patch = (p: Partial<PlotForm>) => setForm((s) => ({ ...s, ...p }));

  const prefill = (plot: PlotRow) =>
    setForm({
      society: plot.society ?? '',
      block: plot.block ?? '',
      plotNo: plot.plot_no ?? '',
      size: plot.size_value != null ? String(plot.size_value) : '',
      sizeUnit: plot.size_unit ?? 'MARLA',
      dealPrice: plot.deal_price,
      sellerName: plot.seller_name ?? '',
      sellerPhone: plot.seller_phone ?? '',
      deadline: plot.transfer_deadline,
    });

  const address = { society: form.society, block: form.block, plotNo: form.plotNo };
  const canSave = hasPlotAddress(address) && form.dealPrice > 0;

  const buildInput = () => {
    const sizeValue = Number(form.size);
    const hasSize = form.size.trim().length > 0 && Number.isFinite(sizeValue) && sizeValue > 0;
    return {
      name: composePlotName(address),
      society: form.society.trim() || null,
      block: form.block.trim() || null,
      plotNo: form.plotNo.trim() || null,
      sizeValue: hasSize ? sizeValue : null,
      sizeUnit: hasSize ? form.sizeUnit : null,
      dealPrice: form.dealPrice,
      sellerName: form.sellerName.trim() || null,
      sellerPhone: form.sellerPhone.trim() || null,
      transferDeadline: form.deadline,
    };
  };

  return { form, patch, prefill, canSave, buildInput };
}
