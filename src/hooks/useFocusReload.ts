import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useDataVersion } from '@/stores/useDataVersion';
import { reportError } from '@/utils/log';

export interface FocusReload {
  /** True when the last load failed (screens can show a retry state). */
  loadFailed: boolean;
  /** Re-run the load on demand (after a save, or from a retry button). */
  reload: () => Promise<void>;
}

/**
 * Run a screen's data `load` every time it gains focus, with the error
 * handling every screen used to skip: a failed load is reported and surfaced
 * via `loadFailed` instead of `.catch(() => undefined)` leaving the screen
 * stuck on its loading branch forever.
 *
 * `load` should be a `useCallback` so focus effects don't re-fire per render.
 */
export function useFocusReload(load: () => Promise<void>): FocusReload {
  const [loadFailed, setLoadFailed] = useState(false);

  const reload = useCallback(async () => {
    try {
      await load();
      setLoadFailed(false);
    } catch (e) {
      reportError('screen:load', e);
      setLoadFailed(true);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  // Real-time updates: any successful save anywhere bumps the data version,
  // and every MOUNTED screen reloads immediately — including the tab scenes
  // kept alive behind the current one, which never re-fire a focus event.
  const version = useDataVersion((s) => s.version);
  const seenVersion = useRef(version);
  useEffect(() => {
    if (version === seenVersion.current) return;
    seenVersion.current = version;
    void reload();
  }, [version, reload]);

  return { loadFailed, reload };
}
