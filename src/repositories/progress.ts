// 本機學習紀錄（規格 §11）。IndexedDB 為主；不可用時退回記憶體暫存並由畫面明示。

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { updateMistake, mistakeKey } from '../domain/scoring';
import type {
  AppSettings,
  Attempt,
  ContentManifest,
  ContentPackage,
  MistakeRecord,
  QuestionSnapshot,
  Session,
} from '../domain/types';

export const DB_NAME = 'climate-chart-quiz';
export const SCHEMA_VERSION = 1;
export const EXPORT_FORMAT = 'climate-chart-quiz-progress';
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

export const DEFAULT_SETTINGS: AppSettings = { fontScale: 'normal' };

export interface StoredContent {
  contentVersion: string;
  manifest: ContentManifest;
  pkg: ContentPackage;
  storedAt: string;
}

interface KV<T = unknown> {
  key: string;
  value: T;
}

interface QuizDB extends DBSchema {
  sessions: { key: string; value: Session; indexes: { status: string } };
  attempts: { key: [string, string]; value: Attempt; indexes: { sessionId: string } };
  mistakes: { key: string; value: MistakeRecord };
  settings: { key: string; value: KV };
  contentPackages: { key: string; value: StoredContent };
  metadata: { key: string; value: KV };
}

export class StorageError extends Error {
  constructor(message = '儲存失敗，請重試') {
    super(message);
    this.name = 'StorageError';
  }
}

export class ConflictError extends Error {
  constructor(message = '這個練習回合已在其他分頁更新，已重新載入最新紀錄') {
    super(message);
    this.name = 'ConflictError';
  }
}

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  sessions: Session[];
  attempts: Attempt[];
  mistakes: MistakeRecord[];
  settings: AppSettings;
}

export interface SubmitPayload {
  /** 已套用提交的回合（revision 已 +1） */
  session: Session;
  attempt: Attempt;
  question: QuestionSnapshot;
  /** 寫入前資料庫中應有的 revision */
  expectedRevision: number;
}

export interface ProgressRepository {
  readonly persistent: boolean;
  getSession(id: string): Promise<Session | undefined>;
  getActiveSession(): Promise<Session | undefined>;
  listSessions(): Promise<Session[]>;
  /** 寫入回合；expectedRevision 不符時丟 ConflictError */
  saveSession(session: Session, expectedRevision: number | null): Promise<void>;
  /** 同一交易更新 attempt、session 與 mistake */
  submit(payload: SubmitPayload): Promise<MistakeRecord | undefined>;
  listAttempts(sessionId: string): Promise<Attempt[]>;
  listMistakes(): Promise<MistakeRecord[]>;
  getSettings(): Promise<AppSettings>;
  saveSettings(s: AppSettings): Promise<void>;
  exportAll(now: string): Promise<ExportFile>;
  /** 整份取代；任何錯誤都不改動原資料 */
  replaceAll(data: ExportFile): Promise<void>;
  clearProgress(): Promise<void>;
  getCurrentContent(): Promise<StoredContent | undefined>;
  /** 完整內容包寫入成功後才切換為目前版本，並清除其他版本 */
  saveContent(c: StoredContent): Promise<void>;
  clearContent(): Promise<void>;
}

// ───────────── 匯入驗證 ─────────────

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** 解析並驗證匯入檔；錯誤時丟出可讀訊息（I01） */
export function parseImport(text: string): ExportFile {
  if (new Blob([text]).size > IMPORT_MAX_BYTES) throw new Error('檔案超過 5 MB 上限');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('檔案不是有效的 JSON，可能已損壞');
  }
  if (!isObj(data) || data.format !== EXPORT_FORMAT) throw new Error('這不是本網站匯出的學習紀錄檔');
  if (typeof data.schemaVersion !== 'number') throw new Error('缺少資料版本 schemaVersion');
  if (data.schemaVersion > SCHEMA_VERSION) throw new Error(`檔案版本 ${data.schemaVersion} 比此網站支援的版本 ${SCHEMA_VERSION} 新，請先更新網站`);
  if (data.schemaVersion < 1) throw new Error('不支援的資料版本');
  for (const k of ['sessions', 'attempts', 'mistakes'] as const) {
    if (!Array.isArray(data[k])) throw new Error(`欄位 ${k} 必須是陣列`);
  }
  const sessions = data.sessions as Session[];
  const attempts = data.attempts as Attempt[];
  const mistakes = data.mistakes as MistakeRecord[];
  const ids = new Set<string>();
  let active = 0;
  for (const s of sessions) {
    if (!isObj(s) || typeof s.id !== 'string' || !Array.isArray(s.questions) || !isObj(s.progress)) throw new Error('練習回合資料欄位不完整');
    if (!['active', 'completed', 'ended', 'abandoned'].includes(s.status as string)) throw new Error(`回合 ${s.id} 狀態不正確`);
    if (typeof s.currentIndex !== 'number' || typeof s.revision !== 'number') throw new Error(`回合 ${s.id} 欄位不完整`);
    if (ids.has(s.id)) throw new Error(`回合 ${s.id} 重複`);
    ids.add(s.id);
    if (s.status === 'active') active++;
  }
  if (active > 1) throw new Error('紀錄中有多個進行中的回合');
  const seen = new Set<string>();
  for (const a of attempts) {
    if (!isObj(a) || typeof a.sessionId !== 'string' || typeof a.questionId !== 'string' || typeof a.correct !== 'boolean') {
      throw new Error('作答紀錄欄位不完整');
    }
    const s = sessions.find((x) => x.id === a.sessionId);
    if (!s) throw new Error(`作答紀錄引用不存在的回合 ${a.sessionId}`);
    if (!s.questions.some((q) => q.id === a.questionId)) throw new Error(`作答紀錄引用不存在的題目 ${a.questionId}`);
    const k = `${a.sessionId}|${a.questionId}`;
    if (seen.has(k)) throw new Error(`作答紀錄 ${k} 重複`);
    seen.add(k);
  }
  for (const m of mistakes) {
    if (!isObj(m) || typeof m.key !== 'string' || !isObj(m.question) || typeof m.wrongCount !== 'number' || typeof m.pending !== 'boolean') {
      throw new Error('錯題紀錄欄位不完整');
    }
  }
  const settings = isObj(data.settings) ? { ...DEFAULT_SETTINGS, ...(data.settings as Partial<AppSettings>) } : DEFAULT_SETTINGS;
  if (!['normal', 'large', 'xlarge'].includes(settings.fontScale)) settings.fontScale = 'normal';
  return {
    format: EXPORT_FORMAT,
    schemaVersion: data.schemaVersion,
    exportedAt: String(data.exportedAt ?? ''),
    sessions,
    attempts,
    mistakes,
    settings,
  };
}

// ───────────── IndexedDB 實作 ─────────────

export class IdbProgressRepository implements ProgressRepository {
  readonly persistent = true;
  private constructor(private db: IDBPDatabase<QuizDB>) {}

  static async open(name = DB_NAME): Promise<IdbProgressRepository> {
    const db = await openDB<QuizDB>(name, SCHEMA_VERSION, {
      upgrade(db) {
        const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
        sessions.createIndex('status', 'status');
        const attempts = db.createObjectStore('attempts', { keyPath: ['sessionId', 'questionId'] });
        attempts.createIndex('sessionId', 'sessionId');
        db.createObjectStore('mistakes', { keyPath: 'key' });
        db.createObjectStore('settings', { keyPath: 'key' });
        db.createObjectStore('contentPackages', { keyPath: 'contentVersion' });
        const meta = db.createObjectStore('metadata', { keyPath: 'key' });
        meta.put({ key: 'schemaVersion', value: SCHEMA_VERSION });
      },
      blocking() {
        // 新版本開啟時讓出連線
        db.close();
      },
    });
    return new IdbProgressRepository(db);
  }

  close() {
    this.db.close();
  }

  getSession(id: string) {
    return this.db.get('sessions', id);
  }

  async getActiveSession() {
    const list = await this.db.getAllFromIndex('sessions', 'status', 'active');
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  }

  async listSessions() {
    return (await this.db.getAll('sessions')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async saveSession(session: Session, expectedRevision: number | null) {
    const tx = this.db.transaction('sessions', 'readwrite');
    tx.done.catch(() => undefined);
    try {
      const cur = await tx.store.get(session.id);
      if (expectedRevision !== null && cur && cur.revision !== expectedRevision) {
        tx.abort();
        throw new ConflictError();
      }
      if (session.status === 'active') {
        // 只允許一個進行中回合
        const actives = await tx.store.index('status').getAll('active');
        for (const s of actives) if (s.id !== session.id) await tx.store.put({ ...s, status: 'abandoned', revision: s.revision + 1 });
      }
      await tx.store.put(plain(session));
      await tx.done;
    } catch (e) {
      throw wrap(e);
    }
  }

  async submit({ session, attempt, question, expectedRevision }: SubmitPayload) {
    const tx = this.db.transaction(['sessions', 'attempts', 'mistakes'], 'readwrite');
    tx.done.catch(() => undefined);
    try {
      const cur = await tx.objectStore('sessions').get(session.id);
      if (!cur || cur.revision !== expectedRevision) {
        tx.abort();
        throw new ConflictError();
      }
      const existingAttempt = await tx.objectStore('attempts').get([attempt.sessionId, attempt.questionId]);
      if (existingAttempt) {
        tx.abort();
        throw new ConflictError('此題已經提交過，已載入原本的作答結果');
      }
      await tx.objectStore('attempts').add(plain(attempt));
      await tx.objectStore('sessions').put(plain(session));
      const key = mistakeKey(question);
      const prev = await tx.objectStore('mistakes').get(key);
      const next = updateMistake(prev, plain(question), attempt.correct, session.mode, attempt.submittedAt);
      if (next) await tx.objectStore('mistakes').put(next);
      await tx.done;
      return next;
    } catch (e) {
      throw wrap(e);
    }
  }

  listAttempts(sessionId: string) {
    return this.db.getAllFromIndex('attempts', 'sessionId', sessionId);
  }

  async listMistakes() {
    return (await this.db.getAll('mistakes')).sort((a, b) => b.lastWrongAt.localeCompare(a.lastWrongAt));
  }

  async getSettings(): Promise<AppSettings> {
    const r = await this.db.get('settings', 'app');
    return { ...DEFAULT_SETTINGS, ...((r?.value as Partial<AppSettings>) ?? {}) };
  }

  async saveSettings(s: AppSettings) {
    try {
      await this.db.put('settings', { key: 'app', value: plain(s) });
    } catch (e) {
      throw wrap(e);
    }
  }

  async exportAll(now: string): Promise<ExportFile> {
    const tx = this.db.transaction(['sessions', 'attempts', 'mistakes', 'settings'], 'readonly');
    const [sessions, attempts, mistakes, settingsRow] = await Promise.all([
      tx.objectStore('sessions').getAll(),
      tx.objectStore('attempts').getAll(),
      tx.objectStore('mistakes').getAll(),
      tx.objectStore('settings').get('app'),
    ]);
    await tx.done;
    return {
      format: EXPORT_FORMAT,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: now,
      sessions,
      attempts,
      mistakes,
      settings: { ...DEFAULT_SETTINGS, ...((settingsRow?.value as Partial<AppSettings>) ?? {}) },
    };
  }

  async replaceAll(data: ExportFile) {
    const tx = this.db.transaction(['sessions', 'attempts', 'mistakes', 'settings'], 'readwrite');
    tx.done.catch(() => undefined);
    try {
      await Promise.all([
        tx.objectStore('sessions').clear(),
        tx.objectStore('attempts').clear(),
        tx.objectStore('mistakes').clear(),
      ]);
      for (const s of data.sessions) await tx.objectStore('sessions').put(s);
      for (const a of data.attempts) await tx.objectStore('attempts').put(a);
      for (const m of data.mistakes) await tx.objectStore('mistakes').put(m);
      await tx.objectStore('settings').put({ key: 'app', value: data.settings });
      await tx.done;
    } catch (e) {
      try { tx.abort(); } catch { /* 已中止 */ }
      throw wrap(e);
    }
  }

  async clearProgress() {
    const tx = this.db.transaction(['sessions', 'attempts', 'mistakes'], 'readwrite');
    tx.done.catch(() => undefined);
    await Promise.all([tx.objectStore('sessions').clear(), tx.objectStore('attempts').clear(), tx.objectStore('mistakes').clear()]);
    await tx.done;
  }

  async getCurrentContent() {
    const meta = await this.db.get('metadata', 'currentContentVersion');
    if (!meta) return undefined;
    return this.db.get('contentPackages', meta.value as string);
  }

  async saveContent(c: StoredContent) {
    const tx = this.db.transaction(['contentPackages', 'metadata'], 'readwrite');
    tx.done.catch(() => undefined);
    try {
      await tx.objectStore('contentPackages').put(plain(c));
      await tx.objectStore('metadata').put({ key: 'currentContentVersion', value: c.contentVersion });
      // 舊回合使用快照，不依賴舊內容包，可安全清除
      const keys = await tx.objectStore('contentPackages').getAllKeys();
      for (const k of keys) if (k !== c.contentVersion) await tx.objectStore('contentPackages').delete(k);
      await tx.done;
    } catch (e) {
      throw wrap(e);
    }
  }

  async clearContent() {
    const tx = this.db.transaction(['contentPackages', 'metadata'], 'readwrite');
    tx.done.catch(() => undefined);
    await tx.objectStore('contentPackages').clear();
    await tx.objectStore('metadata').delete('currentContentVersion');
    await tx.done;
  }
}

/** 去除 Vue reactive proxy 等不可結構化複製的包裝；資料皆為 JSON 安全格式 */
function plain<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function wrap(e: unknown): Error {
  if (e instanceof ConflictError || e instanceof StorageError) return e;
  if (e instanceof DOMException && e.name === 'AbortError') return new StorageError();
  return new StorageError(`儲存失敗，請重試（${e instanceof Error ? e.message : String(e)}）`);
}

// ───────────── 記憶體暫存（儲存不可用時） ─────────────

export class MemoryProgressRepository implements ProgressRepository {
  readonly persistent = false;
  private sessions = new Map<string, Session>();
  private attempts = new Map<string, Attempt>();
  private mistakes = new Map<string, MistakeRecord>();
  private settings: AppSettings = { ...DEFAULT_SETTINGS };
  private content: StoredContent | undefined;

  async getSession(id: string) { return clone(this.sessions.get(id)); }
  async getActiveSession() { return clone([...this.sessions.values()].find((s) => s.status === 'active')); }
  async listSessions() { return clone([...this.sessions.values()]); }
  async saveSession(session: Session, expectedRevision: number | null) {
    const cur = this.sessions.get(session.id);
    if (expectedRevision !== null && cur && cur.revision !== expectedRevision) throw new ConflictError();
    if (session.status === 'active') {
      for (const s of this.sessions.values()) if (s.id !== session.id && s.status === 'active') this.sessions.set(s.id, { ...s, status: 'abandoned' });
    }
    this.sessions.set(session.id, clone(session));
  }
  async submit({ session, attempt, question, expectedRevision }: SubmitPayload) {
    const cur = this.sessions.get(session.id);
    if (!cur || cur.revision !== expectedRevision) throw new ConflictError();
    const k = `${attempt.sessionId}|${attempt.questionId}`;
    if (this.attempts.has(k)) throw new ConflictError('此題已經提交過，已載入原本的作答結果');
    this.attempts.set(k, clone(attempt));
    this.sessions.set(session.id, clone(session));
    const key = mistakeKey(question);
    const next = updateMistake(this.mistakes.get(key), question, attempt.correct, session.mode, attempt.submittedAt);
    if (next) this.mistakes.set(key, clone(next));
    return next;
  }
  async listAttempts(sessionId: string) { return clone([...this.attempts.values()].filter((a) => a.sessionId === sessionId)); }
  async listMistakes() { return clone([...this.mistakes.values()]); }
  async getSettings() { return { ...this.settings }; }
  async saveSettings(s: AppSettings) { this.settings = { ...s }; }
  async exportAll(now: string): Promise<ExportFile> {
    return clone({
      format: EXPORT_FORMAT, schemaVersion: SCHEMA_VERSION, exportedAt: now,
      sessions: [...this.sessions.values()], attempts: [...this.attempts.values()], mistakes: [...this.mistakes.values()],
      settings: this.settings,
    });
  }
  async replaceAll(data: ExportFile) {
    this.sessions = new Map(data.sessions.map((s) => [s.id, clone(s)]));
    this.attempts = new Map(data.attempts.map((a) => [`${a.sessionId}|${a.questionId}`, clone(a)]));
    this.mistakes = new Map(data.mistakes.map((m) => [m.key, clone(m)]));
    this.settings = { ...data.settings };
  }
  async clearProgress() { this.sessions.clear(); this.attempts.clear(); this.mistakes.clear(); }
  async getCurrentContent() { return this.content; }
  async saveContent(c: StoredContent) { this.content = c; }
  async clearContent() { this.content = undefined; }
}

function clone<T>(x: T): T {
  return x === undefined ? x : (JSON.parse(JSON.stringify(x)) as T);
}

/** 開啟儲存；失敗（無痕、封鎖）時回傳記憶體版本 */
export async function openProgressRepository(): Promise<ProgressRepository> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('no indexedDB');
    return await IdbProgressRepository.open();
  } catch {
    return new MemoryProgressRepository();
  }
}
