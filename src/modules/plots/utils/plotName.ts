export interface PlotAddress {
  society: string;
  block: string;
  plotNo: string;
}

/**
 * A plot has no separate name — its ADDRESS is its name. Compose a display name
 * from the address parts (society · block · plot no), skipping blanks. Pure, so
 * it's unit-tested headlessly and shared by the New/Edit form.
 */
export function composePlotName({ society, block, plotNo }: PlotAddress): string {
  return [society, block, plotNo]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' · ');
}

/** True when the address has at least one part — the minimum to name a plot. */
export function hasPlotAddress(addr: PlotAddress): boolean {
  return composePlotName(addr).length > 0;
}
