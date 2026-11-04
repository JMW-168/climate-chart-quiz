// 目前練習回合（規格 §7、§11）。所有寫入先過領域函式，再寫 IndexedDB，成功後才更新畫面。
import { defineStore } from 'pinia';
import { buildReviewQuestions, generateSession, type GenerationResult } from '../domain/generator';
import { randomSeed } from '../domain/rng';
import { abandon, advance, endEarly, revealHint, selectOption, submitAnswer } from '../domain/scoring';
import type { Attempt, MistakeRecord, PracticeSettings, QuestionProgress, QuestionSnapshot, Session } from '../domain/types';
import { ConflictError, StorageError } from '../repositories/progress';
import { getRepo, useAppStore } from './app';

const CHANNEL = 'climate-chart-quiz-sync';
let channel: BroadcastChannel | null = null;

function now() {
  return new Date().toISOString();
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useSessionStore = defineStore('session', {
  state: () => ({
    session: null as Session | null,
    attempts: [] as Attempt[],
    busy: false,
    error: null as string | null,
  }),
  getters: {
    current: (s): QuestionSnapshot | null => (s.session ? s.session.questions[s.session.currentIndex] ?? null : null),
    progress(s): QuestionProgress | null {
      const q = this.current;
      if (!s.session || !q) return null;
      return s.session.progress[q.id] ?? { selectedOptionId: null, hintsShown: 0, submitted: false };
    },
    currentAttempt(s): Attempt | undefined {
      const q = this.current;
      return q ? s.attempts.find((a) => a.questionId === q.id) : undefined;
    },
  },
  actions: {
    listen() {
      if (channel || typeof BroadcastChannel === 'undefined') return;
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = async (ev: MessageEvent<{ sessionId: string; revision: number }>) => {
        const s = this.session;
        if (!s || ev.data.sessionId !== s.id || ev.data.revision <= s.revision) return;
        await this.load(s.id);
        useAppStore().notify('另一個分頁更新了這個回合，已載入最新作答紀錄');
      };
    },
    broadcast(s: Session) {
      channel?.postMessage({ sessionId: s.id, revision: s.revision });
    },

    async load(id: string): Promise<boolean> {
      const repo = await getRepo();
      const s = await repo.getSession(id);
      if (!s) {
        this.session = null;
        this.attempts = [];
        return false;
      }
      this.session = s;
      this.attempts = await repo.listAttempts(id);
      return true;
    },

    async activeSession(): Promise<Session | undefined> {
      return (await getRepo()).getActiveSession();
    },

    preview(settings: PracticeSettings, seed = randomSeed()): GenerationResult & { seed: number } {
      const app = useAppStore();
      if (!app.pkg) throw new Error('題庫尚未載入');
      return { ...generateSession(app.pkg, settings, seed), seed };
    },

    async start(settings: PracticeSettings, seed: number, questions: QuestionSnapshot[], mode: 'practice' | 'review' = 'practice') {
      const app = useAppStore();
      const t = now();
      const s: Session = {
        id: newId(),
        mode,
        settings,
        seed,
        contentVersion: app.content!.contentVersion,
        contentMode: app.content!.pkg.mode,
        questions,
        progress: {},
        currentIndex: 0,
        status: 'active',
        createdAt: t,
        updatedAt: t,
        revision: 1,
      };
      // 儲存完整快照及 seed 後才顯示第一題
      await (await getRepo()).saveSession(s, null);
      this.session = s;
      this.attempts = [];
      return s.id;
    },

    async startReview(mistakes: MistakeRecord[]) {
      const seed = randomSeed();
      const questions = buildReviewQuestions(mistakes.map((m) => m.question), seed);
      const kinds = new Set(questions.map((q) => q.kind));
      const settings: PracticeSettings = {
        kind: kinds.size === 1 ? [...kinds][0] : 'mixed',
        typeIds: [],
        difficulty: questions[0]?.difficulty ?? 'standard',
        count: questions.length,
      };
      return this.start(settings, seed, questions, 'review');
    },

    async write(next: Session | null) {
      const prev = this.session;
      if (!next || !prev) return false;
      try {
        await (await getRepo()).saveSession(next, prev.revision);
        this.session = next;
        this.broadcast(next);
        this.error = null;
        return true;
      } catch (e) {
        await this.handleError(e, prev.id);
        return false;
      }
    },

    async handleError(e: unknown, sessionId: string) {
      if (e instanceof ConflictError) {
        await this.load(sessionId);
        useAppStore().notify(e.message);
      } else if (e instanceof StorageError) {
        this.error = e.message;
      } else {
        this.error = '儲存失敗，請重試';
      }
    },

    async select(optionId: string) {
      const q = this.current;
      if (!this.session || !q) return;
      await this.write(selectOption(this.session, q.id, optionId, now()));
    },

    async hint() {
      const q = this.current;
      if (!this.session || !q) return;
      await this.write(revealHint(this.session, q.id, now()));
    },

    async submit() {
      const q = this.current;
      const prev = this.session;
      if (!prev || !q || this.busy) return;
      const r = submitAnswer(prev, q.id, now());
      if (!r.ok) return;
      this.busy = true;
      try {
        await (await getRepo()).submit({ session: r.session, attempt: r.attempt, question: q, expectedRevision: prev.revision });
        this.session = r.session;
        this.attempts = [...this.attempts, r.attempt];
        this.error = null;
        this.broadcast(r.session);
      } catch (e) {
        await this.handleError(e, prev.id);
      } finally {
        this.busy = false;
      }
    },

    async next() {
      if (!this.session) return;
      return this.write(advance(this.session, now()));
    },

    async end() {
      if (!this.session) return;
      return this.write(endEarly(this.session, now()));
    },

    async abandonActive() {
      const repo = await getRepo();
      const active = await repo.getActiveSession();
      if (active) await repo.saveSession(abandon(active, now()), active.revision);
      if (this.session?.id === active?.id) this.session = null;
    },
  },
});
