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

  // Targets (saved to targets.json)
  loadTargets:   ()     => ipcRenderer.invoke('targets-load'),
  saveTargets:   (data) => ipcRenderer.invoke('targets-save', data),
  exportTargets: (data) => ipcRenderer.invoke('targets-export', data),
  importTargets: ()     => ipcRenderer.invoke('targets-import'),

  // Overlay — drag a box on screen / show my targets on top of the game
  selectOnScreen:  (opts) => ipcRenderer.invoke('overlay-select', opts),
  showOnScreen:    (opts) => ipcRenderer.invoke('overlay-show', opts),
  getOverlayData:  ()     => ipcRenderer.invoke('overlay-get-data'),
  sendOverlayResult: (rect) => ipcRenderer.send('overlay-result', rect),

  // Hotkey
  registerHotkey:   (key) => ipcRenderer.invoke('hotkey-register', key),
  unregisterHotkey: ()    => ipcRenderer.invoke('hotkey-unregister'),
  onHotkeyPlay:     (callback) => ipcRenderer.on('hotkey-play', () => callback()),
  offHotkeyPlay:    ()         => ipcRenderer.removeAllListeners('hotkey-play'),
});