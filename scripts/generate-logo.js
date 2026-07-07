/**
 * generate-logo.js  TameerBook soft modern building mark, icons & wordmark.
 *
 * Concept "Soft Skyline": a small cluster of rounded, modern buildings rising
 * from an open book  construction (Tameer) over the ledger (Book)  with NO
 * lettering. Themed after a clean premium reference UI: warm cream canvas,
 * soft charcoal forms, gentle diffuse shadows, generous rounding, and a single
 * muted emerald-green accent building.
 *
 * Run: node scripts/generate-logo.js
 */
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const ASSETS = path.join(__dirname, '..', 'assets');
const FONTS = path.join(__dirname, '..', 'node_modules', '@expo-google-fonts', 'inter');
const fontFiles = [
  path.join(FONTS, '800ExtraBold', 'Inter_800ExtraBold.ttf'),
  path.join(FONTS, '700Bold', 'Inter_700Bold.ttf'),
];

/* ---- palette (from the reference UI) ------------------------------------ */
const CREAM = '#F4F0E7';
const CREAM_DEEP = '#ECE6D9';
const CHAR1 = '#2E2C27';   // charcoal top
const CHAR2 = '#1B1A16';   // charcoal bottom
const GRN1 = '#36A572';    // green top
const GRN2 = '#2A8159';    // green bottom
const BOOK = '#FCFAF5';
const BOOK_LINE = '#D7D1C2';
const WIN = '#F4F0E7';

const YB = 690;            // baseline where buildings meet the book

/* shared defs: soft gradients + a gentle diffuse shadow */
const DEFS = `
<defs>
  <linearGradient id="tileG" x1="0.3" y1="0" x2="0.7" y2="1">
    <stop offset="0" stop-color="#F7F3EB"/><stop offset="1" stop-color="${CREAM_DEEP}"/>
  </linearGradient>
  <radialGradient id="tileGlow" cx="0.5" cy="0.28" r="0.8">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.6"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="charG" x1="0" y1="0" x2="0.25" y2="1">
    <stop offset="0" stop-color="${CHAR1}"/><stop offset="1" stop-color="${CHAR2}"/>
  </linearGradient>
  <linearGradient id="grnG" x1="0" y1="0" x2="0.25" y2="1">
    <stop offset="0" stop-color="${GRN1}"/><stop offset="1" stop-color="${GRN2}"/>
  </linearGradient>
  <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
    <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#171612" flood-opacity="0.16"/>
  </filter>
  <filter id="softer" x="-50%" y="-50%" width="200%" height="200%">
    <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#171612" flood-opacity="0.12"/>
  </filter>
</defs>`;

/* a soft building: square base, generously rounded top corners */
function bldg(x, w, top, fill, { win = null, winRows = 0 } = {}) {
  const r = Math.min(26, w / 2);
  let s = `<path d="M ${x} ${top + r} Q ${x} ${top} ${x + r} ${top}
    L ${x + w - r} ${top} Q ${x + w} ${top} ${x + w} ${top + r}
    L ${x + w} ${YB} L ${x} ${YB} Z" fill="${fill}"/>`;
  if (win && winRows > 0) {
    const ww = 13, wh = 17, gap = 20, cols = 2;
    const usedW = cols * ww + (cols - 1) * gap;
    const sx = x + (w - usedW) / 2;
    for (let r2 = 0; r2 < winRows; r2++) {
      const wy = top + 40 + r2 * (wh + 18);
      if (wy + wh > YB - 24) break;
      for (let c = 0; c < cols; c++) {
        s += `<rect x="${sx + c * (ww + gap)}" y="${wy}" width="${ww}" height="${wh}" rx="4" fill="${win}" opacity="0.85"/>`;
      }
    }
  }
  return s;
}

/* soft open book at the base */
function book({ page = BOOK, line = BOOK_LINE, spine = CHAR2 } = {}) {
  const L = 250, R = 774, cx = 512;
  const sTop = 676, sBot = 706, pTop = 700, pBot = 742;
  const pageLines = [0.4, 0.62].map((t) => {
    const y1 = pTop + (pBot - pTop) * t, y2 = sTop + (sBot - sTop) * t;
    const lx = L + (cx - L) * 0.14, lx2 = cx - 26;
    const rx = R - (R - cx) * 0.14, rx2 = cx + 26;
    return `<line x1="${lx}" y1="${y1}" x2="${lx2}" y2="${y2}" stroke="${line}" stroke-width="5" stroke-linecap="round"/>
            <line x1="${rx2}" y1="${y2}" x2="${rx}" y2="${y1}" stroke="${line}" stroke-width="5" stroke-linecap="round"/>`;
  }).join('');
  return `
    <g filter="url(#softer)">
      <path d="M ${L} ${pTop} Q ${cx} ${sTop - 6} ${cx} ${sTop} L ${cx} ${sBot} Q ${cx} ${sBot} ${L} ${pBot} Z" fill="${page}"/>
      <path d="M ${R} ${pTop} Q ${cx} ${sTop - 6} ${cx} ${sTop} L ${cx} ${sBot} Q ${cx} ${sBot} ${R} ${pBot} Z" fill="${page}"/>
    </g>
    ${pageLines}
    <rect x="${cx - 3}" y="${sTop}" width="6" height="${sBot - sTop}" rx="3" fill="${spine}"/>`;
}

/* the full building+book mark, authored in 1024 space */
function mark(o = {}) {
  const c = o.bldg || 'url(#charG)';
  const a = o.accent || 'url(#grnG)';
  const w = o.win || WIN;
  const skyline = [
    bldg(262, 84, 470, c, { win: w, winRows: 4 }),
    bldg(356, 96, 360, c, { win: w, winRows: 6 }),
    bldg(462, 110, 300, a, { win: w, winRows: 7 }),
    bldg(582, 90, 378, c, { win: w, winRows: 5 }),
    bldg(682, 78, 452, c, { win: w, winRows: 4 }),
  ].join('');
  return `<g filter="url(#soft)">${skyline}</g>${book(o.book || {})}`;
}

const BBOX = { w: 544, cx: 512, cy: 524 };
/** place the mark with target on-canvas width `w` (in 1024 space), centred at (cx,cy). */
function placeMark({ w, cx, cy, opts = {} }) {
  const s = w / BBOX.w;
  const tx = cx - BBOX.cx * s, ty = cy - BBOX.cy * s;
  return `<g transform="translate(${tx} ${ty}) scale(${s})">${mark(opts)}</g>`;
}

/* ---- compositions (all authored in a fixed 1024 viewBox; render() scales) -- */
function svgIcon({ rounded = false } = {}) {
  const r = rounded ? 1024 * 0.235 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    ${DEFS}
    <rect width="1024" height="1024" rx="${r}" fill="url(#tileG)"/>
    <rect width="1024" height="1024" rx="${r}" fill="url(#tileGlow)"/>
    ${placeMark({ w: 660, cx: 512, cy: 512 })}</svg>`;
}

function svgBackground() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    ${DEFS}<rect width="1024" height="1024" fill="url(#tileG)"/>
    <rect width="1024" height="1024" fill="url(#tileGlow)"/></svg>`;
}

function svgForeground({ mono = false } = {}) {
  const opts = mono ? { bldg: '#fff', accent: '#fff', win: null, book: { page: '#fff', line: '#fff', spine: '#fff' } } : {};
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    ${DEFS}${placeMark({ w: 600, cx: 512, cy: 512, opts })}</svg>`;
}

function svgWordmark({ variant = 'dark', W = 1820, H = 470 } = {}) {
  const onDark = variant === 'light';
  const t1 = onDark ? '#FFFFFF' : CHAR2;
  const t2 = onDark ? GRN1 : GRN2;
  const opts = onDark
    ? { bldg: CREAM, accent: 'url(#grnG)', win: CHAR2, book: { page: CREAM, line: '#B9B3A4', spine: GRN2 } }
    : {};
  const cy = H / 2;
  const markW = 380;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${DEFS}
    ${placeMark({ w: markW, cx: 30 + markW / 2, cy: cy + 6, opts })}
    <text x="${30 + markW + 30}" y="${cy}" font-family="Inter" font-weight="800" font-size="196"
      letter-spacing="-5" dominant-baseline="central">
      <tspan fill="${t1}">Tameer</tspan><tspan fill="${t2}">Book</tspan></text></svg>`;
}

/* ---- render ------------------------------------------------------------- */
function render(svg, file, size) {
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0,0,0,0)',
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Inter' },
  });
  fs.writeFileSync(path.join(ASSETS, file), r.render().asPng());
  console.log('  ✓', file);
}

console.log('Generating TameerBook soft logo assets…');
fs.writeFileSync(path.join(ASSETS, 'logo.svg'), svgIcon({ size: 1024, rounded: true }));
console.log('  ✓ logo.svg (vector source)');

render(svgIcon({ size: 1024 }),                'icon.png', 1024);
render(svgIcon({ size: 64 }),                  'favicon.png', 64);
render(svgIcon({ size: 1024, rounded: true }), 'splash-icon.png', 1024);
render(svgBackground(512),                     'android-icon-background.png', 512);
render(svgForeground(),                        'android-icon-foreground.png', 512);
render(svgForeground({ mono: true }),          'android-icon-monochrome.png', 512);
render(svgWordmark({ variant: 'dark' }),       'wordmark-on-light.png', 1820);
render(svgWordmark({ variant: 'light' }),      'wordmark-on-dark.png', 1820);
console.log('Done.');
