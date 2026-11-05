import { describe, expect, it } from 'vitest';
import { validateContentPackage } from '../../src/domain/validation';
import { generateSession } from '../../src/domain/generator';
import { demoPackage } from './helpers';

describe('示範內容包', () => {
  it('通過驗證', () => {
    const r = validateContentPackage(demoPackage());
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });
});

describe('C01 月資料錯誤不能發布', () => {
  it('少於 12 項', () => {
    const pkg = demoPackage();
    pkg.datasets[0].temperatureC = pkg.datasets[0].temperatureC.slice(0, 11);
    const r = validateContentPackage(pkg);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.code === 'dataset-temperature' && e.id === pkg.datasets[0].id)).toBe(true);
  });
  it('負雨量', () => {
    const pkg = demoPackage();
    pkg.datasets[1].precipitationMm[3] = -1;
    expect(validateContentPackage(pkg).errors.some((e) => e.code === 'dataset-negative-precip')).toBe(true);
  });
  it('NaN', () => {
    const pkg = demoPackage();
    pkg.datasets[2].temperatureC[0] = Number.NaN;
    expect(validateContentPackage(pkg).ok).toBe(false);
  });
});

describe('C02 重疊、缺解析或引用不存在', () => {
  it('引用不存在的解析', () => {
    const pkg = demoPackage();
    pkg.datasets[0].explanationId = 'nope';
    const r = validateContentPackage(pkg);
    expect(r.errors.find((e) => e.code === 'dataset-explanation')?.id).toBe(pkg.datasets[0].id);
  });
  it('缺少混淆類型的錯誤選項解析', () => {
    const pkg = demoPackage();
    const d = pkg.datasets[0];
    const exp = pkg.explanations.find((e) => e.id === d.explanationId)!;
    const t = pkg.taxonomy.types.find((x) => x.id === d.typeId)!;
    delete exp.distractorReasons[t.confusableTypeIds[0]];
    const r = validateContentPackage(pkg);
    expect(r.errors.some((e) => e.code === 'explanation-missing-reason' && e.id === d.id)).toBe(true);
  });
  it('重疊關係須雙向，且不可同時當干擾', () => {
    const pkg = demoPackage();
    const marine = pkg.taxonomy.types.find((x) => x.id === 'marine-west-coast')!;
    const cont = pkg.taxonomy.types.find((x) => x.id === 'continental')!;
    marine.overlapTypeIds.push('continental');
    cont.overlapTypeIds.push('marine-west-coast');
    expect(validateContentPackage(pkg).errors.some((e) => e.code === 'overlap-confusable')).toBe(true);
  });
  it('相關名稱不可當同義詞', () => {
    const pkg = demoPackage();
    pkg.taxonomy.types[0].aliases.push(pkg.taxonomy.types[1].label);
    expect(validateContentPackage(pkg).errors.some((e) => e.code === 'alias-conflict')).toBe(true);
  });
  it('組題時缺干擾解析會回報具體資料ID', () => {
    const pkg = demoPackage();
    const d = pkg.datasets.find((x) => x.typeId === 'polar' && x.difficulty.includes('beginner'))!;
    const exp = pkg.explanations.find((e) => e.id === d.explanationId)!;
    exp.distractorReasons = {};
    const r = generateSession(pkg, { kind: 'chart-to-type', typeIds: ['polar'], difficulty: 'beginner', count: 1 }, 3);
    expect(r.problems.map((p) => p.id)).toContain(d.id);
    expect(r.questions).toHaveLength(0);
  });
});

describe('C03 正式內容檢查', () => {
  it('示範資料不能以 production 模式發布', () => {
    const pkg = demoPackage();
    pkg.mode = 'production';
    const r = validateContentPackage(pkg);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.code.startsWith('C03'))).toBe(true);
  });
  it('production 模式不使用 draft 資料出題', () => {
    const pkg = demoPackage();
    pkg.mode = 'production';
    const r = generateSession(pkg, { kind: 'mixed', typeIds: [], difficulty: 'standard', count: 10 }, 1);
    expect(r.questions).toHaveLength(0);
  });
});
