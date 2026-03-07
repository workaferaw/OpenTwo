import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  getDesktopSources: () => ipcRenderer.invoke('desktop-capturer:get-sources'),
  getCursorPosition: () => ipcRenderer.invoke('cursor:get-position'),
  getDisplayInfo: () => ipcRenderer.invoke('display:get-info'),

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
  resizeWindow: (mode: 'compact' | 'editor') => ipcRenderer.invoke('window:resize', mode),

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

  readFileBuffer: (filePath: string) => ipcRenderer.invoke('file:read-buffer', filePath),
  readJsonFile: (filePath: string) => ipcRenderer.invoke('file:read-json', filePath),

  autoSaveRecording: (options: {
    videoBuffer: ArrayBuffer
    cursorData: Array<{ x: number; y: number; t: number }>
    clickEvents?: Array<{ x: number; y: number; t: number; button: number }>
    projectName?: string
  }) => ipcRenderer.invoke('recording:auto-save', options),

  checkAdb: () => ipcRenderer.invoke('phone:check-adb'),
  getPhoneDevices: () => ipcRenderer.invoke('phone:get-devices'),

  startGlobalMouseCapture: (startTime: number) => ipcRenderer.invoke('global-mouse:start', startTime),
  stopGlobalMouseCapture: () => ipcRenderer.invoke('global-mouse:stop') as Promise<Array<{ x: number; y: number; t: number; button: number }>>,

  exportReadyVideo: (options: {
    inputPath: string
    outputPath: string
    cursorData: Array<{ x: number; y: number; t: number }>
    clickEvents: Array<{ x: number; y: number; t: number; button: number }>
    displayInfo?: { scaleFactor: number; width: number; height: number }
  }) => ipcRenderer.invoke('ffmpeg:export-ready', options) as Promise<{ success: boolean; path?: string; error?: string }>,

  // Canvas-based export (frame-by-frame rendering)
  canvasExportStart: (options: {
    outputPath: string
    audioSourcePath: string
    width: number
    height: number
    fps: number
    totalFrames: number
  }) => ipcRenderer.invoke('canvas-export:start', options),

  canvasExportFrame: (frameIndex: number, pngBuffer: ArrayBuffer) =>
    ipcRenderer.invoke('canvas-export:frame', frameIndex, pngBuffer),

  canvasExportFinish: () => ipcRenderer.invoke('canvas-export:finish'),

  canvasExportSaveBlob: (webmBuffer: ArrayBuffer) =>
    ipcRenderer.invoke('canvas-export:save-blob', webmBuffer) as Promise<{ success: boolean; path?: string; error?: string }>,
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
