import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('sttBridge', {
    start: (config) => ipcRenderer.send('stt:start', config),
    stop: () => ipcRenderer.send('stt:stop'),
    sendAudioChunk: (chunk) => ipcRenderer.send('stt:audio-chunk', chunk),
    onPartial: (cb) => ipcRenderer.on('stt:partial', (_e, data) => cb(data)),
    onFinal: (cb) => ipcRenderer.on('stt:final', (_e, data) => cb(data)),
});


