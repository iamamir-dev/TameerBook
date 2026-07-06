/**
 * logo-concepts.js — render candidate TameerBook marks for comparison.
 * Applies 2026 app-icon practice: mesh gradient bg (analogous greens + warm
 * glow), simple light foreground, soft-3D / glass depth, grid-built symbols.
 * Outputs assets/_concepts/c{1..4}.png at 512.  Run: node scripts/logo-concepts.js
 */
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const OUT = path.join(__dirname, '..', 'assets', '_concepts');
fs.mkdirSync(OUT, { recursive: true });
const S = 512, CX = 256;

const DEFS = `
<defs>
  <linearGradient id="baseG" x1="0" y1="0" x2="0.9" y2="1">
    <stop offset="0" stop-color="#1B7A57"/>
    <stop offset="0.55" stop-color="#0E3B2E"/>
    <stop offset="1" stop-color="#06241B"/>
  </linearGradient>
  <radialGradient id="blobTeal" cx="0.18" cy="0.12" r="0.6">
    <stop offset="0" stop-color="#2FB58A" stop-opacity="0.55"/>
    <stop offset="1" stop-color="#2FB58A" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="blobGold" cx="0.9" cy="0.92" r="0.7">
    <stop offset="0" stop-color="#E0BE4A" stop-opacity="0.30"/>
    <stop offset="1" stop-color="#E0BE4A" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="topGlow" cx="0.5" cy="0.0" r="0.9">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.16"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="white3d" x1="0" y1="0" x2="0.2" y2="1">
    <stop offset="0" stop-color="#FFFFFF"/>
    <stop offset="1" stop-color="#DDE8E3"/>
  </linearGradient>
  <linearGradient id="goldG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#E6C654"/>
    <stop offset="1" stop-color="#C49A1E"/>
  </linearGradient>
  <linearGradient id="accentG" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#F2A062"/>
    <stop offset="1" stop-color="#E8833A"/>
  </linearGradient>
  <linearGradient id="glassG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.45"/>
    <stop offset="1" stop-color="#FFFFFF" stop-opacity="0.12"/>
  </linearGradient>
  <filter id="shadow" x="-30%" y="-30%" width="160%" height="170%">
    <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#03130D" flood-opacity="0.40"/>
  </filter>
  <filter id="softShadow" x="-30%" y="-30%" width="160%" height="170%">
    <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#03130D" flood-opacity="0.30"/>
  </filter>
</defs>`;

function tile() {
  const r = S * 0.235;
  return `
    <rect width="${S}" height="${S}" rx="${r}" fill="url(#baseG)"/>
    <rect width="${S}" height="${S}" rx="${r}" fill="url(#blobTeal)"/>
    <rect width="${S}" height="${S}" rx="${r}" fill="url(#blobGold)"/>
    <rect width="${S}" height="${S}" rx="${r}" fill="url(#topGlow)"/>`;
}

/* C1 — "Ascent": one unified upward arrow (growth + spire), gold base */
function c1() {
  const apex = 130, sw = 80;
  return `
  <g filter="url(#shadow)">
    <rect x="${CX - 100}" y="392" width="200" height="40" rx="20" fill="url(#goldG)"/>
    <path d="M ${CX} ${apex} L ${CX} ${360}"
      fill="none" stroke="url(#white3d)" stroke-width="${sw}" stroke-linecap="round"/>
    <path d="M ${CX - 124} ${apex + 116} L ${CX} ${apex} L ${CX + 124} ${apex + 116}"
      fill="none" stroke="url(#white3d)" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;
}

/* C2 — "Build-up": offset stacked blocks (foundation→growth), top block gold */
function c2() {
  const s = 118, r = 30;
  const blocks = [
    { x: CX - 150, y: 286, fill: 'url(#white3d)' },
    { x: CX - 40, y: 196, fill: 'url(#white3d)' },
    { x: CX + 70, y: 106, fill: 'url(#goldG)' },
  ];
  return `<g filter="url(#shadow)">${blocks
    .map((b) => `<rect x="${b.x}" y="${b.y}" width="${s}" height="${s}" rx="${r}" fill="${b.fill}"/>`)
    .join('')}</g>`;
}

/* C3 — "Tameer House": rounded building with an upward arrow in negative space */
function c3() {
  const bx = CX - 124, bw = 248, by = 214, bh = 176, br = 30;      // body
  const apexY = 116, eaveY = 214;
  const roof = `M ${CX} ${apexY} L ${CX + 150} ${eaveY + 6} L ${CX - 150} ${eaveY + 6} Z`;
  // negative-space up-arrow (mask: white keeps, black cuts)
  const ax = CX, atop = 244, abot = 360, head = 50, sw = 42;
  const arrow = `
    <path d="M ${ax - head} ${atop + head} L ${ax} ${atop} L ${ax + head} ${atop + head}"
      fill="none" stroke="#000" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M ${ax} ${atop + 8} L ${ax} ${abot}"
      fill="none" stroke="#000" stroke-width="${sw}" stroke-linecap="round"/>`;
  return `
  <defs><mask id="houseMask">
    <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${br}" fill="#fff"/>
    <path d="${roof}" fill="#fff"/>
    ${arrow}
  </mask></defs>
  <g filter="url(#shadow)">
    <path d="${roof}" fill="url(#white3d)" mask="url(#houseMask)" stroke="url(#white3d)" stroke-width="2" stroke-linejoin="round"/>
    <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${br}" fill="url(#white3d)" mask="url(#houseMask)"/>
  </g>`;
}

/* C4 — "Glass T": refined monogram with frosted-glass depth */
function c4() {
  return `
  <g filter="url(#softShadow)">
    <rect x="118" y="150" width="276" height="190" rx="34" fill="url(#glassG)" stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="3"/>
    <rect x="${CX - 46}" y="180" width="92" height="210" rx="22" fill="url(#glassG)" stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="3"/>
    <rect x="${CX - 96}" y="372" width="192" height="40" rx="20" fill="url(#goldG)"/>
  </g>`;
}

function svg(symbol) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${DEFS}${tile()}${symbol}</svg>`;
}

const concepts = { c1, c2, c3, c4 };
for (const [name, fn] of Object.entries(concepts)) {
  const r = new Resvg(svg(fn()), { fitTo: { mode: 'width', value: S } });
  fs.writeFileSync(path.join(OUT, `${name}.png`), r.render().asPng());
  console.log('  ✓', name);
}
console.log('Done →', OUT);
