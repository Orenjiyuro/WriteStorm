import { contextBridge, ipcRenderer } from 'electron';
import { createWritestormPreloadApi } from './writestorm-api';

contextBridge.exposeInMainWorld(
  'writestorm',
  createWritestormPreloadApi((channel, request) => ipcRenderer.invoke(channel, request)),
);
