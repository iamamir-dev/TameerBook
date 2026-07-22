/**
 * TameerBook report engine — the ONE house style for every PDF the app
 * produces. A report is a `ReportDoc`: branded chrome (band, company header,
 * wordmark, title row, footer) around a list of content BLOCKS (stat cards,
 * tables, notes, signatures). New report types compose blocks — they never
 * write HTML/CSS — so every document keeps the exact same professional look.
 *
 * This module is PURE (string building only, no expo imports) so it is unit
 * tested with vitest; asset loading + printing live in reportPdf.ts.
 */

/** House palette — mirrors the app theme (see src/theme/theme.ts). */
export const REPORT_COLORS = {
  accent: '#1FA15D',
  accentSoft: '#E4F3EB',
  gold: '#BE9B4A',
  danger: '#C43D3D',
  text: '#211F1B',
  textMid: '#5A564E',
  textSoft: '#9A958B',
  border: '#ECE8DF',
  heroBg: '#1D1C18',
  bg: '#FAF8F3',
} as const;

const C = REPORT_COLORS;

/** One value cell in a report table. */
export interface ReportCell {
  text: string;
  /** Color emphasis (bold + tone); 'strong' = bold in body color. */
  tone?: 'green' | 'red' | 'gold' | 'strong';
  /** Small soft suffix after the text (e.g. an ownership "50%"). */
  tag?: string;
}

export interface ReportColumn {
  label: string;
  /** 'num' right-aligns with tabular numerals (money/percent columns). */
  align?: 'left' | 'num';
  /** Tinted column — THE number readers look for (e.g. "Gets back"). */
  highlight?: boolean;
}

/** One KPI card in a stats strip. */
export interface ReportStat {
  label: string;
  value: string;
  /** Colored left edge + value color. */
  tone?: 'accent' | 'danger';
  /** Fully filled card (the lead number) — overrides `tone` styling. */
  filled?: 'accent' | 'danger';
}

export type ReportBlock =
  | { kind: 'stats'; items: ReportStat[] }
  | {
      kind: 'table';
      /** Uppercase section heading with the accent side-bar. */
      title?: string;
      /** Value shown on the right of the heading (e.g. a per-section rate). */
      titleRight?: string;
      columns: ReportColumn[];
      rows: ReportCell[][];
      /** Totals row — separated by the accounting double rule. */
      totals?: ReportCell[];
      /** Right-aligned label/value strip under the table (e.g. earned/taken). */
      summary?: { label: string; value: string; tone?: 'green' | 'red' | 'gold' }[];
    }
  | { kind: 'notes'; lines: { label: string; value: string }[] }
  | { kind: 'divider' }
  | { kind: 'signatures'; title: string; names: string[] };

/** A complete branded document. */
export interface ReportDoc {
  company: { name: string; ownerName?: string | null; phone?: string | null };
  /** Document type eyebrow, e.g. "Settlement Report". */
  title: string;
  /** The big subject line, e.g. the project name. */
  subject: string;
  /** Small lines under the subject (address, period …). */
  sublines?: (string | null | undefined)[];
  /** Dark status capsule top-right (e.g. "Project settled"); null = none. */
  statusChip?: string | null;
  /** Issue date shown under the chip and in the footer. */
  dateText: string;
  /** Footer slogan, e.g. "Made with TameerBook". */
  madeWith: string;
  blocks: ReportBlock[];
}

/** Base64 assets the chrome embeds (loaded by reportPdf.ts). */
export interface ReportAssets {
  fontRegular: string;
  fontBold: string;
  /** Urdu fallback face. */
  naskh: string;
  /** Transparent-background app wordmark (header + footer). */
  wordmark: string;
  /** Company logo (jpeg/png base64) — null falls back to the initial tile. */
  companyLogo: string | null;
}

const cellClass = (col: ReportColumn | undefined, cell: ReportCell): string =>
  [
    col?.align === 'num' ? 'num' : '',
    col?.highlight ? 'pay' : '',
    cell.tone === 'strong' ? 'strong' : cell.tone ?? '',
  ]
    .filter(Boolean)
    .join(' ');

const cellHtml = (cell: ReportCell): string =>
  `${cell.text}${cell.tag ? ` <span class="tag">${cell.tag}</span>` : ''}`;

function renderBlock(b: ReportBlock): string {
  switch (b.kind) {
    case 'stats':
      return `
    <div class="stats">
      ${b.items
        .map((it) => {
          const cls = it.filled ? ` net${it.filled === 'danger' ? ' net-danger' : ''}` : it.tone ? ` edge-${it.tone}` : '';
          const vcls = !it.filled && it.tone ? ` v-${it.tone}` : '';
          return `<div class="stat${cls}"><div class="k">${it.label}</div><div class="v${vcls}">${it.value}</div></div>`;
        })
        .join('\n      ')}
    </div>`;
    case 'table': {
      const head = b.columns
        .map((c) => `<th class="${[c.align === 'num' ? 'num' : '', c.highlight ? 'pay' : ''].filter(Boolean).join(' ')}">${c.label || '&nbsp;'}</th>`)
        .join('');
      const body = b.rows
        .map((row) => `<tr>${row.map((cell, i) => `<td class="${cellClass(b.columns[i], cell)}">${cellHtml(cell)}</td>`).join('')}</tr>`)
        .join('\n        ');
      const totals = b.totals
        ? `\n        <tr class="totalrow">${b.totals
            .map((cell, i) => `<td class="${cellClass(b.columns[i], cell)}">${cellHtml(cell)}</td>`)
            .join('')}</tr>`
        : '';
      const heading = b.title
        ? `<h3 class="${b.titleRight ? 'withright' : ''}">${b.title}${b.titleRight ? `<span class="titleright">${b.titleRight}</span>` : ''}</h3>`
        : '';
      const summary = b.summary
        ? `\n    <div class="tsummary">${b.summary
            .map((s) => `<span class="ts"><span class="tsk">${s.label}</span><span class="tsv ${s.tone ?? ''}">${s.value}</span></span>`)
            .join('')}</div>`
        : '';
      return `
    ${heading}
    <table>
      <thead><tr>${head}</tr></thead>
      <tbody>
        ${body}${totals}
      </tbody>
    </table>${summary}`;
    }
    case 'notes':
      if (b.lines.length === 0) return '';
      return `
    <div class="notes">
      ${b.lines.map((l) => `<div class="note">${l.label}: <b>${l.value}</b></div>`).join('\n      ')}
    </div>`;
    case 'divider':
      return `\n    <div class="rdivider"></div>`;
    case 'signatures':
      return `
    <div class="sigblock">
      <h3>${b.title}</h3>
      <div class="sigs">${b.names.map((n) => `<div class="sig"><div class="sigline"></div><div class="signame">${n}</div></div>`).join('')}</div>
    </div>`;
  }
}

/** Render the complete branded HTML document. */
export function renderReportHtml(doc: ReportDoc, assets: ReportAssets): string {
  const companyMark = assets.companyLogo
    ? `<img class="clogo" src="data:image/jpeg;base64,${assets.companyLogo}"/>`
    : `<div class="clogo cfallback">${doc.company.name.charAt(0).toUpperCase()}</div>`;

  const sublines = (doc.sublines ?? []).filter((x): x is string => !!x);
  // Footer content is rendered twice: an invisible copy in <tfoot> reserves its
  // height on every page (so content never overlaps), and a fixed copy paints it
  // flush at the physical bottom of every page — including a short last page.
  const footerInner = `<img class="flogo" src="data:image/png;base64,${assets.wordmark}"/><div class="flegal">${doc.company.name} · ${doc.dateText} · ${doc.madeWith}</div>`;

  return `
  <style>
    @font-face { font-family: 'AppFont'; font-weight: 400; src: url(data:font/ttf;base64,${assets.fontRegular}) format('truetype'); }
    @font-face { font-family: 'AppFont'; font-weight: 700; src: url(data:font/ttf;base64,${assets.fontBold}) format('truetype'); }
    @font-face { font-family: 'Naskh'; font-weight: 400; src: url(data:font/ttf;base64,${assets.naskh}) format('truetype'); }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { margin: 0; }
    body { font-family: 'AppFont','Naskh',sans-serif; color: ${C.text}; background: #fff; -webkit-print-color-adjust: exact; }
    /* Table layout drives pagination: the thead REPEATS on every printed page
       and the print engine reserves its height, so content never runs under it. */
    /* The outer layout table has NO borders (separate, not collapse — collapse
       renders a faint edge-to-edge line at the thead/tbody seam that doubles up
       with the header's own divider). */
    .sheet { width: 100%; border-collapse: separate; border-spacing: 0; border: 0; }
    /* thead/tfoot REPEAT on every printed page; the engine reserves their space
       so content never overlaps and no blank band is left behind. */
    .sheet > thead { display: table-header-group; }
    .sheet > tfoot { display: table-footer-group; }
    .sheet > thead > tr > td, .sheet > tbody > tr > td, .sheet > tfoot > tr > td { padding: 0; border: 0; }
    .headpad { padding: 20px 36px 12px; }
    .bodypad { padding: 14px 36px 18px; }
    /* Light divider + breathing room between project sections. */
    .rdivider { height: 0; border-top: 1px solid ${C.border}; margin: 24px 0 4px; }

    /* ── Header bar: company brand left · app brand right ─────────────── */
    .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 16px; border-bottom: 1.5px solid ${C.border}; }
    .hleft { display: flex; align-items: center; gap: 13px; }
    .clogo { width: 54px; height: 54px; border-radius: 14px; object-fit: cover; }
    .cfallback { background: ${C.heroBg}; color: #fff; font-weight: 700; font-size: 26px; display: flex; align-items: center; justify-content: center; }
    .cname { font-size: 18px; font-weight: 700; letter-spacing: .2px; }
    .cmeta { font-size: 10px; color: ${C.textSoft}; margin-top: 3px; letter-spacing: .3px; }
    .hright { display: flex; align-items: center; }
    .applogo { height: 42px; }

    /* ── Title block: document identity left, status meta right ───────── */
    .titlerow { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin: 22px 0 6px; }
    .doctype { font-size: 10px; font-weight: 700; letter-spacing: 2.4px; text-transform: uppercase; color: ${C.accent}; }
    .project { font-size: 26px; font-weight: 700; margin-top: 3px; letter-spacing: -.2px; }
    .subline { font-size: 10.5px; color: ${C.textSoft}; margin-top: 4px; letter-spacing: .2px; }
    .meta { text-align: right; padding-top: 2px; }
    .chip { display: inline-block; background: ${C.heroBg}; color: #fff; font-size: 9px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; border-radius: 999px; padding: 5px 12px; }
    .metadate { font-size: 9.5px; color: ${C.textSoft}; margin-top: 6px; letter-spacing: .4px; }

    /* ── Stat cards: colored edges, one filled lead number ────────────── */
    .stats { display: flex; gap: 10px; margin: 16px 0 20px; }
    .stat { flex: 1; border: 1.2px solid ${C.border}; border-left: 3px solid ${C.border}; border-radius: 12px; padding: 11px 14px; background: #fff; }
    .stat .k { font-size: 8.5px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; color: ${C.textSoft}; }
    .stat .v { font-size: 17px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
    .stat.edge-accent { border-left-color: ${C.accent}; }
    .stat.edge-danger { border-left-color: ${C.danger}; }
    .stat .v.v-accent { color: ${C.accent}; }
    .stat .v.v-danger { color: ${C.danger}; }
    .stat.net { background: ${C.accent}; border-color: transparent; }
    .stat.net.net-danger { background: ${C.danger}; }
    .stat.net .k { color: rgba(255,255,255,.85); }
    .stat.net .v { color: #fff; font-size: 20px; }

    /* ── Sections & tables ─────────────────────────────────────────────── */
    h3 { font-size: 11px; font-weight: 700; letter-spacing: 1.8px; text-transform: uppercase; color: ${C.textMid}; margin: 18px 0 8px; border-left: 3px solid ${C.accent}; padding-left: 9px; break-after: avoid; }
    h3.withright { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
    h3 .titleright { font-size: 10px; font-weight: 700; letter-spacing: .3px; text-transform: none; color: ${C.textMid}; }
    /* Right-aligned per-section totals strip. */
    .tsummary { display: flex; flex-wrap: wrap; gap: 20px; justify-content: flex-end; margin-top: 9px; }
    .ts { display: flex; align-items: baseline; gap: 6px; }
    .tsk { font-size: 8.5px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: ${C.textSoft}; }
    .tsv { font-size: 12.5px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .tsv.green { color: ${C.accent}; }
    .tsv.red { color: ${C.danger}; }
    .tsv.gold { color: ${C.gold}; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 8.5px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: ${C.textSoft}; padding: 8px 10px; border-bottom: 1.5px solid ${C.text}; }
    td { font-size: 11.5px; padding: 9px 10px; border-bottom: .8px solid ${C.border}; }
    tbody tr:nth-child(even) td { background: ${C.bg}; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    td.pay, th.pay { background: ${C.accentSoft} !important; }
    .strong { font-weight: 700; }
    .green { color: ${C.accent}; font-weight: 700; }
    .red { color: ${C.danger}; font-weight: 700; }
    .gold { color: ${C.gold}; font-weight: 700; }
    .tag { font-size: 9px; font-weight: 700; color: ${C.textSoft}; }
    /* Accounting convention: double rule under the final totals. */
    tr.totalrow td { background: #fff !important; border-bottom: none; border-top: 3px double ${C.text}; font-weight: 700; }
    tr.totalrow td.pay { background: ${C.accentSoft} !important; }

    /* ── Notes box ─────────────────────────────────────────────────────── */
    .notes { background: ${C.bg}; border: 1px solid ${C.border}; border-radius: 10px; padding: 9px 13px; margin-top: 12px; }
    .note { font-size: 9.5px; color: ${C.textMid}; letter-spacing: .2px; }
    .note + .note { margin-top: 4px; }
    .note b { font-weight: 700; color: ${C.text}; }

    /* ── Signatures ────────────────────────────────────────────────────── */
    .sigblock { margin-top: 30px; page-break-inside: avoid; }
    .sigs { display: flex; gap: 28px; margin-top: 26px; }
    .sig { flex: 1; max-width: 180px; }
    .sigline { border-bottom: 1.2px dashed ${C.textSoft}; height: 26px; }
    .signame { font-size: 10px; font-weight: 700; margin-top: 6px; letter-spacing: .3px; }

    /* ── Footer ─────────────────────────────────────────────────────────── */
    .footer { display: flex; align-items: center; justify-content: space-between; border-top: 1.2px solid ${C.border}; height: 52px; padding: 0 36px; background: #fff; }
    .flogo { height: 28px; }
    .flegal { font-size: 7.5px; font-weight: 600; letter-spacing: .9px; text-transform: uppercase; color: ${C.textSoft}; }
    /* Screen (WebView preview): the <tfoot> footer flows normally; the fixed
       copy is not needed. */
    .footer-fixed { display: none; }
    /* Paper: the <tfoot> copy only RESERVES space (invisible, repeated on every
       page); the fixed copy paints flush at the physical page bottom. */
    @media print {
      .sheet > tfoot .footer { visibility: hidden; }
      .footer-fixed { display: flex; position: fixed; left: 0; right: 0; bottom: 0; }
    }
  </style>

  <table class="sheet">
    <thead><tr><td>
      <div class="headpad">
        <div class="header">
          <div class="hleft">
            ${companyMark}
            <div>
              <div class="cname">${doc.company.name}</div>
              <div class="cmeta">${[doc.company.ownerName, doc.company.phone].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
          <div class="hright">
            <img class="applogo" src="data:image/png;base64,${assets.wordmark}"/>
          </div>
        </div>
      </div>
    </td></tr></thead>
    <tbody><tr><td>
      <div class="bodypad">
        <div class="titlerow">
          <div>
            <div class="doctype">${doc.title}</div>
            <div class="project">${doc.subject}</div>
            ${sublines.map((l) => `<div class="subline">${l}</div>`).join('\n            ')}
          </div>
          <div class="meta">
            ${doc.statusChip ? `<span class="chip">✓ ${doc.statusChip}</span>` : ''}
            <div class="metadate">${doc.dateText}</div>
          </div>
        </div>
${doc.blocks.map(renderBlock).join('\n')}
      </div>
    </td></tr></tbody>
    <tfoot><tr><td>
      <div class="footer">${footerInner}</div>
    </td></tr></tfoot>
  </table>
  <div class="footer footer-fixed">${footerInner}</div>`;
}
