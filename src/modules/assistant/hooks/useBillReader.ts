import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useState } from 'react';

import {
  billSystemPrompt,
  buildWorld,
  coerceBill,
  extractJson,
  getAiTransport,
  isAiError,
  type AiErrorCode,
  type Bill,
  type World,
} from '@/ai';
import { reportError } from '@/utils/log';

export interface BillReader {
  reading: boolean;
  error: AiErrorCode | null;
  /** Read a receipt photo (file URI) into structured line items. */
  read: (photoUri: string) => Promise<{ bill: Bill; world: World } | null>;
}

/**
 * "Read this bill": the compressed receipt JPEG goes to the vision model with
 * the user's material + supplier names, and comes back as validated line
 * items. Nothing is saved — callers prefill a form with the result.
 */
export function useBillReader(): BillReader {
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<AiErrorCode | null>(null);

  const read = useCallback(async (photoUri: string) => {
    setError(null);
    setReading(true);
    try {
      const transport = getAiTransport();
      const world = await buildWorld();
      const b64 = await FileSystem.readAsStringAsync(photoUri, { encoding: 'base64' });
      const raw = await transport.vision(b64, billSystemPrompt(world), { json: true });
      const bill = coerceBill(extractJson(raw));
      if (!bill) {
        setError('unparseable');
        return null;
      }
      return { bill, world };
    } catch (e) {
      const code: AiErrorCode = isAiError(e) ? e.code : 'failed';
      if (code === 'failed') reportError('bill:read', e);
      setError(code);
      return null;
    } finally {
      setReading(false);
    }
  }, []);

  return { reading, error, read };
}
