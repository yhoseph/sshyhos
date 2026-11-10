import { app, BrowserWindow, session, shell } from 'electron'
import { join } from 'node:path'
import { IPC } from '../shared/ipc'
import type { SshEvent } from '../shared/types'
import { registerIpc } from './ipc'
import { setupMenu, type MenuAction } from './menu'
import { createServices, type Services } from './services'

app.setName('SSH Yhos')
if (process.platform === 'win32') app.setAppUserModelId('com.yhoseph.sshyhos')

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
let services: Services | null = null

function sendSshEvent(event: SshEvent): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send(IPC.sshEvent, event)
}

function sendMenuAction(action: MenuAction): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('menu:action', action)
}

function isSafeExternal(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

function createWindow(): void {
  const isMac = process.platform === 'darwin'
  const isWin = process.platform === 'win32'

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 940,
    minHeight: 600,
    show: false,
    title: 'SSH Yhos',
    backgroundColor: '#0b0f14',
    autoHideMenuBar: true,
    titleBarStyle: isMac ? 'hiddenInset' : isWin ? 'hidden' : 'default',
    ...(isWin
      ? {
          titleBarOverlay: {
            color: '#0b0f14',
            symbolColor: '#c7d3e1',
            height: 40
          }
        }
      : {}),
    ...(isMac ? { trafficLightPosition: { x: 16, y: 14 } } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      webviewTag: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternal(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow?.webContents.getURL()
    if (url !== current) {
      event.preventDefault()
      if (isSafeExternal(url)) void shell.openExternal(url)
    }
  })

  mainWindow.webContents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void mainWindow.loadURL(devUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

if (gotLock) {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  void app.whenReady().then(() => {
    const allowedPermissions = new Set([
      'clipboard-read',
      'clipboard-write',
      'clipboard-sanitized-write'
    ])
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      callback(allowedPermissions.has(permission))
    })
    session.defaultSession.setPermissionCheckHandler((_webContents, permission) =>
      allowedPermissions.has(permission)
    )

    services = createServices(sendSshEvent)
    registerIpc(services, () => mainWindow)
    createWindow()
    setupMenu(sendMenuAction)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    services?.sessions.disconnectAll()
  })
}
