/**
 * Material unit conversion.
 *
 * A material category can carry a PRIMARY unit (e.g. kg) and an optional
 * SECONDARY sub-unit (e.g. g) with a factor = how many secondary units make one
 * primary (1 kg = 1000 g → factor 1000). Quantities are always STORED in the
 * primary unit (one canonical number, so roll-ups sum correctly); entry accepts
 * either unit and this module converts.
 */

export interface UnitDef {
  /** Primary unit label (categories.default_unit); null = unitless. */
  primary: string | null;
  /** Optional smaller sub-unit label (categories.secondary_unit). */
  secondary: string | null;
  /** How many secondary units make ONE primary (>0); null = no secondary. */
  factor: number | null;
}

/** Does this material offer a usable secondary unit? */
export function hasSecondary(u: UnitDef): boolean {
  return !!u.secondary && !!u.factor && u.factor > 0;
}

/**
 * Convert a typed quantity to the canonical PRIMARY-unit value.
 * `inSecondary` = the user typed in the secondary unit.
 */
export function toPrimaryQty(qty: number, inSecondary: boolean, u: UnitDef): number {
  if (inSecondary && hasSecondary(u)) return qty / (u.factor as number);
  return qty;
}

/** Convert a canonical primary-unit quantity into the secondary unit. */
export function toSecondaryQty(primaryQty: number, u: UnitDef): number {
  if (!hasSecondary(u)) return primaryQty;
  return primaryQty * (u.factor as number);
}

/**
 * Human quantity string in the primary unit, e.g. "50 kg". When a secondary
 * unit exists, append the equivalent: "50 kg (50,000 g)".
 */
export function formatQty(primaryQty: number, u: UnitDef): string {
  const grp = (n: number) => n.toLocaleString('en-PK');
  const base = u.primary ? `${grp(primaryQty)} ${u.primary}` : grp(primaryQty);
  if (!hasSecondary(u)) return base;
  return `${base} (${grp(toSecondaryQty(primaryQty, u))} ${u.secondary})`;
}
