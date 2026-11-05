// 氣候類型的結構化判讀條件（#2）：每個類型有「氣溫條件」與「降水條件」，
// 由有限種類的可計算規則組成。建置題庫時用它產生逐項解析，驗證時用它找出可能兩解的題目。
import { summerMonthIndexes } from './koppen';
import { fmt0, fmt1 } from './stats';
import type { Hemisphere } from './types';

export type Rule =
  | { kind: 'tMin'; gte?: number; lt?: number }
  | { kind: 'tMax'; gte?: number; lt?: number }
  | { kind: 'tRange'; gte?: number; lt?: number }
  | { kind: 'pTotal'; gte?: number; lt?: number }
  | { kind: 'pMonthMin'; gte?: number; lt?: number }
  | { kind: 'dryMonths'; below: number; gte: number }
  | { kind: 'summerShare'; gte?: number; lt?: number }
  | { kind: 'winterShare'; gte?: number; lt?: number }
  | { kind: 'summerDriest'; lt: number }
  | { kind: 'maxMinRatio'; lt: number }
  | { kind: 'any' };

export interface Criterion {
  /** 給學生看的條件說明，例如「最冷月 18°C 以上（全年高溫）」 */
  text: string;
  /** 全部成立才算符合 */
  rules: Rule[];
}

export interface TypeCriteria {
  temperature: Criterion;
  precipitation: Criterion;
}

export interface Check {
  pass: boolean;
  /** 已組好的說明：需要…；此圖… */
  text: string;
}

export interface DistractorCheck {
  temperature: Check;
  precipitation: Check;
}

interface ChartData {
  temperatureC: readonly number[];
  precipitationMm: readonly number[];
  hemisphere: Hemisphere;
}

function inRange(v: number, r: { gte?: number; lt?: number }): boolean {
  return (r.gte === undefined || v >= r.gte) && (r.lt === undefined || v < r.lt);
}

/** 赤道資料沒有明確冬夏，以北半球月份計算季節比例 */
function shares(d: ChartData) {
  const idx = summerMonthIndexes(d.hemisphere === 'south' ? 'south' : 'north');
  const total = d.precipitationMm.reduce((a, b) => a + b, 0);
  const summer = idx.reduce((a, i) => a + d.precipitationMm[i], 0);
  return { idx, total, summer: total ? summer / total : 0.5 };
}

const SEASON_NOTE = (d: ChartData) => (d.hemisphere === 'south' ? '（南半球夏半年為 10～3 月）' : '');

/** 計算單一規則：回傳是否成立與觀察到的數值描述 */
export function evaluateRule(rule: Rule, d: ChartData): { pass: boolean; observed: string | null } {
  const t = d.temperatureC;
  const p = d.precipitationMm;
  switch (rule.kind) {
    case 'tMin': {
      const v = Math.min(...t);
      return { pass: inRange(v, rule), observed: `最冷月 ${fmt1(v)}°C` };
    }
    case 'tMax': {
      const v = Math.max(...t);
      return { pass: inRange(v, rule), observed: `最熱月 ${fmt1(v)}°C` };
    }
    case 'tRange': {
      const v = Math.max(...t) - Math.min(...t);
      return { pass: inRange(v, rule), observed: `年溫差 ${fmt1(v)}°C` };
    }
    case 'pTotal': {
      const v = p.reduce((a, b) => a + b, 0);
      return { pass: inRange(v, rule), observed: `年雨量約 ${fmt0(v)} mm` };
    }
    case 'pMonthMin': {
      const v = Math.min(...p);
      return { pass: inRange(v, rule), observed: `最少雨月 ${fmt0(v)} mm` };
    }
    case 'dryMonths': {
      const n = p.filter((x) => x < rule.below).length;
      return { pass: n >= rule.gte, observed: n ? `有 ${n} 個月雨量少於 ${rule.below} mm` : `沒有雨量少於 ${rule.below} mm 的月份` };
    }
    case 'summerShare': {
      const s = shares(d);
      return { pass: inRange(s.summer, rule), observed: `夏半年雨量占全年 ${Math.round(s.summer * 100)}%${SEASON_NOTE(d)}` };
    }
    case 'winterShare': {
      const s = shares(d);
      const w = 1 - s.summer;
      return { pass: inRange(w, rule), observed: `冬半年雨量占全年 ${Math.round(w * 100)}%${SEASON_NOTE(d)}` };
    }
    case 'summerDriest': {
      const { idx } = shares(d);
      const v = Math.min(...idx.map((i) => p[i]));
      return { pass: v < rule.lt, observed: `夏半年最乾的月份 ${fmt0(v)} mm` };
    }
    case 'maxMinRatio': {
      const mx = Math.max(...p);
      const mn = Math.min(...p);
      const r = mn > 0 ? mx / mn : Infinity;
      return { pass: r < rule.lt, observed: `最多雨月是最少雨月的 ${Number.isFinite(r) ? fmt1(r) : '很多'} 倍` };
    }
    case 'any':
      return { pass: true, observed: null };
  }
}

export function evaluateCriterion(c: Criterion, d: ChartData): Check {
  const results = c.rules.map((r) => evaluateRule(r, d));
  const pass = results.every((r) => r.pass);
  const observed = [...new Set(results.map((r) => r.observed).filter((x): x is string => !!x))];
  if (!observed.length) return { pass, text: c.text };
  return { pass, text: `需要${c.text}；此圖${observed.join('、')}` };
}

export function evaluateType(criteria: TypeCriteria, d: ChartData): DistractorCheck {
  return {
    temperature: evaluateCriterion(criteria.temperature, d),
    precipitation: evaluateCriterion(criteria.precipitation, d),
  };
}

/** 依逐項結果組出一句總結，給舊畫面或簡短顯示使用 */
export function summarizeCheck(label: string, c: DistractorCheck): string {
  const t = c.temperature.pass ? '氣溫條件符合' : '氣溫條件不符';
  const p = c.precipitation.pass ? '降水條件符合' : '降水條件不符';
  return `「${label}」：${t}，${p}。`;
}
