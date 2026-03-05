import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  getDesktopSources: () => ipcRenderer.invoke('desktop-capturer:get-sources'),
  getCursorPosition: () => ipcRenderer.invoke('cursor:get-position'),

  saveFile: (filePath: string, buffer: ArrayBuffer) =>
    ipcRenderer.invoke('file:save-buffer', filePath, buffer),
  saveJson: (filePath: string, data: unknown) =>
    ipcRenderer.invoke('file:save-json', filePath, data),

  showSaveDialog: (options?: { defaultName?: string }) =>
    ipcRenderer.invoke('dialog:save-file', options),
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  getAppPath: (name: string) => ipcRenderer.invoke('app:get-path', name),

  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),

  onTrayStartRecording: (callback: () => void) => {
    ipcRenderer.on('tray:start-recording', callback)
    return () => ipcRenderer.removeListener('tray:start-recording', callback)
  },
  onTrayStopRecording: (callback: () => void) => {
    ipcRenderer.on('tray:stop-recording', callback)
    return () => ipcRenderer.removeListener('tray:stop-recording', callback)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
