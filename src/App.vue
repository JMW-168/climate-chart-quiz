<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAppStore } from './stores/app';
import { applyUpdate } from './pwa/update';
import DemoNotice from './components/DemoNotice.vue';

const app = useAppStore();
const route = useRoute();
const inPractice = computed(() => route.name === 'practice');
</script>

<template>
  <header class="topbar">
    <div class="topbar-inner">
      <RouterLink to="/" class="brand" aria-label="氣候圖練習首頁">
        <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="1" y="1" width="30" height="30" rx="6" fill="#fff" />
          <rect x="6" y="18" width="4" height="9" fill="#2e6fb7" />
          <rect x="12" y="12" width="4" height="15" fill="#2e6fb7" />
          <rect x="18" y="8" width="4" height="19" fill="#2e6fb7" />
          <rect x="24" y="15" width="4" height="12" fill="#2e6fb7" />
          <polyline points="8,14 14,9 20,6 26,11" fill="none" stroke="#c8372d" stroke-width="2.4" stroke-linejoin="round" />
        </svg>
        <span>氣候圖練習</span>
      </RouterLink>
      <nav aria-label="主要頁面">
        <RouterLink to="/learn">讀圖</RouterLink>
        <RouterLink to="/mistakes">錯題</RouterLink>
        <RouterLink to="/settings">設定</RouterLink>
      </nav>
    </div>
  </header>

  <div class="shell">
    <DemoNotice v-if="app.isDemo" />
    <p v-if="!app.persistent" class="status-strip error" role="status">
      這個瀏覽器目前無法保存紀錄（可能是無痕模式或已封鎖網站資料）。可以照常練習，但關閉頁面後進度不會保存。
    </p>
    <p v-if="!app.online" class="status-strip info" role="status">
      目前離線。{{ app.offlineReady ? '已下載的題庫可照常練習。' : '題庫尚未完整下載，需連線後才能練習。' }}
    </p>
    <div v-if="app.needRefresh && !inPractice" class="status-strip info" role="status">
      <span class="grow">網站有新版本可以使用。</span>
      <button class="btn primary" type="button" @click="applyUpdate()">更新網站</button>
    </div>

    <main id="main">
      <div v-if="!app.ready" class="sheet empty" aria-busy="true">正在載入題庫…</div>
      <div v-else-if="!app.content" class="sheet empty" role="alert">
        <h2>還沒有可用的題庫</h2>
        <p class="muted">{{ app.contentError ?? '請連上網路後重新整理。' }}</p>
        <p class="small muted">第一次使用須在連線狀態下開啟一次，之後才能離線練習。</p>
        <button class="btn primary" type="button" :disabled="app.contentLoading" @click="app.loadContent(true)">重新下載題庫</button>
      </div>
      <RouterView v-else />
    </main>
  </div>

  <footer class="site-footer">
    <p>
      非營利教育用途，免費、無廣告、不蒐集個人資料。
      <RouterLink to="/sources">資料來源與授權</RouterLink>
    </p>
  </footer>

  <div v-if="app.toast" class="toast" role="status" aria-live="polite">{{ app.toast }}</div>
</template>
