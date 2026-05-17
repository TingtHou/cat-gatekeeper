// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cat', {
  onAppear:       (fn) => ipcRenderer.on('cat-appear',    fn),
  onDisappear:    (fn) => ipcRenderer.on('cat-disappear', fn),
  petted:         ()   => ipcRenderer.send('cat-petted'),
  getAssetConfig: ()   => ipcRenderer.invoke('get-asset-config'),
});
