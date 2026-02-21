import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import './style.css';
import Library from './views/Library.vue';
import Recorder from './views/Recorder.vue';
import Player from './views/Player.vue';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: Library },
    { path: '/record', component: Recorder },
    { path: '/play/:id', component: Player },
  ],
});

const pinia = createPinia();
const app = createApp(App);

app.use(pinia);
app.use(router);
app.mount('#app');