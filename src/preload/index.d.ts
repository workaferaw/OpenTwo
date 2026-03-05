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
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: OpenTwoAPI
  }
}
