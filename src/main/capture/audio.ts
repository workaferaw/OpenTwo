import { ipcMain } from 'electron'

export function registerAudioHandlers(): void {
  ipcMain.handle('audio:get-devices', async () => {
    // Audio device enumeration happens in the renderer process
    // via navigator.mediaDevices.enumerateDevices()
    // This handler exists for future system-level audio routing
    return { success: true }
  })
}
