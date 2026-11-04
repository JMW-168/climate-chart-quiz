// 全域狀態：儲存庫、題庫內容、設定、離線與更新狀態。
import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import { ContentIndex } from '../domain/generator';
import type { AppSettings, ContentPackage } from '../domain/types';
import { syncContent } from '../repositories/content';
import { DEFAULT_SETTINGS, openProgressRepository, type ProgressRepository, type StoredContent } from '../repositories/progress';

let repoPromise: Promise<ProgressRepository> | null = null;
export function getRepo(): Promise<ProgressRepository> {
  repoPromise ??= openProgressRepository();
  return repoPromise;
}

export const useAppStore = defineStore('app', {
  state: () => ({
    ready: false,
    persistent: true,
    content: null as StoredContent | null,
    contentError: null as string | null,
    contentLoading: false,
    settings: { ...DEFAULT_SETTINGS } as AppSettings,
    /** Service Worker 已啟用並控制頁面 */
    swActive: false,
    /** 有新的應用程式版本等待套用 */
    needRefresh: false,
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    toast: null as string | null,
  }),
  getters: {
    pkg: (s): ContentPackage | null => s.content?.pkg ?? null,
    isDemo: (s) => s.content?.pkg.mode === 'demo',
    offlineReady: (s) => !!s.content && s.swActive,
    index: (s) => (s.content ? markRaw(new ContentIndex(s.content.pkg)) : null),
  },
  actions: {
    async init() {
      const repo = await getRepo();
      this.persistent = repo.persistent;
      this.settings = await repo.getSettings();
      this.applyFont();
      await this.loadContent(false);
      this.ready = true;
      window.addEventListener('online', () => {
        this.online = true;
        void this.loadContent(false);
      });
      window.addEventListener('offline', () => (this.online = false));
    },
    async loadContent(force: boolean) {
      this.contentLoading = true;
      try {
        const repo = await getRepo();
        const r = await syncContent(repo, force);
        if (r.content) this.content = markRaw(r.content);
        this.contentError = r.error;
        if (r.updated && this.ready) this.notify(`題庫已更新為 ${r.content?.contentVersion}，新版本只用於之後開始的練習`);
      } finally {
        this.contentLoading = false;
      }
    },
    async redownloadContent() {
      await this.loadContent(true);
      if (!this.contentError) this.notify('已重新下載並校驗題庫');
    },
    async saveSettings(s: AppSettings) {
      this.settings = { ...s };
      this.applyFont();
      try {
        await (await getRepo()).saveSettings(this.settings);
      } catch {
        this.notify('設定儲存失敗，請重試');
      }
    },
    applyFont() {
      document.documentElement.dataset.font = this.settings.fontScale;
    },
    notify(msg: string) {
      this.toast = msg;
      window.setTimeout(() => {
        if (this.toast === msg) this.toast = null;
      }, 4500);
    },
  },
});
