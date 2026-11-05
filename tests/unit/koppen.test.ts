import { describe, expect, it } from 'vitest';
import { koppen, matchesKoppen } from '../../src/domain/koppen';
import { validateContentPackage } from '../../src/domain/validation';
import { demoPackage } from './helpers';

describe('柯本分類計算', () => {
  it('熱帶：Af／Am／Aw', () => {
    const t = Array(12).fill(27);
    expect(koppen(t, Array(12).fill(200), 'equatorial')).toBe('Af');
    expect(koppen(t, [5, 5, 15, 60, 300, 520, 580, 560, 380, 200, 40, 8], 'north')).toBe('Am');
    expect(koppen(t, [2, 3, 10, 35, 90, 160, 220, 240, 170, 60, 10, 3], 'north')).toBe('Aw');
  });
  it('乾燥：高溫下同樣雨量可能是沙漠', () => {
    const hot = [24, 27, 31, 34, 35, 33, 30, 28, 29, 30, 28, 25];
    expect(koppen(hot, [0, 0, 1, 3, 15, 40, 90, 120, 55, 10, 1, 0], 'north')).toBe('BWh');
    expect(koppen([14, 16, 20, 24, 27, 29, 29, 28, 26, 23, 18, 15], [2, 3, 5, 10, 25, 60, 120, 120, 55, 15, 3, 2], 'north')).toBe('BSh');
  });
  it('南半球的夏半年是 10～3 月', () => {
    // 冬（6–8 月）多雨、夏乾 → 地中海型
    expect(koppen([22, 22.5, 21, 18, 15, 13, 12, 13, 14.5, 17, 19, 21], [12, 15, 18, 45, 90, 110, 95, 80, 50, 35, 20, 15], 'south')).toBe('Csa');
  });
  it('最冷月 0°C 為 C／D 分界；冬乾為 w', () => {
    expect(koppen([-2.5, 0, 5, 12, 17.5, 22, 25.5, 26.5, 22, 15.5, 8, 1], [20, 25, 45, 75, 95, 135, 370, 270, 140, 50, 35, 20], 'north')).toBe('Dwa');
  });
  it('寒帶', () => {
    expect(koppen([-28, -28, -25, -17, -6, 2, 6, 5, 0, -9, -19, -25], Array(12).fill(10), 'north')).toBe('ET');
    expect(koppen(Array(12).fill(-30), Array(12).fill(5), 'north')).toBe('EF');
  });
  it('前綴比對', () => {
    expect(matchesKoppen('Csb', ['Cs'])).toBe(true);
    expect(matchesKoppen('Cfb', ['Cs'])).toBe(false);
  });
});

describe('#1 內容驗證的柯本交叉檢查', () => {
  it('示範資料全部與所標類型一致', () => {
    const r = validateContentPackage(demoPackage());
    expect(r.errors.filter((e) => e.code === 'koppen-mismatch')).toEqual([]);
  });
  it('不一致且無例外說明 → 驗證失敗並回報資料ID', () => {
    const pkg = demoPackage();
    const d = pkg.datasets.find((x) => x.id === 'demo-steppe-b')!;
    d.temperatureC = [24, 27, 31, 34, 35, 33, 30, 28, 29, 30, 28, 25];
    d.precipitationMm = [0, 0, 1, 3, 15, 40, 90, 120, 55, 10, 1, 0];
    const r = validateContentPackage(pkg);
    expect(r.errors.find((e) => e.code === 'koppen-mismatch')?.id).toBe('demo-steppe-b');
  });
  it('寫明例外原因 → 降為警告', () => {
    const pkg = demoPackage();
    const d = pkg.datasets.find((x) => x.id === 'demo-steppe-b')!;
    d.temperatureC = [24, 27, 31, 34, 35, 33, 30, 28, 29, 30, 28, 25];
    d.precipitationMm = [0, 0, 1, 3, 15, 40, 90, 120, 55, 10, 1, 0];
    d.koppenException = '教材將此測站列為草原，審核人確認';
    const r = validateContentPackage(pkg);
    expect(r.errors.some((e) => e.code === 'koppen-mismatch')).toBe(false);
    expect(r.warnings.some((w) => w.code === 'koppen-exception')).toBe(true);
  });
});
