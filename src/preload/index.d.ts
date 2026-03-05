import { ElectronAPI } from '@electron-toolkit/preload'

interface OpenTwoAPI {
  getDesktopSources: () => Promise<
    Array<{ id: string; name: string; thumbnail: string }>
  >
  getCursorPosition: () => Promise<{ x: number; y: number }>
  getDisplayInfo: () => Promise<{ scaleFactor: number; width: number; height: number }>

  saveFile: (filePath: string, buffer: ArrayBuffer) => Promise<boolean>
  saveJson: (filePath: string, data: unknown) => Promise<boolean>

  showSaveDialog: (options?: { defaultName?: string }) => Promise<string | undefined>
  selectDirectory: () => Promise<string | null>
  getAppPath: (name: string) => Promise<string>

  minimizeWindow: () => Promise<void>
  maximizeWindow: () => Promise<void>
  autoSaveRecording: (options: {
    videoBuffer: ArrayBuffer
    cursorData: Array<{ x: number; y: number; t: number }>
    clickEvents?: Array<{ x: number; y: number; t: number; button: number }>
    displayInfo?: { scaleFactor: number; width: number; height: number }
    projectName?: string
  }) => Promise<{
    success: boolean
    projectDir?: string
    webmPath?: string
    cursorPath?: string
    mp4Path?: string | null
    error?: string
  }>
  closeWindow: () => Promise<void>
  isMaximized: () => Promise<boolean>
  resizeWindow: (mode: 'compact' | 'editor') => Promise<void>

  onTrayStartRecording: (callback: () => void) => () => void
  onTrayStopRecording: (callback: () => void) => () => void

  openFileDialog: () => Promise<string | null>
  showExportDialog: () => Promise<string | undefined>
  exportVideo: (options: Record<string, unknown>) => Promise<{ success: boolean; path?: string; error?: string }>
  onExportProgress: (callback: (percent: number) => void) => () => void
  detectZoomCandidates: (
    cursorData: Array<{ x: number; y: number; t: number }>,
    screenWidth: number,
    screenHeight: number
  ) => Promise<
    Array<{
      timestamp: number
      region: { x: number; y: number; width: number; height: number }
      duration: number
      reason: string
    }>
  >

  readFileBuffer: (filePath: string) => Promise<{ success: boolean; data: ArrayBuffer | null }>
  readJsonFile: (filePath: string) => Promise<{ success: boolean; data: unknown }>

  checkAdb: () => Promise<boolean>
  getPhoneDevices: () => Promise<
    Array<{ serial: string; model: string; status: 'device' | 'offline' | 'unauthorized' }>
  >

  startGlobalMouseCapture: (startTime: number) => Promise<boolean>
  stopGlobalMouseCapture: () => Promise<Array<{ x: number; y: number; t: number; button: number }>>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: OpenTwoAPI
  }
}
