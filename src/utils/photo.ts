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

/** Resize to max 1080px wide + JPEG q0.5 (~300KB). */
async function compress(uri: string): Promise<string> {
  const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1080 } }], {
    compress: 0.5,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return out.uri;
}
