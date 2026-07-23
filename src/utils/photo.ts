import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/**
 * Capture a receipt photo with the camera and downscale/compress it (~300KB:
 * max 1080px wide, JPEG quality 0.5). Returns the compressed file URI, or null
 * if permission was denied or the user cancelled.
 */
export async function captureReceipt(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    quality: 0.8,
    allowsEditing: false,
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;

  return compress(asset.uri);
}

/**
 * Pick a document image from the gallery (already-scanned Fard / Registry /
 * agreement etc.) and compress it. Returns the file URI or null.
 */
export async function pickDocumentImage(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    quality: 0.8,
    allowsEditing: false,
    mediaTypes: ['images'],
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  return compress(asset.uri);
}

/**
 * Capture (camera) or pick (gallery) a signature photo, cropped by the user,
 * and return it as a base64 data URL ready to embed in a PDF. Offline; nothing
 * leaves the device.
 */
export async function captureSignature(source: 'camera' | 'gallery'): Promise<string | null> {
  const perm =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.9, allowsEditing: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.9, allowsEditing: true, mediaTypes: ['images'] });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;

  const uri = await compress(asset.uri);
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  return `data:image/jpeg;base64,${b64}`;
}

/**
 * Normalize a signature (draw or photo) to a horizontal, tightly-sized PNG data
 * URL: if it's taller than it is wide it's rotated 90° so it always reads
 * left-to-right. Keeps transparency (PNG).
 */
export async function normalizeSignature(dataUrl: string): Promise<string> {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const path = `${FileSystem.cacheDirectory}sig-${Date.now()}.png`;
  await FileSystem.writeAsStringAsync(path, base64, { encoding: 'base64' });

  const info = await ImageManipulator.manipulateAsync(path, [], { format: ImageManipulator.SaveFormat.PNG });
  const actions: ImageManipulator.Action[] = info.height > info.width ? [{ rotate: -90 }] : [];
  const out = await ImageManipulator.manipulateAsync(path, actions, {
    format: ImageManipulator.SaveFormat.PNG,
    base64: true,
  });
  return out.base64 ? `data:image/png;base64,${out.base64}` : dataUrl;
}

/** Resize to max 1080px wide + JPEG q0.5 (~300KB). */
async function compress(uri: string): Promise<string> {
  const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1080 } }], {
    compress: 0.5,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return out.uri;
}
