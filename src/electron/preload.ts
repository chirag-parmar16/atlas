import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('atlasControls', {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close')
});

contextBridge.exposeInMainWorld('atlasNativeRecorder', {
    getWindowSource: () => ipcRenderer.invoke('get-window-source'),
    saveChunk: (sessionId: string, buffer: ArrayBuffer) => ipcRenderer.send('save-video-chunk', { sessionId, buffer }),
    finalize: (sessionId: string) => ipcRenderer.invoke('finalize-video', { sessionId })
});
