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

// Forward main-process "open new tab" requests to the renderer's TabManager
// Also lets renderer report back which tab URL it just activated
contextBridge.exposeInMainWorld('atlasTabBridge', {
    onOpenTab: (cb: (url: string) => void) => {
        ipcRenderer.on('open-as-tab', (_event, url: string) => cb(url));
    },
    reportActiveTab: (url: string) => ipcRenderer.send('active-tab-url', url)
});

// GUI Dashboard IPC bridge — used by gui-renderer.ts
contextBridge.exposeInMainWorld('atlasGui', {
    scanProjects: (rootPath?: string) => ipcRenderer.invoke('scan-projects', rootPath),
    getReportFiles: (projectPath: string) => ipcRenderer.invoke('get-report-files', projectPath),
    readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
    browseFolder: () => ipcRenderer.invoke('browse-folder'),
    openProject: (projectPath: string) => ipcRenderer.invoke('open-project', projectPath),
});
