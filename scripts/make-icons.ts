// 產生 PWA 圖示（一次性，輸出已提交到 public/icons/）。需要 sharp：npm i -D sharp 後執行 npm run icons。
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { root } from './lib/load-content';

const require = createRequire(import.meta.url);
const sharp = require('sharp') as (input: Buffer) => { resize(w: number, h: number): { png(): { toFile(p: string): Promise<unknown> } } };

function svg(maskable: boolean): string {
  // maskable 需留 20% 安全邊界
  const pad = maskable ? 104 : 40;
  const inner = 512 - pad * 2;
  const s = (v: number) => pad + (v / 32) * inner;
  const bars = [
    [6, 18, 4, 9], [12, 12, 4, 15], [18, 8, 4, 19], [24, 15, 4, 12],
  ].map(([x, y, w, h]) => `<rect x="${s(x)}" y="${s(y)}" width="${(w / 32) * inner}" height="${(h / 32) * inner}" fill="#2e6fb7"/>`).join('');
  const pts = [[8, 14], [14, 9], [20, 6], [26, 11]].map(([x, y]) => `${s(x)},${s(y)}`).join(' ');
  const bg = maskable
    ? `<rect width="512" height="512" fill="#1d3557"/><rect x="${pad - 24}" y="${pad - 24}" width="${inner + 48}" height="${inner + 48}" rx="40" fill="#fff"/>`
    : `<rect x="16" y="16" width="480" height="480" rx="96" fill="#1d3557"/><rect x="${pad + 8}" y="${pad + 8}" width="${inner - 16}" height="${inner - 16}" rx="56" fill="#fff"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg}${bars}<polyline points="${pts}" fill="none" stroke="#c8372d" stroke-width="${inner / 13}" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

const out = join(root, 'public', 'icons');
writeFileSync(join(out, 'favicon.svg'), svg(false));
const jobs: [boolean, number, string][] = [
  [false, 192, 'icon-192.png'], [false, 512, 'icon-512.png'],
  [true, 192, 'maskable-192.png'], [true, 512, 'maskable-512.png'],
  [true, 180, 'apple-touch-icon.png'],
];
for (const [m, size, name] of jobs) await sharp(Buffer.from(svg(m))).resize(size, size).png().toFile(join(out, name));
console.log('圖示已產生');
