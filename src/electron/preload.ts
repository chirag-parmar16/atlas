import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('atlasControls', {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close')
});
