import { useCallback, useState } from 'react';

import { useFocusReload, type FocusReload } from './useFocusReload';

export interface FocusData<T> extends FocusReload {
  /** The last successfully loaded value (starts at `initial`). */
  data: T;
  /** Escape hatch for optimistic updates between reloads. */
  setData: React.Dispatch<React.SetStateAction<T>>;
}

/**
 * The standard list/detail data hook. Replaces the ubiquitous
 * `const [a,setA] = useState(); const [b,setB] = useState(); … load = () =>
 * Promise.all([...]).then(([a,b]) => { setA(a); setB(b); })` soup with a single
 * typed struct: build one `{ ... }` in the loader, get it back as `data`.
 *
 * `loader` MUST be a `useCallback` (its identity gates the focus/version effects
 * in `useFocusReload`). Returns everything `useFocusReload` does, plus `data`.
 */
export function useFocusData<T>(loader: () => Promise<T>, initial: T): FocusData<T> {
  const [data, setData] = useState<T>(initial);

  const load = useCallback(async () => {
    setData(await loader());
  }, [loader]);

  const focus = useFocusReload(load);

  return { data, setData, ...focus };
}
