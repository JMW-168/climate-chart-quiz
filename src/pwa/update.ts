// PWA 註冊與更新（規格 §12）：新版本等待，不強制 reload；由畫面在適當時機（非練習中）提供更新按鈕。
import { useRegisterSW } from 'virtual:pwa-register/vue';
import { watch } from 'vue';
import { useAppStore } from '../stores/app';

let apply: ((reload?: boolean) => Promise<void>) | null = null;

export function setupPwa() {
  const app = useAppStore();
  if (!('serviceWorker' in navigator)) return;
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      const markActive = () => {
        app.swActive = !!(navigator.serviceWorker.controller || reg?.active);
      };
      markActive();
      navigator.serviceWorker.addEventListener('controllerchange', markActive);
      reg?.installing?.addEventListener('statechange', markActive);
      navigator.serviceWorker.ready.then(markActive);
      // 每小時檢查一次新版本
      if (reg) window.setInterval(() => void reg.update().catch(() => undefined), 60 * 60 * 1000);
    },
    onRegisterError() {
      app.swActive = false;
    },
  });
  apply = updateServiceWorker;
  watch(needRefresh, (v) => (app.needRefresh = v), { immediate: true });
}

/** 套用等待中的新版本；呼叫端須確認目前不在練習中 */
export async function applyUpdate() {
  await apply?.(true);
}
