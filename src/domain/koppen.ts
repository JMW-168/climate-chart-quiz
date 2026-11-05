// 柯本（Köppen–Geiger）氣候分類，依 Peel 等人（2007）的門檻。
// 僅作為示範／審核資料的交叉檢查工具，不等於臺灣教材的分類用語。
import type { Hemisphere } from './types';

/** 夏半年月份索引（0 起算）：北半球 4–9 月；南半球 10–3 月 */
export function summerMonthIndexes(hemisphere: Hemisphere): number[] {
  return hemisphere === 'south' ? [9, 10, 11, 0, 1, 2] : [3, 4, 5, 6, 7, 8];
}

export function koppen(temps: readonly number[], precip: readonly number[], hemisphere: Hemisphere): string {
  const mat = temps.reduce((a, b) => a + b, 0) / 12;
  const map = precip.reduce((a, b) => a + b, 0);
  const tHot = Math.max(...temps);
  const tCold = Math.min(...temps);

  // E：最熱月 < 10°C
  if (tHot < 10) return tHot > 0 ? 'ET' : 'EF';

  const sIdx = summerMonthIndexes(hemisphere);
  const wIdx = [...Array(12).keys()].filter((i) => !sIdx.includes(i));
  const pSummer = sIdx.reduce((a, i) => a + precip[i], 0);
  const pWinter = map - pSummer;

  // B：乾燥門檻（mm）＝ 20×年均溫 ＋ 280／140／0
  let add = 140;
  if (hemisphere !== 'equatorial') {
    if (pSummer >= 0.7 * map) add = 280;
    else if (pWinter >= 0.7 * map) add = 0;
  }
  const threshold = 20 * mat + add;
  if (map < threshold) return `${map < threshold / 2 ? 'BW' : 'BS'}${mat >= 18 ? 'h' : 'k'}`;

  // A：最冷月 ≥ 18°C
  if (tCold >= 18) {
    const pDry = Math.min(...precip);
    if (pDry >= 60) return 'Af';
    if (pDry >= 100 - map / 25) return 'Am';
    return 'Aw';
  }

  // C／D：最冷月 0°C 為界
  const group = tCold > 0 ? 'C' : 'D';
  const sDry = Math.min(...sIdx.map((i) => precip[i]));
  const sWet = Math.max(...sIdx.map((i) => precip[i]));
  const wDry = Math.min(...wIdx.map((i) => precip[i]));
  const wWet = Math.max(...wIdx.map((i) => precip[i]));
  let second = 'f';
  if (hemisphere !== 'equatorial') {
    if (sDry < 40 && sDry < wWet / 3) second = 's';
    else if (wDry < sWet / 10) second = 'w';
  }
  const warmMonths = temps.filter((t) => t >= 10).length;
  let third = 'c';
  if (tHot >= 22) third = 'a';
  else if (warmMonths >= 4) third = 'b';
  else if (group === 'D' && tCold < -38) third = 'd';
  return `${group}${second}${third}`;
}

export function matchesKoppen(code: string, accepted: readonly string[]): boolean {
  return accepted.some((p) => code.startsWith(p));
}
