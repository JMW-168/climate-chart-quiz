import { createRouter, createWebHistory } from 'vue-router';
import Home from '../pages/Home.vue';

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', name: 'home', component: Home, meta: { title: '首頁' } },
    { path: '/learn', name: 'learn', component: () => import('../pages/Learn.vue'), meta: { title: '讀圖說明' } },
    { path: '/practice/setup', name: 'setup', component: () => import('../pages/Setup.vue'), meta: { title: '練習設定' } },
    { path: '/practice/:sessionId', name: 'practice', component: () => import('../pages/Practice.vue'), meta: { title: '練習' } },
    { path: '/results/:sessionId', name: 'results', component: () => import('../pages/Results.vue'), meta: { title: '練習結果' } },
    { path: '/mistakes', name: 'mistakes', component: () => import('../pages/Mistakes.vue'), meta: { title: '錯題複習' } },
    { path: '/settings', name: 'settings', component: () => import('../pages/Settings.vue'), meta: { title: '設定' } },
    { path: '/data', name: 'data', component: () => import('../pages/DataInfo.vue'), meta: { title: '資料說明' } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../pages/NotFound.vue'), meta: { title: '找不到頁面' } },
  ],
});

router.afterEach((to) => {
  document.title = `${(to.meta.title as string) ?? ''}｜氣候圖練習`;
});
