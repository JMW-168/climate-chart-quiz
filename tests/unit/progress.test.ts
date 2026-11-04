import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { generateSession } from '../../src/domain/generator';
import { selectOption, submitAnswer } from '../../src/domain/scoring';
import type { Session } from '../../src/domain/types';
import { ConflictError, IdbProgressRepository, parseImport } from '../../src/repositories/progress';
import { demoPackage } from './helpers';

const NOW = '2026-11-05T00:00:00.000Z';
let n = 0;

async function setup() {
  const repo = await IdbProgressRepository.open(`test-${n++}`);
  const pkg = demoPackage();
  const r = generateSession(pkg, { kind: 'mixed', typeIds: [], difficulty: 'standard', count: 3 }, 5);
  const session: Session = {
    id: `s-${n}`, mode: 'practice', settings: { kind: 'mixed', typeIds: [], difficulty: 'standard', count: 3 }, seed: 5,
    contentVersion: pkg.contentVersion, contentMode: pkg.mode, questions: r.questions, progress: {}, currentIndex: 0,
    status: 'active', createdAt: NOW, updatedAt: NOW, revision: 0,
  };
  await repo.saveSession(session, null);
  return { repo, session };
}

async function answerFirst(repo: IdbProgressRepository, session: Session, correct: boolean) {
  const q = session.questions[0];
  const opt = correct ? q.correctOptionId : q.options.find((o) => o.id !== q.correctOptionId)!.id;
  const selected = selectOption(session, q.id, opt, NOW)!;
  await repo.saveSession(selected, session.revision);
  const r = submitAnswer(selected, q.id, NOW);
  if (!r.ok) throw new Error('submit');
  const mistake = await repo.submit({ session: r.session, attempt: r.attempt, question: q, expectedRevision: selected.revision });
  return { next: r.session, mistake, selected, r };
}

describe('S01 作答後重新整理', () => {
  it('回到原進度及鎖定狀態', async () => {
    const { repo, session } = await setup();
    const { next } = await answerFirst(repo, session, false);
    const reloaded = (await repo.getActiveSession())!;
    expect(reloaded.revision).toBe(next.revision);
    expect(reloaded.progress[session.questions[0].id].submitted).toBe(true);
    expect(await repo.listAttempts(session.id)).toHaveLength(1);
    expect((await repo.listMistakes())[0].pending).toBe(true);
  });
});

describe('S02 多分頁更新', () => {
  it('revision 不符時拒絕寫入，不覆寫新作答', async () => {
    const { repo, session } = await setup();
    const { selected, r } = await answerFirst(repo, session, true);
    // 另一分頁仍持有舊 revision 的回合
    await expect(repo.submit({ session: r.session, attempt: r.attempt, question: session.questions[0], expectedRevision: selected.revision })).rejects.toBeInstanceOf(ConflictError);
    await expect(repo.saveSession(selected, session.revision)).rejects.toBeInstanceOf(ConflictError);
    expect(await repo.listAttempts(session.id)).toHaveLength(1);
  });
  it('只允許一個進行中回合', async () => {
    const { repo, session } = await setup();
    await repo.saveSession({ ...session, id: 'other', revision: 0 }, null);
    const all = await repo.listSessions();
    expect(all.filter((s) => s.status === 'active').map((s) => s.id)).toEqual(['other']);
  });
});

describe('匯出／匯入', () => {
  it('匯出後可整份取代', async () => {
    const { repo, session } = await setup();
    await answerFirst(repo, session, false);
    const file = await repo.exportAll(NOW);
    const text = JSON.stringify(file);
    expect(text).not.toContain('userAgent');
    await repo.clearProgress();
    expect(await repo.listSessions()).toHaveLength(0);
    await repo.replaceAll(parseImport(text));
    expect(await repo.listAttempts(session.id)).toHaveLength(1);
    expect(await repo.listMistakes()).toHaveLength(1);
  });
});

describe('I01 匯入損壞或不支援版本', () => {
  it('損壞 JSON', () => {
    expect(() => parseImport('{bad')).toThrow(/損壞/);
  });
  it('新版本', () => {
    expect(() => parseImport(JSON.stringify({ format: 'climate-chart-quiz-progress', schemaVersion: 99, sessions: [], attempts: [], mistakes: [] }))).toThrow(/比此網站支援/);
  });
  it('引用不存在的回合', () => {
    expect(() => parseImport(JSON.stringify({ format: 'climate-chart-quiz-progress', schemaVersion: 1, sessions: [], attempts: [{ sessionId: 'x', questionId: 'q', correct: true }], mistakes: [] }))).toThrow(/不存在的回合/);
  });
  it('超過 5MB', () => {
    expect(() => parseImport('x'.repeat(5 * 1024 * 1024 + 1))).toThrow(/5 MB/);
  });
});
