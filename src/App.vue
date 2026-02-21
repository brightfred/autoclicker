<template>
  <div class="app-shell">

    <!-- Titlebar -->
    <div class="titlebar">
      <div class="titlebar-drag">
        <span class="titlebar-icon">⚗</span>
        <span class="titlebar-title">AlchClicker</span>
      </div>
      <div class="titlebar-controls">
        <button @click="minimize" class="ctrl-btn">─</button>
        <button @click="close" class="ctrl-btn ctrl-close">✕</button>
      </div>
    </div>

    <!-- Body -->
    <div class="layout">

      <!-- Sidebar -->
      <nav class="sidebar">
        <router-link to="/" class="nav-item" active-class="nav-active">
          <span>◈</span> Library
        </router-link>
        <router-link to="/record" class="nav-item" active-class="nav-active">
          <span>◉</span> Record
        </router-link>
      </nav>

      <!-- Main content -->
      <main class="content">
        <router-view />
      </main>

    </div>
  </div>
</template>

<script setup>
function minimize() { window.electronAPI?.minimize(); }
function close() { window.electronAPI?.close(); }
</script>

<style scoped>
.app-shell {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

.titlebar {
  height: 38px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 0 14px;
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.titlebar-drag {
  display: flex;
  align-items: center;
  gap: 8px;
}

.titlebar-icon { font-size: 18px; color: var(--color-accent); }

.titlebar-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.titlebar-controls {
  display: flex;
  -webkit-app-region: no-drag;
}

.ctrl-btn {
  width: 46px;
  height: 38px;
  background: transparent;
  border: none;
  color: var(--color-muted);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}
.ctrl-btn:hover { background: var(--color-panel); color: var(--color-text); }
.ctrl-close:hover { background: var(--color-red); color: white; }

.layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar {
  width: 160px;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  padding: 16px 0;
  flex-shrink: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  color: var(--color-muted);
  text-decoration: none;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-left: 2px solid transparent;
  transition: all 0.15s;
}
.nav-item:hover { color: var(--color-text); background: var(--color-panel); }
.nav-active { color: var(--color-accent); border-left-color: var(--color-accent); background: var(--color-panel); }

.content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>