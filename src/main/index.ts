import {
  app, shell, BrowserWindow, Tray, Menu, nativeImage,
  ipcMain, desktopCapturer, screen, globalShortcut,
  protocol, net
} from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { registerIpcHandlers } from './ipc/handlers'
import { startGlobalClickCapture, stopGlobalClickCapture } from './capture/global-mouse'
import { registerCanvasExportHandlers } from './ffmpeg/canvas-export'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      stream: true,
      bypassCSP: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
])

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
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
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
  electronApp.setAppUserModelId('com.opentwo.app')

  protocol.handle('media', (request) => {
    // request.url looks like: media://C:/Users/worka/Videos/opentwo-.../recording.webm
    const raw = request.url.replace('media://', '')
    const filePath = decodeURIComponent(raw)
    // Ensure proper file:// URL format for Windows paths
    const normalized = filePath.replace(/\\/g, '/')
    const fileUrl = normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`
    return net.fetch(fileUrl)
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()

  // Register canvas-based export handlers
  registerCanvasExportHandlers()

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

  ipcMain.handle('display:get-info', () => {
    const primary = screen.getPrimaryDisplay()
    return {
      scaleFactor: primary.scaleFactor,
      width: primary.size.width,
      height: primary.size.height
    }
  })

  ipcMain.handle('global-mouse:start', (_, startTime: number) => {
    startGlobalClickCapture(startTime)
    return true
  })

  ipcMain.handle('global-mouse:stop', () => {
    return stopGlobalClickCapture()
  })

  createWindow()
  createTray()

  globalShortcut.register('F9', () => {
    mainWindow?.webContents.send('tray:start-recording')
  })

  globalShortcut.register('F10', () => {
    mainWindow?.webContents.send('tray:stop-recording')
  })

  if (!is.dev) {
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

