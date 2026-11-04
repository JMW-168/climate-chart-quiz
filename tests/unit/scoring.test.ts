import { describe, expect, it } from 'vitest';
import { generateSession } from '../../src/domain/generator';
import { advance, endEarly, revealHint, selectOption, submitAnswer, summarizeSession, updateMistake } from '../../src/domain/scoring';
import type { Attempt, Session } from '../../src/domain/types';
import { demoPackage } from './helpers';

const NOW = '2026-11-05T00:00:00.000Z';

function newSession(count = 3): Session {
  const pkg = demoPackage();
  const r = generateSession(pkg, { kind: 'chart-to-type', typeIds: [], difficulty: 'beginner', count }, 11);
  return {
    id: 's1', mode: 'practice', settings: { kind: 'chart-to-type', typeIds: [], difficulty: 'beginner', count },
    seed: 11, contentVersion: pkg.contentVersion, contentMode: pkg.mode, questions: r.questions,
    progress: {}, currentIndex: 0, status: 'active', createdAt: NOW, updatedAt: NOW, revision: 0,
  };
}

describe('A01 未選提交／雙擊提交', () => {
  it('未選不可送出', () => {
    const s = newSession();
    expect(submitAnswer(s, s.questions[0].id, NOW)).toEqual({ ok: false, reason: 'not-selected' });
  });
  it('雙擊只記一次', () => {
    let s = newSession();
    const q = s.questions[0];
    s = selectOption(s, q.id, q.correctOptionId, NOW)!;
    const first = submitAnswer(s, q.id, NOW);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = submitAnswer(first.session, q.id, NOW);
    expect(second).toEqual({ ok: false, reason: 'already-submitted' });
  });
});

describe('A02 選錯、看解析、再按選項', () => {
  it('第一次結果不變，錯題建立', () => {
    let s = newSession();
    const q = s.questions[0];
    const wrong = q.options.find((o) => o.id !== q.correctOptionId)!;
    s = selectOption(s, q.id, wrong.id, NOW)!;
    const r = submitAnswer(s, q.id, NOW);
    if (!r.ok) throw new Error('submit failed');
    expect(r.attempt.correct).toBe(false);
    expect(selectOption(r.session, q.id, q.correctOptionId, NOW)).toBeNull();
    const m = updateMistake(undefined, q, r.attempt.correct, 'practice', NOW)!;
    expect(m.pending).toBe(true);
    expect(m.wrongCount).toBe(1);
    expect(m.key).toBe(`${q.targetDatasetId}|${q.targetTypeId}|chart-to-type`);
  });
});

describe('A03 提示後答對', () => {
  it('正確數增加，提示數同步記錄', () => {
    let s = newSession(1);
    const q = s.questions[0];
    s = revealHint(s, q.id, NOW)!;
    s = revealHint(s, q.id, NOW)!;
    s = selectOption(s, q.id, q.correctOptionId, NOW)!;
    const r = submitAnswer(s, q.id, NOW);
    if (!r.ok) throw new Error('submit failed');
    expect(r.attempt.hintCount).toBe(2);
    const done = advance(r.session, NOW)!;
    expect(done.status).toBe('completed');
    const res = summarizeSession(done, [r.attempt]);
    expect(res.correct).toBe(1);
    expect(res.correctWithoutHint).toBe(0);
    expect(res.hintedQuestions).toBe(1);
    expect(res.accuracy).toBe(100);
  });
  it('提示最多三層', () => {
    let s = newSession(1);
    const id = s.questions[0].id;
    for (let i = 0; i < 3; i++) s = revealHint(s, id, NOW)!;
    expect(revealHint(s, id, NOW)).toBeNull();
  });
});

describe('回合流程與成績', () => {
  it('未提交不可前往下一題；提前結束不產生完整成績', () => {
    let s = newSession(3);
    expect(advance(s, NOW)).toBeNull();
    const attempts: Attempt[] = [];
    const q = s.questions[0];
    s = selectOption(s, q.id, q.correctOptionId, NOW)!;
    const r = submitAnswer(s, q.id, NOW);
    if (!r.ok) throw new Error();
    attempts.push(r.attempt);
    s = endEarly(r.session, NOW);
    const res = summarizeSession(s, attempts);
    expect(res.complete).toBe(false);
    expect(res.accuracy).toBeNull();
    expect(res.answered).toBe(1);
    expect(res.total).toBe(3);
  });
});

describe('M01 錯題複習', () => {
  it('答對移出待複習、再答錯重新加入，歷史保留', () => {
    const q = newSession(1).questions[0];
    let m = updateMistake(undefined, q, false, 'practice', NOW)!;
    m = updateMistake(m, q, false, 'practice', NOW)!;
    expect(m.wrongCount).toBe(2);
    m = updateMistake(m, q, true, 'practice', NOW)!;
    expect(m.pending).toBe(true); // 一般練習答對不移出
    m = updateMistake(m, q, true, 'review', NOW)!;
    expect(m.pending).toBe(false);
    m = updateMistake(m, q, false, 'practice', NOW)!;
    expect(m.pending).toBe(true);
    expect(m.wrongCount).toBe(3);
    expect(m.history).toHaveLength(5);
  });
  it('答對且無紀錄時不建立錯題', () => {
    const q = newSession(1).questions[0];
    expect(updateMistake(undefined, q, true, 'practice', NOW)).toBeUndefined();
  });
});
