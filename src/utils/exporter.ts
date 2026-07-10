import dayjs from 'dayjs';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { formatRupees } from '@/utils/money';

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

/** Localized strings for the exit receipt (callers pass `t(...)` results). */
export interface ExitReceiptLabels {
  /** Receipt heading, e.g. t('exitReceipt'). */
  title: string;
  /** Project row label, e.g. t('projects'). */
  project: string;
  /** Leaver row label, e.g. t('exitWho'). */
  who: string;
  /** Buyer row label, e.g. t('buyer'). */
  buyer: string;
  /** Amount row label, e.g. t('exitValue'). */
  value: string;
  /** Date row label, e.g. t('date'). */
  date: string;
  /** Fine-print note, e.g. t('exitValueNote'). */
  note: string;
}

export interface ExitReceiptInput {
  projectName: string;
  investorName: string;
  buyerName: string;
  /** Exit value paid, in rupees. */
  amount: number;
  labels: ExitReceiptLabels;
}

/** Build the printable HTML for the investor-exit receipt PDF. */
export function exitReceiptHtml(input: ExitReceiptInput): string {
  const { projectName, investorName, buyerName, amount, labels } = input;
  return `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
      <style>body{font-family:-apple-system,Roboto,sans-serif;padding:24px;color:#211F1B}
      h1{color:#1D1C18;margin:0}.r{margin:6px 0}.lbl{color:#9A958B}.sig{margin-top:48px;display:flex;justify-content:space-between}
      .sig div{border-top:1px solid #211F1B;width:40%;text-align:center;padding-top:6px;color:#9A958B}</style></head><body>
      <h1>TameerBook</h1><h2>${labels.title}</h2>
      <div class="r"><span class="lbl">${labels.project}:</span> ${projectName}</div>
      <div class="r"><span class="lbl">${labels.who}</span> ${investorName}</div>
      <div class="r"><span class="lbl">${labels.buyer}:</span> ${buyerName}</div>
      <div class="r"><span class="lbl">${labels.value}:</span> <b>${formatRupees(amount)}</b></div>
      <div class="r"><span class="lbl">${labels.date}:</span> ${dayjs().format('DD MMM YYYY')}</div>
      <div class="r">${labels.note}</div>
      <div class="sig"><div>${investorName}</div><div>${buyerName}</div></div>
      </body></html>`;
}
