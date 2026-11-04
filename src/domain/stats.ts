// 氣候圖統計計算（規格 §5）。圖表與摘要都從同一份原始資料計算。

import type { ChartScale } from './types';

export const DEFAULT_SCALE: ChartScale = { tempMin: -40, tempMax: 40, precipMax: 400 };

export function annualMeanTemp(temps: readonly number[]): number {
  return temps.reduce((a, b) => a + b, 0) / temps.length;
}

export function annualPrecip(precip: readonly number[]): number {
  return precip.reduce((a, b) => a + b, 0);
}

/** 年溫差＝最高月均溫−最低月均溫（未四捨五入） */
export function annualRange(temps: readonly number[]): number {
  return Math.max(...temps) - Math.min(...temps);
}

/** 顯示 1 位小數，避免 -0.0 */
export function fmt1(n: number): string {
  const r = Math.round(n * 10) / 10;
  return (Object.is(r, -0) ? 0 : r).toFixed(1);
}

export function fmt0(n: number): string {
  return String(Math.round(n));
}

export interface ClimateSummary {
  meanTemp: number;
  totalPrecip: number;
  range: number;
  maxTempMonth: number;
  minTempMonth: number;
  maxPrecipMonth: number;
  minPrecipMonth: number;
}

function argMax(xs: readonly number[]): number {
  let idx = 0;
  xs.forEach((x, i) => { if (x > xs[idx]) idx = i; });
  return idx;
}
function argMin(xs: readonly number[]): number {
  let idx = 0;
  xs.forEach((x, i) => { if (x < xs[idx]) idx = i; });
  return idx;
}

export function summarize(temps: readonly number[], precip: readonly number[]): ClimateSummary {
  return {
    meanTemp: annualMeanTemp(temps),
    totalPrecip: annualPrecip(precip),
    range: annualRange(temps),
    maxTempMonth: argMax(temps) + 1,
    minTempMonth: argMin(temps) + 1,
    maxPrecipMonth: argMax(precip) + 1,
    minPrecipMonth: argMin(precip) + 1,
  };
}

/**
 * 計算圖表尺度：預設氣溫 −40～40°C、雨量 0～400 mm；
 * 超出時向外擴展到 10°C／100 mm 的整數倍，不裁切、不斷軸。
 * 多張圖（Q2 四圖）傳入全部資料取共同尺度。
 */
export function computeScale(charts: { temperatureC: readonly number[]; precipitationMm: readonly number[] }[]): ChartScale {
  let tMin = DEFAULT_SCALE.tempMin;
  let tMax = DEFAULT_SCALE.tempMax;
  let pMax = DEFAULT_SCALE.precipMax;
  for (const c of charts) {
    const lo = Math.min(...c.temperatureC);
    const hi = Math.max(...c.temperatureC);
    const p = Math.max(...c.precipitationMm);
    if (lo < tMin) tMin = Math.floor(lo / 10) * 10;
    if (hi > tMax) tMax = Math.ceil(hi / 10) * 10;
    if (p > pMax) pMax = Math.ceil(p / 100) * 100;
  }
  return { tempMin: tMin, tempMax: tMax, precipMax: pMax };
}
