<script setup lang="ts">
import { ref } from 'vue';
import type { FontScale } from '../domain/types';
import { parseImport, type ExportFile } from '../repositories/progress';
import { applyUpdate } from '../pwa/update';
import { getRepo, useAppStore } from '../stores/app';
import { useSessionStore } from '../stores/session';

const app = useAppStore();
const session = useSessionStore();
const version = __APP_VERSION__;

const fontOptions: { value: FontScale; label: string }[] = [
  { value: 'normal', label: '標準' },
  { value: 'large', label: '大' },
  { value: 'xlarge', label: '特大' },
];
function setFont(v: FontScale) {
  void app.saveSettings({ ...app.settings, fontScale: v });
}

async function doExport() {
  const data = await (await getRepo()).exportAll(new Date().toISOString());
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `climate-chart-quiz-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  app.notify('已匯出學習紀錄');
}

const importDialog = ref<HTMLDialogElement | null>(null);
const pendingImport = ref<ExportFile | null>(null);
const importError = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

async function onFile(e: Event) {
  importError.value = null;
  pendingImport.value = null;
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('檔案超過 5 MB 上限');
    pendingImport.value = parseImport(await file.text());
    importDialog.value?.showModal();
  } catch (err) {
    importError.value = `無法匯入：${err instanceof Error ? err.message : String(err)}。原本的紀錄沒有改變。`;
  } finally {
    if (fileInput.value) fileInput.value.value = '';
  }
}

async function confirmImport() {
  if (!pendingImport.value) return;
  try {
    await (await getRepo()).replaceAll(pendingImport.value);
    session.session = null;
    importDialog.value?.close();
    app.notify(`已匯入：${pendingImport.value.sessions.length} 個回合、${pendingImport.value.mistakes.length} 筆錯題`);
    await app.saveSettings(pendingImport.value.settings);
  } catch (err) {
    importDialog.value?.close();
    importError.value = `匯入失敗：${err instanceof Error ? err.message : String(err)}。原本的紀錄沒有改變。`;
  }
}

const clearDialog = ref<HTMLDialogElement | null>(null);
async function confirmClear() {
  await (await getRepo()).clearProgress();
  session.session = null;
  clearDialog.value?.close();
  app.notify('已清除學習紀錄（離線題庫保留）');
}
</script>

<template>
  <h1>設定</h1>

  <section class="sheet">
    <fieldset>
      <legend>字體大小</legend>
      <div class="choice-row">
        <label v-for="o in fontOptions" :key="o.value" class="chip">
          <input type="radio" name="font" :value="o.value" :checked="app.settings.fontScale === o.value" @change="setFont(o.value)" />{{ o.label }}
        </label>
      </div>
    </fieldset>
  </section>

  <section class="sheet">
    <h2>學習紀錄</h2>
    <p class="small">
      紀錄只存在<strong>這個瀏覽器、這台裝置</strong>，沒有帳號也不會上傳。使用無痕模式、清除網站資料，或瀏覽器自動清理空間時，紀錄可能會遺失；需要保留請定期匯出。
    </p>
    <p v-if="!app.persistent" class="status-strip error">這個瀏覽器目前無法保存紀錄，關閉頁面後進度會消失。</p>
    <div class="btn-row">
      <button class="btn" type="button" @click="doExport">匯出學習紀錄</button>
      <label class="btn">
        匯入學習紀錄
        <input ref="fileInput" class="visually-hidden" type="file" accept="application/json,.json" @change="onFile" />
      </label>
      <button class="btn danger" type="button" @click="clearDialog?.showModal()">清除學習紀錄</button>
    </div>
    <p class="small muted" style="margin-top: 10px">匯入會用檔案內容<strong>整份取代</strong>目前紀錄。匯出檔不含裝置識別或個人資料。</p>
    <p v-if="importError" class="status-strip error" role="alert">{{ importError }}</p>
  </section>

  <section class="sheet">
    <h2>題庫與版本</h2>
    <dl class="stat-row">
      <div><dt>網站版本</dt><dd>{{ version }}</dd></div>
      <div><dt>題庫版本</dt><dd>{{ app.content?.contentVersion ?? '未下載' }}</dd></div>
      <div><dt>離線練習</dt><dd>{{ app.offlineReady ? '✓ 已可離線' : '尚未就緒' }}</dd></div>
      <div><dt>網站更新</dt><dd>{{ app.needRefresh ? '有新版本' : '已是最新' }}</dd></div>
    </dl>
    <div class="btn-row" style="margin-top: 14px">
      <button class="btn" type="button" :disabled="app.contentLoading || !app.online" @click="app.redownloadContent()">
        {{ app.contentLoading ? '下載中…' : '重新下載題庫' }}
      </button>
      <button v-if="app.needRefresh" class="btn primary" type="button" @click="applyUpdate()">更新網站</button>
      <RouterLink class="btn quiet" to="/data">資料來源與教材對照</RouterLink>
    </div>
    <p v-if="app.contentError" class="status-strip error">{{ app.contentError }}</p>
    <p class="small muted" style="margin-top: 10px">題庫更新只影響之後開始的練習，進行中的回合會沿用原本的題目。</p>
  </section>

  <section class="sheet small">
    <h2>安裝到裝置</h2>
    <p>Android 與桌面版 Chrome／Edge：瀏覽器網址列或選單會出現「安裝應用程式」。iPhone／iPad Safari：點「分享」→「加入主畫面」。各瀏覽器的安裝方式不同，未安裝也能直接在瀏覽器使用。</p>
  </section>

  <dialog ref="importDialog" aria-labelledby="imp-title">
    <h2 id="imp-title">用匯入檔取代目前紀錄？</h2>
    <p v-if="pendingImport">
      檔案內有 {{ pendingImport.sessions.length }} 個回合、{{ pendingImport.attempts.length }} 筆作答、{{ pendingImport.mistakes.length }} 筆錯題（匯出於
      {{ pendingImport.exportedAt.slice(0, 10) || '未知日期' }}）。目前這台裝置上的紀錄會被整份取代。
    </p>
    <div class="btn-row">
      <button class="btn" type="button" @click="doExport">先匯出目前紀錄</button>
      <button class="btn danger" type="button" @click="confirmImport">取代並匯入</button>
      <button class="btn quiet" type="button" @click="importDialog?.close()">取消</button>
    </div>
  </dialog>

  <dialog ref="clearDialog" aria-labelledby="clr-title">
    <h2 id="clr-title">清除所有學習紀錄？</h2>
    <p>練習回合、作答與錯題都會刪除，無法復原。離線題庫會保留。</p>
    <div class="btn-row">
      <button class="btn" type="button" @click="doExport">先匯出</button>
      <button class="btn danger" type="button" @click="confirmClear">清除紀錄</button>
      <button class="btn quiet" type="button" @click="clearDialog?.close()">取消</button>
    </div>
  </dialog>
</template>
