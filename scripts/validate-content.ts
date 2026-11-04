// 內容驗證：npm run content:validate [-- --production]
// production 模式額外檢查 C03（教材映射、來源、授權、審核紀錄）。
import { validateContentPackage } from '../src/domain/validation';
import { generateSession } from '../src/domain/generator';
import { loadSourceContent } from './lib/load-content';

const production = process.argv.includes('--production');
const { pkg } = loadSourceContent(production ? 'production' : undefined);
const result = validateContentPackage(pkg);

for (const e of result.errors) console.error(`✗ [${e.code}] ${e.id}：${e.message}`);
const warnCounts = new Map<string, number>();
for (const w of result.warnings) warnCounts.set(w.code, (warnCounts.get(w.code) ?? 0) + 1);
for (const w of result.warnings.filter((x) => x.code !== 'explanation-reason-gap')) console.warn(`! [${w.code}] ${w.id}：${w.message}`);
if (warnCounts.get('explanation-reason-gap')) console.warn(`! [explanation-reason-gap] ${warnCounts.get('explanation-reason-gap')} 筆`);

// 組題煙霧測試：每種難度、題型都試組一次，回報具體資料ID（C02）
if (result.ok) {
  for (const difficulty of ['beginner', 'standard', 'advanced'] as const) {
    for (const kind of ['chart-to-type', 'type-to-chart'] as const) {
      const r = generateSession(pkg, { kind, typeIds: [], difficulty, count: 1000 }, 1);
      for (const p of r.problems) console.error(`✗ [C02] ${p.id}：${p.message}`);
      if (r.problems.length) result.ok = false;
      console.log(`  ${difficulty}／${kind}：可組 ${r.available} 題`);
    }
  }
}

console.log(`\n模式：${pkg.mode}｜版本：${pkg.contentVersion}｜類型 ${pkg.taxonomy.types.length}｜資料 ${pkg.datasets.length}｜錯誤 ${result.errors.length}｜警告 ${result.warnings.length}`);
if (!result.ok) {
  console.error('內容驗證失敗，不能發布。');
  process.exit(1);
}
console.log('內容驗證通過。');
