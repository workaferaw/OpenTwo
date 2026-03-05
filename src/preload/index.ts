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
  },

  openFileDialog: () => ipcRenderer.invoke('dialog:open-file'),
  showExportDialog: () => ipcRenderer.invoke('dialog:save-export'),

  exportVideo: (options: Record<string, unknown>) => ipcRenderer.invoke('ffmpeg:export', options),
  onExportProgress: (callback: (percent: number) => void) => {
    const handler = (_: unknown, percent: number) => callback(percent)
    ipcRenderer.on('ffmpeg:progress', handler)
    return () => ipcRenderer.removeListener('ffmpeg:progress', handler)
  },

  detectZoomCandidates: (
    cursorData: Array<{ x: number; y: number; t: number }>,
    screenWidth: number,
    screenHeight: number
  ) => ipcRenderer.invoke('zoom:detect', cursorData, screenWidth, screenHeight),

  checkAdb: () => ipcRenderer.invoke('phone:check-adb'),
  getPhoneDevices: () => ipcRenderer.invoke('phone:get-devices')
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
