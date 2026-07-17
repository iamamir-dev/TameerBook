import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export type ExportFormat = 'pdf' | 'csv';

export interface ExportPayload {
  /** HTML used for the PDF. */
  html: string;
  /** CSV text. */
  csv: string;
  /** File base name (no extension), e.g. "expense-report". */
  baseName: string;
}

/** Render the HTML to a temporary PDF and return its file URI. */
async function pdfUri(html: string): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

/** Write the CSV to a temporary file and return its URI. */
async function csvUri(csv: string, baseName: string): Promise<string> {
  const uri = `${FileSystem.cacheDirectory}${baseName}.csv`;
  await FileSystem.writeAsStringAsync(uri, csv);
  return uri;
}

const MIME: Record<ExportFormat, string> = { pdf: 'application/pdf', csv: 'text/csv' };

/** Share the report (WhatsApp, email, etc.) via the OS share sheet. */
export async function shareReport(p: ExportPayload, format: ExportFormat): Promise<void> {
  const uri = format === 'pdf' ? await pdfUri(p.html) : await csvUri(p.csv, p.baseName);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: MIME[format], dialogTitle: p.baseName, UTI: format === 'pdf' ? 'com.adobe.pdf' : 'public.comma-separated-values-text' });
  }
}

/**
 * Save the report to the device. On Android this writes to a user-picked
 * folder via the Storage Access Framework (a real "download"); on iOS it falls
 * back to the share sheet's "Save to Files". Returns true if saved on-device.
 */
export async function saveReport(p: ExportPayload, format: ExportFormat): Promise<boolean> {
  if (Platform.OS === 'android') {
    const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!perm.granted) return false;
    const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
      perm.directoryUri,
      p.baseName,
      MIME[format]
    );
    if (format === 'csv') {
      await FileSystem.writeAsStringAsync(destUri, p.csv);
    } else {
      const src = await pdfUri(p.html);
      const base64 = await FileSystem.readAsStringAsync(src, { encoding: FileSystem.EncodingType.Base64 });
      await FileSystem.writeAsStringAsync(destUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    }
    return true;
  }
  // iOS / web: route through the share sheet ("Save to Files").
  await shareReport(p, format);
  return false;
}
