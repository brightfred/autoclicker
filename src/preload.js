const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  close:    () => ipcRenderer.send('window-close'),

  // Recording
  startRecording:   (modelId) => ipcRenderer.invoke('recording-start', { modelId }),
  stopRecording:    ()        => ipcRenderer.invoke('recording-stop'),
  onRecordingEvent: (callback) => ipcRenderer.on('recording-event', (_, event) => callback(event)),
  offRecordingEvent: ()       => ipcRenderer.removeAllListeners('recording-event'),

  // Playback
  startPlayback:   (pattern, config) => ipcRenderer.invoke('playback-start', { pattern, config }),
  stopPlayback:    ()                => ipcRenderer.invoke('playback-stop'),
  onPlaybackStatus: (callback)       => ipcRenderer.on('playback-status', (_, status) => callback(status)),
  offPlaybackStatus: ()              => ipcRenderer.removeAllListeners('playback-status'),

  // Hotkey
  registerHotkey:   (key) => ipcRenderer.invoke('hotkey-register', key),
  unregisterHotkey: ()    => ipcRenderer.invoke('hotkey-unregister'),
  onHotkeyPlay:     (callback) => ipcRenderer.on('hotkey-play', () => callback()),
  offHotkeyPlay:    ()         => ipcRenderer.removeAllListeners('hotkey-play'),
});