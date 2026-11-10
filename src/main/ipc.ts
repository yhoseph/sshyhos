import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  shell,
  type IpcMainEvent,
  type IpcMainInvokeEvent
} from 'electron'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { IPC } from '../shared/ipc'
import type {
  ConfirmDialogOptions,
  ProfileInput,
  ProfileSecretInput,
  SessionConnectInput,
  SnippetInput
} from '../shared/types'
import type { Services } from './services'

function isTrusted(
  event: IpcMainEvent | IpcMainInvokeEvent,
  getWindow: () => BrowserWindow | null
): boolean {
  const win = getWindow()
  return Boolean(win && !win.isDestroyed() && event.sender.id === win.webContents.id)
}

export function registerIpc(services: Services, getWindow: () => BrowserWindow | null): void {
  const handle = <T>(
    channel: string,
    listener: (event: IpcMainInvokeEvent, ...args: never[]) => T
  ): void => {
    ipcMain.handle(channel, (event, ...args) => {
      if (!isTrusted(event, getWindow)) throw new Error('Origen no autorizado.')
      return listener(event, ...(args as never[]))
    })
  }

  const guardEvent = (event: IpcMainEvent): boolean => isTrusted(event, getWindow)

  // Conexiones guardadas
  handle(IPC.profilesList, () => services.profiles.list())
  handle(IPC.profilesSave, (_event, input: ProfileInput) => services.profiles.save(input))
  handle(IPC.profilesRemove, (_event, id: string) => {
    if (typeof id !== 'string' || !id) throw new Error('Identificador no válido.')
    services.sessions.disconnectProfile(id)
    services.history.clear(id)
    services.profiles.remove(id)
  })
  handle(IPC.profilesSaveSecret, (_event, input: ProfileSecretInput) => {
    if (
      !input ||
      typeof input.profileId !== 'string' ||
      (input.kind !== 'password' && input.kind !== 'passphrase') ||
      typeof input.value !== 'string' ||
      !input.value
    ) {
      throw new Error('Secreto no válido.')
    }
    return services.profiles.saveSecret(input.profileId, input.kind, input.value)
  })
  handle(IPC.profilesTouch, (_event, id: string) => {
    if (typeof id === 'string' && id) services.profiles.touch(id)
  })

  // SSH
  handle(IPC.sshConnect, (_event, input: SessionConnectInput) => {
    if (
      !input ||
      typeof input.sessionId !== 'string' ||
      typeof input.profileId !== 'string' ||
      typeof input.cols !== 'number' ||
      typeof input.rows !== 'number'
    ) {
      throw new Error('Datos de conexión no válidos.')
    }
    return services.sessions.connect(input)
  })
  handle(IPC.sshTest, (_event, input: ProfileInput) => {
    if (!input || typeof input !== 'object') throw new Error('Datos no válidos.')
    return services.sessions.test(input)
  })

  ipcMain.on(IPC.sshWrite, (event, sessionId: unknown, data: unknown) => {
    if (!guardEvent(event)) return
    if (typeof sessionId === 'string' && typeof data === 'string') {
      services.sessions.write(sessionId, data)
    }
  })
  ipcMain.on(IPC.sshResize, (event, sessionId: unknown, cols: unknown, rows: unknown) => {
    if (!guardEvent(event)) return
    if (typeof sessionId === 'string' && typeof cols === 'number' && typeof rows === 'number') {
      services.sessions.resize(sessionId, cols, rows)
    }
  })
  ipcMain.on(IPC.sshDisconnect, (event, sessionId: unknown) => {
    if (!guardEvent(event)) return
    if (typeof sessionId === 'string') services.sessions.disconnect(sessionId)
  })

  // Historial
  handle(IPC.historyList, (_event, profileId: string) => {
    if (typeof profileId !== 'string') throw new Error('Perfil no válido.')
    return services.history.list(profileId)
  })
  handle(IPC.historyAdd, (_event, profileId: string, command: string) => {
    if (typeof profileId !== 'string' || typeof command !== 'string') {
      throw new Error('Comando no válido.')
    }
    services.history.add(profileId, command)
  })
  handle(IPC.historyClear, (_event, profileId: string | undefined) => {
    services.history.clear(typeof profileId === 'string' && profileId ? profileId : undefined)
  })

  // Snippets
  handle(IPC.snippetsList, () => services.snippets.list())
  handle(IPC.snippetsSave, (_event, input: SnippetInput) => {
    if (!input || typeof input !== 'object') throw new Error('Comando no válido.')
    return services.snippets.save(input)
  })
  handle(IPC.snippetsRemove, (_event, id: string) => {
    if (typeof id !== 'string' || !id) throw new Error('Identificador no válido.')
    services.snippets.remove(id)
  })

  // Ajustes
  handle(IPC.settingsGet, () => services.settings.get())
  handle(IPC.settingsSave, (_event, patch: Record<string, unknown>) => {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new Error('Ajustes no válidos.')
    }
    return services.settings.save(patch)
  })

  // Hosts conocidos
  handle(IPC.knownHostsList, () => services.knownHosts.list())
  handle(IPC.knownHostsTrust, (_event, host: string, port: number, fingerprint: string) => {
    if (typeof host !== 'string' || !host || typeof fingerprint !== 'string' || !fingerprint) {
      throw new Error('Huella no válida.')
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('Puerto no válido.')
    }
    return services.knownHosts.trust(host, port, fingerprint)
  })
  handle(IPC.knownHostsRemove, (_event, id: string) => {
    if (typeof id !== 'string' || !id) throw new Error('Identificador no válido.')
    services.knownHosts.remove(id)
  })

  // Diálogos
  handle(IPC.dialogPickKey, async () => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Selecciona tu clave privada SSH',
      defaultPath: join(homedir(), '.ssh'),
      properties: ['openFile', 'showHiddenFiles']
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  handle(IPC.dialogConfirm, async (_event, options: ConfirmDialogOptions) => {
    const win = getWindow()
    if (!win) return false
    const result = await dialog.showMessageBox(win, {
      type: options?.danger ? 'warning' : 'question',
      title: options?.title || 'Confirmar',
      message: options?.message || '¿Seguro que quieres continuar?',
      detail: options?.detail,
      buttons: ['Cancelar', options?.confirmLabel || 'Confirmar'],
      defaultId: options?.danger ? 0 : 1,
      cancelId: 0,
      noLink: true
    })
    return result.response === 1
  })

  handle(IPC.dialogOpenDataDir, async () => {
    await shell.openPath(services.dataDir)
  })

  // Portapapeles
  handle(IPC.clipboardRead, () => clipboard.readText())
  handle(IPC.clipboardWrite, (_event, text: unknown) => {
    if (typeof text === 'string') clipboard.writeText(text)
  })

  // App
  handle(IPC.appInfo, async () => ({
    appName: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    dataDir: services.dataDir,
    encryptionAvailable: await services.vault.isAvailable(),
    encryptionBackend: services.vault.backend(),
    isDev: !app.isPackaged
  }))

  handle(IPC.appOpenExternal, async (_event, rawUrl: string) => {
    if (typeof rawUrl !== 'string') return
    let url: URL
    try {
      url = new URL(rawUrl)
    } catch {
      return
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return
    await shell.openExternal(url.toString())
  })
}
