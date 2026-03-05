import { ElectronAPI } from '@electron-toolkit/preload'

interface OpenTwoAPI {
  getDesktopSources: () => Promise<
    Array<{ id: string; name: string; thumbnail: string }>
  >
  getCursorPosition: () => Promise<{ x: number; y: number }>

  saveFile: (filePath: string, buffer: ArrayBuffer) => Promise<boolean>
  saveJson: (filePath: string, data: unknown) => Promise<boolean>

  showSaveDialog: (options?: { defaultName?: string }) => Promise<string | undefined>
  selectDirectory: () => Promise<string | null>
  getAppPath: (name: string) => Promise<string>

  minimizeWindow: () => Promise<void>
  maximizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
  isMaximized: () => Promise<boolean>

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

  checkAdb: () => Promise<boolean>
  getPhoneDevices: () => Promise<
    Array<{ serial: string; model: string; status: 'device' | 'offline' | 'unauthorized' }>
  >
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: OpenTwoAPI
  }
}
