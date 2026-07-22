import type { MaterialBookingRow } from '@/db';
import type { UnitDef } from '@/utils/units';

/** The material's unit definition as stored on the booking (for split display). */
export const bookingUnit = (b: MaterialBookingRow): UnitDef => ({
  primary: b.unit,
  secondary: b.secondary_unit,
  factor: b.secondary_factor,
});
