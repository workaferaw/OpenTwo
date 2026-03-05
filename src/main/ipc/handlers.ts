import { ipcMain, dialog, app, BrowserWindow } from 'electron'
import { join } from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { exportVideo, ExportOptions, BlurFilterRegion } from '../ffmpeg/processor'
import { detectZoomCandidates } from '../capture/zoom-detector'
import { getConnectedDevices, isAdbAvailable } from '../phone/adb-bridge'

export function registerIpcHandlers(): void {
  ipcMain.handle('dialog:save-file', async (_, options) => {
    const result = await dialog.showSaveDialog({
      defaultPath: join(app.getPath('videos'), options?.defaultName || 'recording.webm'),
      filters: [
        { name: 'WebM Video', extensions: ['webm'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    return result.filePath
  })

  ipcMain.handle('dialog:select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    return result.filePaths[0] || null
  })

  ipcMain.handle('file:save-buffer', async (_, filePath: string, buffer: ArrayBuffer) => {
    const dir = join(filePath, '..')
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }
    await writeFile(filePath, Buffer.from(buffer))
    return true
  })

  ipcMain.handle('file:save-json', async (_, filePath: string, data: unknown) => {
    const dir = join(filePath, '..')
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }
    await writeFile(filePath, JSON.stringify(data, null, 2))
    return true
  })

  ipcMain.handle('app:get-path', (_, name: string) => {
    return app.getPath(name as Parameters<typeof app.getPath>[0])
  })

  ipcMain.handle('dialog:open-file', async () => {
    const result = await dialog.showOpenDialog({
      filters: [
        { name: 'Video Files', extensions: ['webm', 'mp4'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    return result.filePaths[0] || null
  })

  ipcMain.handle('dialog:save-export', async () => {
    const result = await dialog.showSaveDialog({
      defaultPath: join(app.getPath('videos'), `opentwo-export-${Date.now()}.mp4`),
      filters: [
        { name: 'MP4 Video', extensions: ['mp4'] },
        { name: 'WebM Video', extensions: ['webm'] }
      ]
    })
    return result.filePath
  })

  ipcMain.handle(
    'ffmpeg:export',
    async (event, options: ExportOptions & { blurRegions?: BlurFilterRegion[] }) => {
      try {
        const result = await exportVideo(options, (percent) => {
          const win = BrowserWindow.fromWebContents(event.sender)
          win?.webContents.send('ffmpeg:progress', percent)
        })
        return { success: true, path: result }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(
    'zoom:detect',
    async (
      _,
      cursorData: Array<{ x: number; y: number; t: number }>,
      screenWidth: number,
      screenHeight: number
    ) => {
      return detectZoomCandidates(cursorData, screenWidth, screenHeight)
    }
  )

  ipcMain.handle('phone:check-adb', async () => {
    return isAdbAvailable()
  })

  ipcMain.handle('phone:get-devices', async () => {
    return getConnectedDevices()
  })
}
