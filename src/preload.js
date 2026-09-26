const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  close:    () => ipcRenderer.send('window-close'),

  // Targets (saved to targets.json)
  loadTargets:   ()     => ipcRenderer.invoke('targets-load'),
  saveTargets:   (data) => ipcRenderer.invoke('targets-save', data),
  exportTargets: (data) => ipcRenderer.invoke('targets-export', data),
  importTargets: ()     => ipcRenderer.invoke('targets-import'),

  // Overlay — drag a box on screen / show my targets on top of the game
  selectOnScreen:    (opts)   => ipcRenderer.invoke('overlay-select', opts),
  showOnScreen:      (opts)   => ipcRenderer.invoke('overlay-show', opts),
  testMoveToTarget:  (target) => ipcRenderer.invoke('target-test-move', { target }),
  getOverlayData:    ()       => ipcRenderer.invoke('overlay-get-data'),
  sendOverlayResult: (rect)   => ipcRenderer.send('overlay-result', rect),

  // Sequences (saved to sequences.json)
  loadSequences:    ()     => ipcRenderer.invoke('sequences-load'),
  saveSequences:    (data) => ipcRenderer.invoke('sequences-save', data),
  exportSequences:  (data) => ipcRenderer.invoke('sequences-export', data),
  importSequences:  ()     => ipcRenderer.invoke('sequences-import'),

  // Running a sequence
  validateSequence: (sequence, targets) => ipcRenderer.invoke('sequence-validate', { sequence, targets }),
  startSequence:    (sequence, targets) => ipcRenderer.invoke('sequence-start', { sequence, targets }),
  stopSequence:     ()                  => ipcRenderer.invoke('sequence-stop'),
  onSequenceStatus:  (callback) => ipcRenderer.on('sequence-status', (_, status) => callback(status)),
  offSequenceStatus: ()         => ipcRenderer.removeAllListeners('sequence-status'),

  // Hotkey
  registerHotkey:   (key) => ipcRenderer.invoke('hotkey-register', key),
  unregisterHotkey: (key) => ipcRenderer.invoke('hotkey-unregister', key),
  onHotkeyPlay:     (callback) => ipcRenderer.on('hotkey-play', () => callback()),
  offHotkeyPlay:    ()         => ipcRenderer.removeAllListeners('hotkey-play'),
});
