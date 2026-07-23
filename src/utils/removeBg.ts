/**
 * remove.bg background removal for signature photos. The user supplies their OWN
 * API key (stored on-device in Settings, never bundled), and the app calls
 * remove.bg directly. Requires internet.
 *
 * Throws a coded Error: 'offline' | 'badkey' | 'credits' | 'failed'.
 */
export type RemoveBgError = 'offline' | 'badkey' | 'credits' | 'failed';

/**
 * Send a base64 data-URL image to remove.bg and return a transparent-PNG data
 * URL with the background removed.
 */
export async function removeBackground(dataUrl: string, apiKey: string): Promise<string> {
  const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const form = new FormData();
  form.append('image_file_b64', b64);
  form.append('size', 'auto');

  let res: Response;
  try {
    res = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey, Accept: 'image/png' },
      body: form,
    });
  } catch {
    throw new Error('offline' satisfies RemoveBgError);
  }

  if (res.status === 401 || res.status === 403) throw new Error('badkey' satisfies RemoveBgError);
  if (res.status === 402) throw new Error('credits' satisfies RemoveBgError);
  if (!res.ok) throw new Error('failed' satisfies RemoveBgError);

  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('failed' satisfies RemoveBgError));
    reader.readAsDataURL(blob);
  });
}
