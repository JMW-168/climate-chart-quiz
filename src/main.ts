import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import { useAppStore } from './stores/app';
import { useSessionStore } from './stores/session';
import { setupPwa } from './pwa/update';
import './styles.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);

const store = useAppStore();
useSessionStore().listen();
setupPwa();
void store.init();
app.mount('#app');
