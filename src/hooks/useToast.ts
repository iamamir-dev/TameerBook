import { useCallback, useEffect, useRef, useState } from 'react';

const TOAST_MS = 1600;

export interface Toast {
  toast: string | null;
  showToast: (message: string) => void;
}

/**
 * Auto-dismissing toast message. Replacing a toast resets its timer, and the
 * pending timer is cleared on unmount (the old inline version leaked timers
 * on rapid saves and fired setState after unmount).
 */
export function useToast(): Toast {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  return { toast, showToast };
}
