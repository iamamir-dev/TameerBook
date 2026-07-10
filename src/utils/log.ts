/**
 * Central error reporting. Every catch that used to be `.catch(() => undefined)`
 * routes here instead, so failures are at least visible in development and
 * there is ONE place to wire a crash reporter later.
 */
export function reportError(scope: string, error: unknown): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn(`[${scope}]`, error);
  }
  // Production hook: forward to a crash-reporting service here.
}

/** `.catch(swallow('scope'))` — logs instead of silently discarding. */
export function swallow(scope: string): (error: unknown) => undefined {
  return (error: unknown) => {
    reportError(scope, error);
    return undefined;
  };
}
