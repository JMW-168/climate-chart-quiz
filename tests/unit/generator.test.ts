import { describe, expect, it } from 'vitest';
import { buildReviewQuestions, generateSession } from '../../src/domain/generator';
import type { PracticeSettings, QuestionSnapshot } from '../../src/domain/types';
import { demoPackage } from './helpers';

const base: PracticeSettings = { kind: 'mixed', typeIds: [], difficulty: 'standard', count: 10 };

function optionTypeIds(q: QuestionSnapshot): string[] {
  return q.kind === 'cause' ? [] : q.options.map((o) => o.typeId);
}

describe('Q01 固定 seed 重建回合', () => {
  it('同內容版本產生同題序及選項', () => {
    const pkg = demoPackage();
    const a = generateSession(pkg, base, 12345);
    const b = generateSession(pkg, base, 12345);
    expect(a.questions).toEqual(b.questions);
    const c = generateSession(pkg, base, 54321);
    expect(c.questions.map((q) => q.id)).not.toEqual(a.questions.map((q) => q.id));
  });
});

describe('Q02 答案與干擾', () => {
  const pkg = demoPackage();
  const overlaps = new Map(pkg.taxonomy.types.map((t) => [t.id, t.overlapTypeIds]));
  for (const difficulty of ['beginner', 'standard', 'advanced'] as const) {
    for (const kind of ['chart-to-type', 'type-to-chart', 'chart-to-location'] as const) {
      it(`${difficulty}／${kind}：每題恰四選項、恰一正解、無同義或重疊選項`, () => {
        for (let seed = 1; seed <= 25; seed++) {
          const r = generateSession(pkg, { kind, typeIds: [], difficulty, count: 10 }, seed);
          for (const q of r.questions) {
            expect(q.options).toHaveLength(4);
            expect(new Set(q.options.map((o) => o.id)).size).toBe(4);
            const correct = q.options.filter((o) => o.id === q.correctOptionId);
            expect(correct).toHaveLength(1);
            expect(optionTypeIds(q)[q.options.findIndex((o) => o.id === q.correctOptionId)]).toBe(q.targetTypeId);
            const types = optionTypeIds(q);
            expect(new Set(types).size).toBe(4); // 錯誤選項不可與正解同類
            for (const t of types) for (const o of overlaps.get(t) ?? []) expect(types).not.toContain(o);
            for (const o of q.options) {
              if (o.id !== q.correctOptionId) expect(q.explanation.optionReasons[o.id]).toBeTruthy();
            }
            if (q.kind === 'type-to-chart') {
              expect(new Set(q.datasetIds).size).toBe(4);
              expect(q.options.map((o) => o.letter)).toEqual(['A', 'B', 'C', 'D']);
            }
            if (q.kind === 'chart-to-location') {
              expect(q.options.map((o) => o.letter)).toEqual(['A', 'B', 'C', 'D']);
              expect(q.options.find((o) => o.id === q.correctOptionId)!.datasetId).toBe(q.targetDatasetId);
              expect(new Set(q.options.map((o) => o.location.nameZh)).size).toBe(4);
            }
            expect(q.showSummary).toBe(difficulty !== 'advanced');
          }
        }
      });
    }
  }

  it('答案位置不固定', () => {
    const positions = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      for (const q of generateSession(pkg, base, seed).questions) positions.add(q.options.findIndex((o) => o.id === q.correctOptionId));
    }
    expect(positions.size).toBe(4);
  });

  it('同回合目標資料不重複；Q2 已顯示的圖不再成為目標', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const r = generateSession(pkg, { ...base, count: 20 }, seed);
      const shown = new Set<string>();
      for (const q of r.questions) {
        expect(shown.has(q.targetDatasetId)).toBe(false);
        for (const id of q.datasetIds) shown.add(id);
      }
    }
  });

  it('類型篩選只限定正確答案範圍，干擾取其他類型', () => {
    const r = generateSession(pkg, { kind: 'chart-to-type', typeIds: ['mediterranean'], difficulty: 'standard', count: 5 }, 9);
    expect(r.questions.length).toBeGreaterThan(0);
    for (const q of r.questions) {
      expect(q.targetTypeId).toBe('mediterranean');
      expect(optionTypeIds(q).filter((t) => t === 'mediterranean')).toHaveLength(1);
    }
  });

  it('各類型題數差最多 1（資料足夠的類型之間）', () => {
    const r = generateSession(pkg, { kind: 'chart-to-type', typeIds: [], difficulty: 'standard', count: 20 }, 4);
    const counts = new Map<string, number>();
    for (const q of r.questions) counts.set(q.targetTypeId, (counts.get(q.targetTypeId) ?? 0) + 1);
    const vals = [...counts.values()];
    expect(Math.max(...vals) - Math.min(...vals)).toBeLessThanOrEqual(1);
  });
});

describe('Q03 題目不足', () => {
  it('回報實際題數，不重複湊題、不無限迴圈', () => {
    const pkg = demoPackage();
    const r = generateSession(pkg, { kind: 'chart-to-type', typeIds: ['polar'], difficulty: 'beginner', count: 20 }, 7);
    expect(r.available).toBe(1);
    expect(r.questions).toHaveLength(1);
    expect(r.notices.join('')).toContain('只能組出 1 題');
  });
  it('排除已練過的資料（同類新圖）', () => {
    const pkg = demoPackage();
    const first = generateSession(pkg, { kind: 'chart-to-type', typeIds: ['polar'], difficulty: 'standard', count: 1 }, 7).questions[0];
    const r = generateSession(pkg, { kind: 'chart-to-type', typeIds: ['polar'], difficulty: 'standard', count: 5, excludeDatasetIds: [first.targetDatasetId] }, 7);
    expect(r.questions.every((q) => q.targetDatasetId !== first.targetDatasetId)).toBe(true);
  });
});

describe('錯題複習重新洗牌', () => {
  it('保留資料與正解，只換位置與題號', () => {
    const pkg = demoPackage();
    const qs = generateSession(pkg, base, 3).questions;
    const review = buildReviewQuestions(qs, 99);
    expect(review).toHaveLength(qs.length);
    for (const r of review) {
      const orig = qs.find((q) => q.targetDatasetId === r.targetDatasetId && q.kind === r.kind)!;
      expect(r.correctOptionId).toBe(orig.correctOptionId);
      expect(new Set(r.options.map((o) => o.id))).toEqual(new Set(orig.options.map((o) => o.id)));
      expect(r.id).not.toBe(orig.id);
    }
  });
});

describe('#16 成因選擇題', () => {
  const pkg = demoPackage();
  it('選項恰四個、正解為測站主因，錯誤選項不含也成立或常同時成立的因子', () => {
    const factors = new Map(pkg.taxonomy.causeFactors!.map((f) => [f.id, f]));
    for (let seed = 1; seed <= 15; seed++) {
      const r = generateSession(pkg, { kind: 'cause', typeIds: [], difficulty: 'standard', count: 20 }, seed);
      expect(r.questions.length).toBeGreaterThan(5);
      for (const q of r.questions) {
        if (q.kind !== 'cause') throw new Error('kind');
        const d = pkg.datasets.find((x) => x.id === q.targetDatasetId)!;
        expect(q.options).toHaveLength(4);
        expect(q.correctOptionId).toBe(`cause-${d.cause!.factorId}`);
        const banned = new Set([...(d.cause!.alsoTrue ?? []), ...factors.get(d.cause!.factorId)!.coOccurring]);
        for (const o of q.options) if (o.id !== q.correctOptionId) expect(banned.has(o.factorId)).toBe(false);
        expect(q.explanation.cause?.text).toBe(d.cause!.text);
      }
    }
  });
  it('沒有成因內容的資料不會成為成因題', () => {
    const r = generateSession(pkg, { kind: 'cause', typeIds: ['subarctic'], difficulty: 'standard', count: 10 }, 2);
    expect(r.questions.every((q) => !q.targetDatasetId.includes('arxan'))).toBe(true);
  });
  it('混合題型包含四種題型', () => {
    const r = generateSession(pkg, { kind: 'mixed', typeIds: [], difficulty: 'standard', count: 20 }, 5);
    expect(new Set(r.questions.map((q) => q.kind)).size).toBe(4);
  });
});

describe('#14 看圖找地點：錯題複習重新洗牌時字母同步', () => {
  it('解析中的地點字母跟著新位置更新', () => {
    const pkg = demoPackage();
    const q = generateSession(pkg, { kind: 'chart-to-location', typeIds: [], difficulty: 'standard', count: 1 }, 8).questions[0];
    const [r] = buildReviewQuestions([q], 77);
    if (r.kind !== 'chart-to-location') throw new Error('kind');
    for (const o of r.options) {
      if (o.id === r.correctOptionId) expect(r.explanation.correctLabel.startsWith(`地點 ${o.letter}`)).toBe(true);
      else expect(r.explanation.optionReasons[o.id].startsWith(`地點 ${o.letter}`)).toBe(true);
    }
  });
});
