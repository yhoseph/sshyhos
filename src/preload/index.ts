import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  AppSettings,
  ConfirmDialogOptions,
  ConnectionProfile,
  ProfileInput,
  ProfileSecretInput,
  SessionConnectInput,
  Snippet,
  SnippetInput,
  SshEvent,
  SshYhosApi,
  TestConnectionResult
} from '../shared/types'

const api: SshYhosApi = {
  platform: process.platform,

  profiles: {
    list: () => ipcRenderer.invoke(IPC.profilesList) as Promise<ConnectionProfile[]>,
    save: (input: ProfileInput) =>
      ipcRenderer.invoke(IPC.profilesSave, input) as Promise<ConnectionProfile>,
    remove: (id: string) => ipcRenderer.invoke(IPC.profilesRemove, id) as Promise<void>,
    saveSecret: (input: ProfileSecretInput) =>
      ipcRenderer.invoke(IPC.profilesSaveSecret, input) as Promise<ConnectionProfile>,
    touch: (id: string) => ipcRenderer.invoke(IPC.profilesTouch, id) as Promise<void>
  },

  ssh: {
    connect: (input: SessionConnectInput) =>
      ipcRenderer.invoke(IPC.sshConnect, input) as Promise<void>,
    write: (sessionId: string, data: string) => ipcRenderer.send(IPC.sshWrite, sessionId, data),
    resize: (sessionId: string, cols: number, rows: number) =>
      ipcRenderer.send(IPC.sshResize, sessionId, cols, rows),
    disconnect: (sessionId: string) => ipcRenderer.send(IPC.sshDisconnect, sessionId),
    test: (input: ProfileInput) =>
      ipcRenderer.invoke(IPC.sshTest, input) as Promise<TestConnectionResult>,
    onEvent: (listener: (event: SshEvent) => void) => {
      const handler = (_event: IpcRendererEvent, payload: SshEvent): void => listener(payload)
      ipcRenderer.on(IPC.sshEvent, handler)
      return () => ipcRenderer.removeListener(IPC.sshEvent, handler)
    }
  },

  history: {
    list: (profileId: string) => ipcRenderer.invoke(IPC.historyList, profileId),
    add: (profileId: string, command: string) =>
      ipcRenderer.invoke(IPC.historyAdd, profileId, command) as Promise<void>,
    clear: (profileId?: string) =>
      ipcRenderer.invoke(IPC.historyClear, profileId) as Promise<void>
  },

  snippets: {
    list: () => ipcRenderer.invoke(IPC.snippetsList) as Promise<Snippet[]>,
    save: (input: SnippetInput) =>
      ipcRenderer.invoke(IPC.snippetsSave, input) as Promise<Snippet>,
    remove: (id: string) => ipcRenderer.invoke(IPC.snippetsRemove, id) as Promise<void>
  },

  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet) as Promise<AppSettings>,
    save: (patch: Partial<AppSettings>) =>
      ipcRenderer.invoke(IPC.settingsSave, patch) as Promise<AppSettings>
  },

  knownHosts: {
    list: () => ipcRenderer.invoke(IPC.knownHostsList),
    trust: (host: string, port: number, fingerprint: string) =>
      ipcRenderer.invoke(IPC.knownHostsTrust, host, port, fingerprint),
    remove: (id: string) => ipcRenderer.invoke(IPC.knownHostsRemove, id) as Promise<void>
  },

  dialogs: {
    pickPrivateKey: () => ipcRenderer.invoke(IPC.dialogPickKey) as Promise<string | null>,
    confirm: (options: ConfirmDialogOptions) =>
      ipcRenderer.invoke(IPC.dialogConfirm, options) as Promise<boolean>,
    openDataDir: () => ipcRenderer.invoke(IPC.dialogOpenDataDir) as Promise<void>
  },

  clipboard: {
    readText: () => ipcRenderer.invoke(IPC.clipboardRead) as Promise<string>,
    writeText: (text: string) => ipcRenderer.invoke(IPC.clipboardWrite, text) as Promise<void>
  },

  app: {
    info: () => ipcRenderer.invoke(IPC.appInfo),
    openExternal: (url: string) => ipcRenderer.invoke(IPC.appOpenExternal, url) as Promise<void>,
    onMenuAction: (listener: (action: string) => void) => {
      const handler = (_event: IpcRendererEvent, action: string): void => listener(action)
      ipcRenderer.on('menu:action', handler)
      return () => ipcRenderer.removeListener('menu:action', handler)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
