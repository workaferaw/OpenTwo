import { ipcMain, dialog, app } from 'electron'
import { join } from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'

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
}
