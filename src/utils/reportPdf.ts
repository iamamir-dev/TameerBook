/**
 * Report generator (expo side): loads the branded assets — the ACTIVE app
 * font (Settings → Font), the Naskh fallback for Urdu glyphs, the wordmark
 * and the company logo — renders a `ReportDoc` through the house template
 * (reportHtml.ts) and prints it to a PDF file.
 *
 * Every report in the app goes through here so the format stays consistent;
 * report types (settlement, khata, …) only build a `ReportDoc`.
 */
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';

import type { FontKey } from '@/theme/theme';

import { renderReportHtml, type ReportDoc } from './reportHtml';

/* Latin app families + Naskh fallback for Urdu glyphs. */
const FONT_ASSETS: Record<string, { regular: number; bold: number }> = {
  rounded: {
    regular: require('../../assets/fonts/MPLUSRounded1c_500Medium.ttf'),
    bold: require('../../assets/fonts/MPLUSRounded1c_800ExtraBold.ttf'),
  },
  baloo: {
    regular: require('../../assets/fonts/Baloo2_500Medium.ttf'),
    bold: require('../../assets/fonts/Baloo2_800ExtraBold.ttf'),
  },
  serif: {
    regular: require('../../assets/fonts/Fraunces_500Medium.ttf'),
    bold: require('../../assets/fonts/Fraunces_800ExtraBold.ttf'),
  },
  inter: {
    regular: require('../../assets/fonts/Inter_500Medium.ttf'),
    bold: require('../../assets/fonts/Inter_800ExtraBold.ttf'),
  },
  urduNaskh: {
    regular: require('../../assets/fonts/NotoNaskhArabic_500Medium.ttf'),
    bold: require('../../assets/fonts/NotoNaskhArabic_700Bold.ttf'),
  },
  urduSans: {
    regular: require('../../assets/fonts/NotoSansArabic_500Medium.ttf'),
    bold: require('../../assets/fonts/NotoSansArabic_800ExtraBold.ttf'),
  },
  urduNastaliq: {
    regular: require('../../assets/fonts/NotoNastaliqUrdu_500Medium.ttf'),
    bold: require('../../assets/fonts/NotoNastaliqUrdu_700Bold.ttf'),
  },
  urduGulzar: {
    regular: require('../../assets/fonts/Gulzar_400Regular.ttf'),
    bold: require('../../assets/fonts/Gulzar_400Regular.ttf'),
  },
};
// Transparent-background wordmark (bold "TameerBook") — header + footer.
const APP_WORDMARK = require('../../assets/wordmark-on-light.png');
const NASKH_FALLBACK = require('../../assets/fonts/NotoNaskhArabic_500Medium.ttf');

async function assetB64(mod: number): Promise<string> {
  const asset = Asset.fromModule(mod);
  await asset.downloadAsync();
  if (!asset.localUri) return '';
  return FileSystem.readAsStringAsync(asset.localUri, { encoding: 'base64' });
}

async function fileB64(uri: string | null | undefined): Promise<string> {
  if (!uri) return '';
  try {
    return await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  } catch {
    return '';
  }
}

/** Build the branded HTML for a report doc (assets embedded as base64). */
export async function buildReportHtml(
  doc: ReportDoc,
  fontKey: FontKey,
  companyLogoUri?: string | null
): Promise<string> {
  const fonts = FONT_ASSETS[fontKey] ?? FONT_ASSETS.rounded;
  const [fontRegular, fontBold, naskh, wordmark, companyLogo] = await Promise.all([
    assetB64(fonts.regular),
    assetB64(fonts.bold),
    assetB64(NASKH_FALLBACK),
    assetB64(APP_WORDMARK),
    fileB64(companyLogoUri),
  ]);
  return renderReportHtml(doc, { fontRegular, fontBold, naskh, wordmark, companyLogo: companyLogo || null });
}

/** Render a report doc to a PDF file; returns its uri (+ the html for preview). */
export async function createReportPdf(
  doc: ReportDoc,
  fontKey: FontKey,
  companyLogoUri?: string | null
): Promise<{ uri: string; html: string }> {
  const html = await buildReportHtml(doc, fontKey, companyLogoUri);
  const { uri } = await Print.printToFileAsync({ html });
  return { uri, html };
}
