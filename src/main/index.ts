import {
  app, shell, BrowserWindow, Tray, Menu, nativeImage,
  ipcMain, desktopCapturer, screen, globalShortcut
} from 'electron'
import { join } from 'path'
import { autoUpdater } from 'electron-updater'
import { registerIpcHandlers } from './ipc/handlers'

// Inline dev detection — avoids @electron-toolkit/utils module load crash
const isDev = (): boolean => !app.isPackaged

// Inline window shortcut watcher (dev only: F12 for devtools)
function watchWindowShortcuts(window: BrowserWindow): void {
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.code === 'F12') {
      if (window.webContents.isDevToolsOpened()) {
        window.webContents.closeDevTools()
      } else {
        window.webContents.openDevTools({ mode: 'undocked' })
      }
    }
  })
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null


function getIconPath(): string {
  const iconName = process.platform === 'win32' ? 'icon.png' : 'icon.png'
  return join(__dirname, '../../build', iconName)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 680,
    height: 460,
    minWidth: 580,
    minHeight: 400,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a0c',
    resizable: true,
    icon: getIconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !isDev()
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev() && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createTray(): void {
  const trayIconPath = join(__dirname, '../../build/tray-icon.png')
  let icon: Electron.NativeImage
  try {
    icon = nativeImage.createFromPath(trayIconPath)
  } catch {
    icon = nativeImage.createEmpty()
  }
  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open OpenTwo', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Start Recording', click: () => mainWindow?.webContents.send('tray:start-recording') },
    { label: 'Stop Recording', click: () => mainWindow?.webContents.send('tray:stop-recording') },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])

  tray.setToolTip('OpenTwo')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => mainWindow?.show())
}

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('com.opentwo.app')

  app.on('browser-window-created', (_, window) => {
    watchWindowShortcuts(window)
  })

  registerIpcHandlers()

  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized())
  ipcMain.handle('window:resize', (_, mode: 'compact' | 'editor') => {
    if (!mainWindow) return
    if (mode === 'editor') {
      mainWindow.setMinimumSize(900, 600)
      mainWindow.setSize(1100, 720, true)
      mainWindow.center()
    } else {
      mainWindow.setMinimumSize(580, 400)
      mainWindow.setSize(680, 460, true)
      mainWindow.center()
    }
  })

  ipcMain.handle('desktop-capturer:get-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 320, height: 180 }
    })
    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL()
    }))
  })

  ipcMain.handle('cursor:get-position', () => {
    const point = screen.getCursorScreenPoint()
    const display = screen.getDisplayNearestPoint(point)
    const sf = display.scaleFactor
    return { x: point.x * sf, y: point.y * sf }
  })

  createWindow()
  createTray()

  globalShortcut.register('F9', () => {
    mainWindow?.webContents.send('tray:start-recording')
  })

  globalShortcut.register('F10', () => {
    mainWindow?.webContents.send('tray:stop-recording')
  })

  if (!isDev()) {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.checkForUpdatesAndNotify()

    autoUpdater.on('update-available', () => {
      mainWindow?.webContents.send('updater:available')
    })
    autoUpdater.on('update-downloaded', () => {
      mainWindow?.webContents.send('updater:downloaded')
    })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

