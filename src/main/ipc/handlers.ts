import { ipcMain, dialog, app, BrowserWindow } from 'electron'
import { join, basename } from 'path'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { exportVideo, exportReadyVideo, ExportOptions, BlurFilterRegion } from '../ffmpeg/processor'
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

  ipcMain.handle('file:read-buffer', async (_, filePath: string) => {
    try {
      const buffer = await readFile(filePath)
      return { success: true, data: buffer.buffer }
    } catch {
      return { success: false, data: null }
    }
  })

  ipcMain.handle('file:read-json', async (_, filePath: string) => {
    try {
      const content = await readFile(filePath, 'utf-8')
      return { success: true, data: JSON.parse(content) }
    } catch {
      return { success: false, data: null }
    }
  })

  ipcMain.handle('recording:auto-save', async (event, options: {
    videoBuffer: ArrayBuffer
    cursorData: Array<{ x: number; y: number; t: number }>
    clickEvents?: Array<{ x: number; y: number; t: number; button: number }>
    projectName?: string
  }) => {
    try {
      const videosDir = app.getPath('videos')
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const projectName = options.projectName || `opentwo-${ts}`
      const projectDir = join(videosDir, projectName)

      if (!existsSync(projectDir)) {
        await mkdir(projectDir, { recursive: true })
      }

      const webmPath = join(projectDir, 'recording.webm')
      const cursorPath = join(projectDir, 'cursor.json')
      const clicksPath = join(projectDir, 'clicks.json')
      const projectJsonPath = join(projectDir, 'project.json')
      const mp4Path = join(projectDir, 'ready.mp4')

      await writeFile(webmPath, Buffer.from(options.videoBuffer))
      await writeFile(cursorPath, JSON.stringify(options.cursorData, null, 2))
      await writeFile(clicksPath, JSON.stringify(options.clickEvents || [], null, 2))
      await writeFile(projectJsonPath, JSON.stringify({
        version: 1,
        createdAt: new Date().toISOString(),
        files: { recording: 'recording.webm', cursor: 'cursor.json', clicks: 'clicks.json', ready: 'ready.mp4' }
      }, null, 2))

      const win = BrowserWindow.fromWebContents(event.sender)

      try {
        await exportReadyVideo(
          {
            inputPath: webmPath,
            outputPath: mp4Path,
            cursorData: options.cursorData,
            clickEvents: options.clickEvents || [],
            zoomFactor: 2,
            smoothing: 0.08
          },
          (percent) => {
            win?.webContents.send('ffmpeg:progress', percent)
          }
        )
      } catch (exportErr) {
        console.error('Auto-export failed, raw files still saved:', exportErr)
      }

      return {
        success: true,
        projectDir,
        webmPath,
        cursorPath,
        mp4Path: existsSync(mp4Path) ? mp4Path : null
      }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('phone:check-adb', async () => {
    return isAdbAvailable()
  })

  ipcMain.handle('phone:get-devices', async () => {
    return getConnectedDevices()
  })
}
