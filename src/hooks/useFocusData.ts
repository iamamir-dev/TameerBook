import { useCallback, useEffect, useRef, useState } from 'react';

import { useFocusReload, type FocusReload } from './useFocusReload';

export interface FocusData<T> extends FocusReload {
  /** The last successfully loaded value (starts at `initial`). */
  data: T;
  /** Escape hatch for optimistic updates between reloads. */
  setData: React.Dispatch<React.SetStateAction<T>>;
}

/**
 * The standard list/detail data hook. Replaces multi-state loader boilerplate
 * with a single typed struct: build one `{ ... }` in the loader, get it back as `data`.
 *
 * Uses a ref for `loader` so passing inline closures will not cause infinite re-render loops.
 */
export function useFocusData<T>(loader: () => Promise<T>, initial: T): FocusData<T> {
  const [data, setData] = useState<T>(initial);
  const loaderRef = useRef(loader);

  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  const load = useCallback(async () => {
    const result = await loaderRef.current();
    setData(result);
  }, []);

  const focus = useFocusReload(load);

  return { data, setData, ...focus };
}
