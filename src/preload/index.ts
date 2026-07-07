import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('writestorm', {
  internal: {
    health: () => ipcRenderer.invoke('internal:health') as Promise<{ ok: true; app: 'WriteStorm' }>,
  },
});
