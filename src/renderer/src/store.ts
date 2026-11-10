import { create } from 'zustand'
import {
  DEFAULT_SETTINGS,
  type AppInfo,
  type AppSettings,
  type ConnectionProfile,
  type HistoryEntry,
  type HistoryResult,
  type KnownHost,
  type ProfileInput,
  type Snippet,
  type SnippetInput,
  type SshEvent
} from '@shared/types'

export type TabStatus = 'connecting' | 'connected' | 'closed' | 'error'

export interface HostPrompt {
  host: string
  port: number
  fingerprint: string
  reason: 'unknown' | 'mismatch'
  previousFingerprint?: string
}

export interface SecretPrompt {
  kind: 'password' | 'passphrase'
  reason: string
}

export interface TerminalTab {
  id: string
  profileId: string
  profileName: string
  host: string
  port: number
  username: string
  color: string
  status: TabStatus
  message?: string
  connectAttempt: number
  ephemeralPassword?: string
  ephemeralPassphrase?: string
  hostPrompt?: HostPrompt
  secretPrompt?: SecretPrompt
}

export type SettingsSection = 'general' | 'suggestions' | 'hosts' | 'about'

export type DialogState =
  | { kind: 'connection'; profileId?: string }
  | { kind: 'settings'; section?: SettingsSection }
  | null

export interface Toast {
  id: string
  message: string
  tone: 'info' | 'success' | 'error'
}

interface Store {
  ready: boolean
  fatalError: string | null
  profiles: ConnectionProfile[]
  tabs: TerminalTab[]
  activeTabId: string | null
  settings: AppSettings
  snippets: Snippet[]
  knownHosts: KnownHost[]
  historyByProfile: Record<string, HistoryResult>
  appInfo: AppInfo | null
  dialog: DialogState
  toasts: Toast[]

  bootstrap: () => Promise<void>
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>

  openProfile: (profile: ConnectionProfile, forceNew?: boolean) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  reconnectTab: (tabId: string) => void
  setTabConnection: (tabId: string, patch: Partial<TerminalTab>) => void

  saveProfile: (input: ProfileInput) => Promise<ConnectionProfile>
  removeProfile: (profileId: string) => Promise<void>
  provideSecret: (
    tabId: string,
    value: string,
    remember: boolean
  ) => Promise<void>
  trustHost: (tabId: string) => Promise<void>
  declineHost: (tabId: string) => void
  cancelSecret: (tabId: string) => void
  handleEvent: (event: SshEvent) => void

  loadHistory: (profileId: string) => Promise<void>
  recordCommand: (profileId: string, command: string) => void
  clearHistory: (profileId?: string) => Promise<void>

  saveSnippet: (input: SnippetInput) => Promise<Snippet>
  removeSnippet: (id: string) => Promise<void>

  refreshKnownHosts: () => Promise<void>
  forgetHost: (id: string) => Promise<void>

  openDialog: (dialog: DialogState) => void
  closeDialog: () => void
  addToast: (message: string, tone?: Toast['tone']) => void
  dismissToast: (id: string) => void
}

const makeId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`

const sortProfiles = (profiles: ConnectionProfile[]): ConnectionProfile[] =>
  [...profiles].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))

const patchTab = (
  tabs: TerminalTab[],
  tabId: string,
  patch: Partial<TerminalTab> | ((tab: TerminalTab) => Partial<TerminalTab>)
): TerminalTab[] =>
  tabs.map((tab) => {
    if (tab.id !== tabId) return tab
    return { ...tab, ...(typeof patch === 'function' ? patch(tab) : patch) }
  })

const entry = (command: string): HistoryEntry => ({ command, count: 1, lastUsedAt: Date.now() })

function addHistoryEntry(entries: HistoryEntry[], command: string, limit: number): HistoryEntry[] {
  const now = Date.now()
  const existing = entries.find((item) => item.command === command)
  const next = existing
    ? entries.map((item) =>
        item.command === command ? { ...item, count: item.count + 1, lastUsedAt: now } : item
      )
    : [entry(command), ...entries]
  return next.sort((a, b) => b.lastUsedAt - a.lastUsedAt).slice(0, limit)
}

export const useStore = create<Store>((set, get) => ({
  ready: false,
  fatalError: null,
  profiles: [],
  tabs: [],
  activeTabId: null,
  settings: { ...DEFAULT_SETTINGS },
  snippets: [],
  knownHosts: [],
  historyByProfile: {},
  appInfo: null,
  dialog: null,
  toasts: [],

  bootstrap: async () => {
    try {
      const [profiles, settings, snippets, knownHosts, appInfo] = await Promise.all([
        window.api.profiles.list(),
        window.api.settings.get(),
        window.api.snippets.list(),
        window.api.knownHosts.list(),
        window.api.app.info()
      ])
      set({ profiles, settings, snippets, knownHosts, appInfo, ready: true, fatalError: null })
    } catch (error) {
      set({
        ready: true,
        fatalError: error instanceof Error ? error.message : 'No se pudo cargar la aplicación.'
      })
    }
  },

  saveSettings: async (patch) => {
    const previous = get().settings
    set({ settings: { ...previous, ...patch } })
    try {
      const saved = await window.api.settings.save(patch)
      set({ settings: saved })
    } catch (error) {
      set({ settings: previous })
      get().addToast(error instanceof Error ? error.message : 'No se pudieron guardar los ajustes.', 'error')
    }
  },

  openProfile: (profile, forceNew = false) => {
    const existing = forceNew
      ? undefined
      : get().tabs.find((tab) => tab.profileId === profile.id)
    if (existing) {
      set({ activeTabId: existing.id })
      return
    }

    const tab: TerminalTab = {
      id: makeId(),
      profileId: profile.id,
      profileName: profile.name,
      host: profile.host,
      port: profile.port,
      username: profile.username,
      color: profile.color,
      status: 'connecting',
      connectAttempt: 0
    }
    set((state) => ({ tabs: [...state.tabs, tab], activeTabId: tab.id }))
    void get().loadHistory(profile.id)
  },

  closeTab: (tabId) => {
    window.api.ssh.disconnect(tabId)
    set((state) => {
      const index = state.tabs.findIndex((tab) => tab.id === tabId)
      const tabs = state.tabs.filter((tab) => tab.id !== tabId)
      let activeTabId = state.activeTabId
      if (state.activeTabId === tabId) {
        const next = tabs[Math.min(Math.max(index, 0), tabs.length - 1)]
        activeTabId = next?.id ?? null
      }
      return { tabs, activeTabId }
    })
  },

  setActiveTab: (tabId) => {
    set((state) => (state.tabs.some((tab) => tab.id === tabId) ? { activeTabId: tabId } : {}))
  },

  reconnectTab: (tabId) => {
    set((state) => ({
      tabs: patchTab(state.tabs, tabId, (tab) => ({
        status: 'connecting',
        message: undefined,
        hostPrompt: undefined,
        secretPrompt: undefined,
        connectAttempt: tab.connectAttempt + 1
      }))
    }))
  },

  setTabConnection: (tabId, patch) => {
    set((state) => ({ tabs: patchTab(state.tabs, tabId, patch) }))
  },

  saveProfile: async (input) => {
    const saved = await window.api.profiles.save(input)
    set((state) => ({
      profiles: sortProfiles([...state.profiles.filter((item) => item.id !== saved.id), saved]),
      tabs: state.tabs.map((tab) =>
        tab.profileId === saved.id
          ? {
              ...tab,
              profileName: saved.name,
              host: saved.host,
              port: saved.port,
              username: saved.username,
              color: saved.color
            }
          : tab
      )
    }))
    return saved
  },

  removeProfile: async (profileId) => {
    await window.api.profiles.remove(profileId)
    set((state) => {
      const removedIds = new Set(
        state.tabs.filter((tab) => tab.profileId === profileId).map((tab) => tab.id)
      )
      const tabs = state.tabs.filter((tab) => tab.profileId !== profileId)
      const firstRemovedIndex = state.tabs.findIndex((tab) => tab.profileId === profileId)
      let activeTabId = state.activeTabId
      if (activeTabId && removedIds.has(activeTabId)) {
        activeTabId = tabs[Math.min(Math.max(firstRemovedIndex, 0), tabs.length - 1)]?.id ?? null
      }
      const historyByProfile = { ...state.historyByProfile }
      delete historyByProfile[profileId]
      return {
        profiles: state.profiles.filter((profile) => profile.id !== profileId),
        tabs,
        activeTabId,
        historyByProfile
      }
    })
  },

  provideSecret: async (tabId, value, remember) => {
    const tab = get().tabs.find((item) => item.id === tabId)
    const prompt = tab?.secretPrompt
    if (!tab || !prompt) return

    set((state) => ({
      tabs: patchTab(state.tabs, tabId, {
        secretPrompt: undefined,
        status: 'connecting',
        message: undefined,
        connectAttempt: tab.connectAttempt + 1,
        ...(prompt.kind === 'password'
          ? { ephemeralPassword: value }
          : { ephemeralPassphrase: value })
      })
    }))

    if (remember) {
      try {
        const profile = await window.api.profiles.saveSecret({
          profileId: tab.profileId,
          kind: prompt.kind,
          value
        })
        set((state) => ({
          profiles: sortProfiles([...state.profiles.filter((item) => item.id !== profile.id), profile])
        }))
        get().addToast('Secreto guardado cifrado en este equipo.', 'success')
      } catch (error) {
        get().addToast(
          error instanceof Error
            ? error.message
            : 'No se pudo guardar el secreto, pero la conexión continuará.',
          'error'
        )
      }
    }
  },

  trustHost: async (tabId) => {
    const tab = get().tabs.find((item) => item.id === tabId)
    const prompt = tab?.hostPrompt
    if (!tab || !prompt) return
    try {
      await window.api.knownHosts.trust(prompt.host, prompt.port, prompt.fingerprint)
      const knownHosts = await window.api.knownHosts.list()
      set((state) => ({
        knownHosts,
        tabs: patchTab(state.tabs, tabId, (item) => ({
          hostPrompt: undefined,
          status: 'connecting',
          connectAttempt: item.connectAttempt + 1
        }))
      }))
      get().addToast('Huella verificada y guardada en este equipo.', 'success')
    } catch (error) {
      get().addToast(error instanceof Error ? error.message : 'No se pudo guardar la huella.', 'error')
    }
  },

  declineHost: (tabId) => {
    window.api.ssh.disconnect(tabId)
    set((state) => ({
      tabs: patchTab(state.tabs, tabId, {
        hostPrompt: undefined,
        status: 'closed',
        message: 'Verificación de huella cancelada.'
      })
    }))
  },

  cancelSecret: (tabId) => {
    window.api.ssh.disconnect(tabId)
    set((state) => ({
      tabs: patchTab(state.tabs, tabId, {
        secretPrompt: undefined,
        status: 'closed',
        message: 'Inicio de sesión cancelado.'
      })
    }))
  },

  handleEvent: (event) => {
    if (event.type === 'data') return
    if (event.type === 'status') {
      set((state) => ({
        tabs: patchTab(state.tabs, event.sessionId, () => ({
          status: event.status,
          message: event.message,
          ...(event.status === 'connected'
            ? {
                hostPrompt: undefined,
                secretPrompt: undefined,
                ephemeralPassword: undefined,
                ephemeralPassphrase: undefined
              }
            : {}),
          ...(event.status === 'closed'
            ? { ephemeralPassword: undefined, ephemeralPassphrase: undefined }
            : {})
        }))
      }))
      return
    }
    if (event.type === 'error') {
      set((state) => ({
        tabs: patchTab(state.tabs, event.sessionId, {
          status: 'error',
          message: event.message,
          hostPrompt: undefined,
          secretPrompt: undefined
        })
      }))
      return
    }
    if (event.type === 'host-verification') {
      set((state) => ({
        tabs: patchTab(state.tabs, event.sessionId, {
          hostPrompt: {
            host: event.host,
            port: event.port,
            fingerprint: event.fingerprint,
            reason: event.reason,
            previousFingerprint: event.previousFingerprint
          }
        })
      }))
      return
    }
    if (event.type === 'needs-secret') {
      set((state) => ({
        tabs: patchTab(state.tabs, event.sessionId, {
          status: 'connecting',
          secretPrompt: { kind: event.kind, reason: event.reason }
        })
      }))
    }
  },

  loadHistory: async (profileId) => {
    try {
      const result = await window.api.history.list(profileId)
      set((state) => ({
        historyByProfile: { ...state.historyByProfile, [profileId]: result }
      }))
    } catch {
      // El historial es opcional; no bloquea la conexión.
    }
  },

  recordCommand: (profileId, command) => {
    const { settings } = get()
    if (!settings.saveHistory) return
    const clean = command.trim()
    if (!clean || clean.startsWith(' ')) return
    set((state) => {
      const current = state.historyByProfile[profileId] ?? { profile: [], global: [] }
      return {
        historyByProfile: {
          ...state.historyByProfile,
          [profileId]: {
            profile: addHistoryEntry(current.profile, clean, settings.historyLimit),
            global: addHistoryEntry(current.global, clean, settings.historyLimit * 2)
          }
        }
      }
    })
    void window.api.history.add(profileId, clean)
  },

  clearHistory: async (profileId) => {
    await window.api.history.clear(profileId)
    set((state) => {
      if (!profileId) return { historyByProfile: {} }
      const next = { ...state.historyByProfile }
      delete next[profileId]
      return { historyByProfile: next }
    })
  },

  saveSnippet: async (input) => {
    const snippet = await window.api.snippets.save(input)
    set((state) => ({
      snippets: [snippet, ...state.snippets.filter((item) => item.id !== snippet.id)]
    }))
    return snippet
  },

  removeSnippet: async (id) => {
    await window.api.snippets.remove(id)
    set((state) => ({ snippets: state.snippets.filter((item) => item.id !== id) }))
  },

  refreshKnownHosts: async () => {
    set({ knownHosts: await window.api.knownHosts.list() })
  },

  forgetHost: async (id) => {
    await window.api.knownHosts.remove(id)
    set((state) => ({ knownHosts: state.knownHosts.filter((host) => host.id !== id) }))
    get().addToast('Huella olvidada. Se volverá a pedir al conectar.', 'info')
  },

  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),

  addToast: (message, tone = 'info') => {
    const id = makeId()
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }))
    setTimeout(() => get().dismissToast(id), 5000)
  },

  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
  }
}))
