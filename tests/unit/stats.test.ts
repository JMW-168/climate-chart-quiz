import { describe, expect, it } from 'vitest';
import { annualMeanTemp, annualPrecip, annualRange, computeScale, fmt1, summarize } from '../../src/domain/stats';

const t = [24, 25, 27, 29, 30, 29, 27, 27, 27, 27, 26, 24];
const p = [2, 3, 10, 35, 90, 160, 220, 240, 170, 60, 10, 3];

describe('G02 年度摘要與年溫差', () => {
  it('年均溫為 12 月算術平均', () => {
    expect(annualMeanTemp(t)).toBeCloseTo(26.8333, 3);
    expect(fmt1(annualMeanTemp(t))).toBe('26.8');
  });
  it('年降水量為 12 月加總', () => {
    expect(annualPrecip(p)).toBe(1003);
  });
  it('年溫差以未四捨五入值計算', () => {
    expect(annualRange([-0.04, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10.04])).toBeCloseTo(10.08, 5);
    expect(fmt1(annualRange([-0.04, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10.04]))).toBe('10.1');
  });
  it('fmt1 不顯示 -0.0', () => {
    expect(fmt1(-0.02)).toBe('0.0');
  });
  it('summarize 找出最熱／最冷月', () => {
    const s = summarize(t, p);
    expect(s.maxTempMonth).toBe(5);
    expect(s.minTempMonth).toBe(1);
    expect(s.maxPrecipMonth).toBe(8);
  });
});

describe('G01 圖表尺度', () => {
  it('預設 −40～40°C、0～400 mm', () => {
    expect(computeScale([{ temperatureC: t, precipitationMm: p }])).toEqual({ tempMin: -40, tempMax: 40, precipMax: 400 });
  });
  it('超出時向外擴展到 10°C／100 mm 的整數倍，四圖取共同尺度', () => {
    const s = computeScale([
      { temperatureC: t, precipitationMm: [0, 0, 0, 0, 0, 580, 0, 0, 0, 0, 0, 0] },
      { temperatureC: [-41, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 42], precipitationMm: p },
    ]);
    expect(s).toEqual({ tempMin: -50, tempMax: 50, precipMax: 600 });
  });
});
