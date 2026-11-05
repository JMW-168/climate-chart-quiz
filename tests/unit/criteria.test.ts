import { describe, expect, it } from 'vitest';
import { evaluateCriterion, evaluateRule, evaluateType } from '../../src/domain/criteria';
import { generateSession } from '../../src/domain/generator';
import { validateContentPackage } from '../../src/domain/validation';
import { demoPackage } from './helpers';

const chart = (t: number[], p: number[], hemisphere: 'north' | 'south' | 'equatorial' = 'north') => ({ temperatureC: t, precipitationMm: p, hemisphere });

describe('判讀規則計算', () => {
  const d = chart([7, 9, 13, 18, 22, 26, 28, 27.5, 24.5, 19, 13, 8.5], [80, 85, 100, 95, 110, 140, 160, 150, 120, 80, 75, 80]);
  it('氣溫規則與觀察文字', () => {
    expect(evaluateRule({ kind: 'tMax', lt: 22 }, d)).toEqual({ pass: false, observed: '最熱月 28.0°C' });
    expect(evaluateRule({ kind: 'tMin', gte: 0 }, d).pass).toBe(true);
    expect(evaluateRule({ kind: 'tRange', gte: 20 }, d).observed).toBe('年溫差 21.0°C');
  });
  it('季節雨量依半球計算', () => {
    const north = evaluateRule({ kind: 'winterShare', gte: 0.6 }, chart(Array(12).fill(15), [90, 85, 60, 40, 20, 8, 2, 5, 25, 70, 100, 110]));
    expect(north.pass).toBe(true);
    const south = evaluateRule({ kind: 'winterShare', gte: 0.6 }, chart(Array(12).fill(15), [12, 15, 18, 45, 90, 110, 95, 80, 50, 35, 20, 15], 'south'));
    expect(south.pass).toBe(true);
    expect(south.observed).toContain('南半球');
  });
  it('條件全部成立才算符合，文字列出需要與觀察', () => {
    const c = evaluateCriterion({ text: '冬暖夏涼', rules: [{ kind: 'tMin', gte: 0 }, { kind: 'tMax', lt: 22 }] }, d);
    expect(c.pass).toBe(false);
    expect(c.text).toBe('需要冬暖夏涼；此圖最冷月 7.0°C、最熱月 28.0°C');
  });
});

describe('#2 示範題庫逐項判讀', () => {
  const pkg = demoPackage();
  it('每組資料都符合自己類型的兩項條件', () => {
    for (const d of pkg.datasets) {
      const t = pkg.taxonomy.types.find((x) => x.id === d.typeId)!;
      const c = evaluateType(t.criteria!, d);
      expect([d.id, c.temperature.pass, c.precipitation.pass]).toEqual([d.id, true, true]);
    }
  });
  it('只有一項不符的例子：瀋陽（溫帶季風）選溫帶大陸性 → 氣溫符合、降水不符', () => {
    const exp = pkg.explanations.find((e) => e.id === 'wmo-temperate-monsoon-shenyang-explanation')!;
    const c = exp.distractorChecks!['continental'];
    expect(c.temperature.pass).toBe(true);
    expect(c.precipitation.pass).toBe(false);
    expect(c.precipitation.text).toContain('最少雨月 6 mm');
  });
  it('所有題目的每個錯誤選項都有逐項判斷，且至少一項不符', () => {
    for (const kind of ['chart-to-type', 'type-to-chart'] as const) {
      for (const difficulty of ['beginner', 'standard', 'advanced'] as const) {
        for (let seed = 1; seed <= 10; seed++) {
          for (const q of generateSession(pkg, { kind, typeIds: [], difficulty, count: 10 }, seed).questions) {
            for (const o of q.options) {
              if (o.id === q.correctOptionId) continue;
              const c = q.explanation.optionChecks?.[o.id];
              expect(c, `${q.id} ${o.id}`).toBeTruthy();
              expect(c!.temperature.pass && c!.precipitation.pass).toBe(false);
            }
          }
        }
      }
    }
  });
  it('錯誤選項兩項都符合 → 驗證失敗（可能兩解）', () => {
    const p2 = demoPackage();
    const t = p2.taxonomy.types.find((x) => x.id === 'continental')!;
    t.criteria!.precipitation.rules = [{ kind: 'any' }];
    const r = validateContentPackage(p2);
    expect(r.errors.some((e) => e.code === 'criteria-ambiguous' && e.id === 'wmo-temperate-monsoon-shenyang')).toBe(true);
  });
  it('資料不符合自己類型的條件 → 驗證失敗', () => {
    const p2 = demoPackage();
    p2.datasets.find((x) => x.id === 'wmo-polar-utqiagvik-barrow')!.temperatureC[6] = 12;
    const r = validateContentPackage(p2);
    expect(r.errors.some((e) => e.code === 'criteria-self' && e.id === 'wmo-polar-utqiagvik-barrow')).toBe(true);
  });
});
