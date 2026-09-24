// Renders the chat wallpaper tiles from assets/wallpapers/doodle.svg (the
// WhatsApp doodle as a vector, strokes in currentColor) in each preset's
// colours, at 2x, as seamless PNG tiles. Run: node scripts/render-wallpapers.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const PRESETS = [
  { id: 'classic', bg: '#EFEAE2', ink: '#1D1C18', inkAlpha: 0.11 },
  { id: 'white', bg: '#F6F5F2', ink: '#1D1C18', inkAlpha: 0.09 },
  { id: 'sage', bg: '#E3EEE6', ink: '#1FA15D', inkAlpha: 0.2 },
  { id: 'night', bg: '#0B1410', ink: '#F0ECE3', inkAlpha: 0.08 },
];

const svg = readFileSync('assets/wallpapers/doodle.svg', 'utf8');
const [, w, h] = /viewBox="0 0 (\d+) (\d+)"/.exec(svg) ?? [];
for (const p of PRESETS) {
  const alpha = Math.round(p.inkAlpha * 255).toString(16).padStart(2, '0');
  const tinted = svg
    .replace(/currentColor/g, `${p.ink}${alpha}`)
    .replace('<svg ', `<svg style="background:${p.bg}" `)
    .replace(/(<svg[^>]*>)/, `$1<rect width="${w}" height="${h}" fill="${p.bg}"/>`);
  const png = new Resvg(tinted, { fitTo: { mode: 'zoom', value: 2 }, background: p.bg }).render().asPng();
  writeFileSync(`assets/wallpapers/${p.id}.png`, png);
  console.log(p.id, png.length, 'bytes');
}
