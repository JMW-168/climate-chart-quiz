import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
// GitHub Pages 專案網址為 /<repo>/；其他主機可用 BASE_PATH 覆寫（例如 "/"）
const base = process.env.BASE_PATH ?? '/climate-chart-quiz/';

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: '國中地理氣候圖練習',
        short_name: '氣候圖練習',
        description: '看氣溫折線與降水長條，辨認氣候類型並說出判讀依據。',
        lang: 'zh-Hant',
        start_url: base,
        scope: base,
        display: 'standalone',
        theme_color: '#1d3557',
        background_color: '#f3f6f8',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 題庫不放進 precache：由程式校驗後整包存入 IndexedDB
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        globIgnores: ['content/**', '404.html'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/\/content\//],
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
      },
      devOptions: { enabled: false },
    }),
  ],
});
