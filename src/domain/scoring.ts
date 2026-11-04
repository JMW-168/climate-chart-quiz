// 作答狀態、判分與錯題（規格 §7）。純函式，不碰儲存層。

import type { Attempt, MistakeRecord, QuestionProgress, QuestionSnapshot, Session, SessionMode } from './types';

export function emptyProgress(): QuestionProgress {
  return { selectedOptionId: null, hintsShown: 0, submitted: false };
}

export function progressOf(session: Session, questionId: string): QuestionProgress {
  return session.progress[questionId] ?? emptyProgress();
}

/** unanswered → selected：提交後鎖定，回傳 null 表示不允許 */
export function selectOption(session: Session, questionId: string, optionId: string, now: string): Session | null {
  const p = progressOf(session, questionId);
  if (p.submitted || session.status !== 'active') return null;
  const q = session.questions.find((x) => x.id === questionId);
  if (!q || !q.options.some((o) => o.id === optionId)) return null;
  return touch({ ...session, progress: { ...session.progress, [questionId]: { ...p, selectedOptionId: optionId } } }, now);
}

export function revealHint(session: Session, questionId: string, now: string): Session | null {
  const p = progressOf(session, questionId);
  if (p.submitted || p.hintsShown >= 3 || session.status !== 'active') return null;
  return touch({ ...session, progress: { ...session.progress, [questionId]: { ...p, hintsShown: p.hintsShown + 1 } } }, now);
}

export type SubmitOutcome =
  | { ok: true; session: Session; attempt: Attempt }
  | { ok: false; reason: 'not-selected' | 'already-submitted' | 'not-active' | 'unknown-question' };

/** 提交：冪等，只有第一次提交計分 */
export function submitAnswer(session: Session, questionId: string, now: string): SubmitOutcome {
  if (session.status !== 'active') return { ok: false, reason: 'not-active' };
  const q = session.questions.find((x) => x.id === questionId);
  if (!q) return { ok: false, reason: 'unknown-question' };
  const p = progressOf(session, questionId);
  if (p.submitted) return { ok: false, reason: 'already-submitted' };
  if (!p.selectedOptionId) return { ok: false, reason: 'not-selected' };
  const attempt: Attempt = {
    sessionId: session.id,
    questionId,
    selectedOptionId: p.selectedOptionId,
    correct: p.selectedOptionId === q.correctOptionId,
    hintCount: p.hintsShown,
    submittedAt: now,
  };
  const next = touch({ ...session, progress: { ...session.progress, [questionId]: { ...p, submitted: true } } }, now);
  return { ok: true, session: next, attempt };
}

/** 下一題；最後一題提交後才可完成回合 */
export function advance(session: Session, now: string): Session | null {
  const q = session.questions[session.currentIndex];
  if (!q || !progressOf(session, q.id).submitted || session.status !== 'active') return null;
  if (session.currentIndex >= session.questions.length - 1) {
    return touch({ ...session, status: 'completed' }, now);
  }
  return touch({ ...session, currentIndex: session.currentIndex + 1 }, now);
}

/** 明確提前結束：只顯示已答／總題數，不產生完整成績 */
export function endEarly(session: Session, now: string): Session {
  return touch({ ...session, status: 'ended' }, now);
}

export function abandon(session: Session, now: string): Session {
  return touch({ ...session, status: 'abandoned' }, now);
}

function touch(s: Session, now: string): Session {
  return { ...s, updatedAt: now, revision: s.revision + 1 };
}

export function mistakeKey(q: QuestionSnapshot): string {
  return `${q.targetDatasetId}|${q.targetTypeId}|${q.kind}`;
}

/**
 * 錯題更新：第一次答錯建立；重複錯增加 wrongCount；
 * 複習答對一次移出待複習（歷史保留）；再次答錯重新加入。
 */
export function updateMistake(
  existing: MistakeRecord | undefined,
  q: QuestionSnapshot,
  correct: boolean,
  mode: SessionMode,
  now: string,
): MistakeRecord | undefined {
  if (!existing) {
    if (correct) return undefined;
    return {
      key: mistakeKey(q),
      datasetId: q.targetDatasetId,
      targetTypeId: q.targetTypeId,
      targetLabel: q.targetLabel,
      kind: q.kind,
      wrongCount: 1,
      pending: true,
      firstWrongAt: now,
      lastWrongAt: now,
      lastReviewedAt: mode === 'review' ? now : null,
      question: q,
      history: [{ at: now, correct: false, mode }],
    };
  }
  const history = [...existing.history, { at: now, correct, mode }];
  if (correct) {
    // 一般練習答對不改變待複習狀態；只有錯題複習答對才移出
    return mode === 'review'
      ? { ...existing, pending: false, lastReviewedAt: now, history }
      : { ...existing, history };
  }
  return {
    ...existing,
    wrongCount: existing.wrongCount + 1,
    pending: true,
    lastWrongAt: now,
    lastReviewedAt: mode === 'review' ? now : existing.lastReviewedAt,
    question: q,
    history,
  };
}

export interface TypePerformance {
  typeId: string;
  label: string;
  total: number;
  correct: number;
}

export interface SessionResult {
  total: number;
  answered: number;
  correct: number;
  correctWithoutHint: number;
  hintedQuestions: number;
  /** 整數百分比；未完成回合為 null */
  accuracy: number | null;
  complete: boolean;
  byType: TypePerformance[];
}

export function summarizeSession(session: Session, attempts: Attempt[]): SessionResult {
  const byQ = new Map(attempts.filter((a) => a.sessionId === session.id).map((a) => [a.questionId, a]));
  const typeMap = new Map<string, TypePerformance>();
  let correct = 0;
  let correctWithoutHint = 0;
  let hinted = 0;
  let answered = 0;
  for (const q of session.questions) {
    const a = byQ.get(q.id);
    const tp = typeMap.get(q.targetTypeId) ?? { typeId: q.targetTypeId, label: q.targetLabel, total: 0, correct: 0 };
    tp.total++;
    typeMap.set(q.targetTypeId, tp);
    if (!a) continue;
    answered++;
    if (a.hintCount > 0) hinted++;
    if (a.correct) {
      correct++;
      tp.correct++;
      if (a.hintCount === 0) correctWithoutHint++;
    }
  }
  const total = session.questions.length;
  const complete = session.status === 'completed' && answered === total;
  return {
    total,
    answered,
    correct,
    correctWithoutHint,
    hintedQuestions: hinted,
    accuracy: complete && total > 0 ? Math.round((correct / total) * 100) : null,
    complete,
    byType: [...typeMap.values()],
  };
}
