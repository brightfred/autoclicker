import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import './style.css';
import './ui.css';
import Sequences from './views/Sequences.vue';
import SequenceEditor from './views/SequenceEditor.vue';
import Targets from './views/Targets.vue';
import Overlay from './views/Overlay.vue';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: Sequences },
    { path: '/sequence/:id', component: SequenceEditor },
    { path: '/targets', component: Targets },
    // Full-screen see-through page used by the overlay windows (no sidebar/titlebar)
    { path: '/overlay', component: Overlay, meta: { bare: true } },
  ],
});

const pinia = createPinia();
const app = createApp(App);

app.use(pinia);
app.use(router);
app.mount('#app');
