export type AuthMethod = 'password' | 'key' | 'agent'

export type Platform =
  | 'aix'
  | 'android'
  | 'darwin'
  | 'freebsd'
  | 'haiku'
  | 'linux'
  | 'openbsd'
  | 'sunos'
  | 'win32'
  | 'cygwin'
  | 'netbsd'

export type ThemeMode = 'dark' | 'light' | 'system'

export type CursorStyle = 'block' | 'bar' | 'underline'

export interface ConnectionProfile {
  id: string
  name: string
  host: string
  port: number
  username: string
  authMethod: AuthMethod
  privateKeyPath: string | null
  group: string
  color: string
  hasPassword: boolean
  hasPassphrase: boolean
  createdAt: number
  updatedAt: number
  lastUsedAt: number | null
}

export interface ProfileInput {
  id?: string
  name: string
  host: string
  port: number
  username: string
  authMethod: AuthMethod
  privateKeyPath?: string | null
  group?: string
  color?: string
  /** Nueva contraseña en claro. Solo se usa para guardar; nunca sale del proceso principal. */
  password?: string
  /** Nuevo passphrase en claro. Solo se usa para guardar; nunca sale del proceso principal. */
  passphrase?: string
  rememberSecret: boolean
}

export interface ProfileSecretInput {
  profileId: string
  kind: 'password' | 'passphrase'
  value: string
}

export interface HistoryEntry {
  command: string
  count: number
  lastUsedAt: number
}

export interface HistoryResult {
  profile: HistoryEntry[]
  global: HistoryEntry[]
}

export interface Snippet {
  id: string
  name: string
  command: string
  description: string
  builtin: boolean
  createdAt: number
}

export interface SnippetInput {
  id?: string
  name: string
  command: string
  description?: string
}

export interface KnownHost {
  id: string
  host: string
  port: number
  fingerprint: string
  addedAt: number
}

export interface AppSettings {
  theme: ThemeMode
  fontSize: number
  fontFamily: string
  cursorStyle: CursorStyle
  cursorBlink: boolean
  copyOnSelect: boolean
  scrollback: number
  suggestionsEnabled: boolean
  ghostSuggestions: boolean
  saveHistory: boolean
  historyLimit: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  fontSize: 14,
  fontFamily: 'jetbrains',
  cursorStyle: 'block',
  cursorBlink: true,
  copyOnSelect: false,
  scrollback: 5000,
  suggestionsEnabled: true,
  ghostSuggestions: true,
  saveHistory: true,
  historyLimit: 1500
}

export const FONT_FAMILIES: Record<string, { label: string; stack: string }> = {
  jetbrains: {
    label: 'JetBrains Mono / Cascadia Code',
    stack: '"JetBrains Mono", "Cascadia Code", "Fira Code", "SFMono-Regular", Consolas, monospace'
  },
  cascadia: {
    label: 'Cascadia Code / Consolas',
    stack: '"Cascadia Code", Consolas, "Courier New", monospace'
  },
  sfmono: {
    label: 'SF Mono / Menlo',
    stack: '"SF Mono", Menlo, Monaco, "Courier New", monospace'
  },
  system: {
    label: 'Monoespaciada del sistema',
    stack: 'ui-monospace, "DejaVu Sans Mono", "Liberation Mono", monospace'
  }
}

export interface SessionConnectInput {
  sessionId: string
  profileId: string
  cols: number
  rows: number
  password?: string
  passphrase?: string
}

export type SshErrorCode =
  | 'PROFILE_NOT_FOUND'
  | 'HOST_UNKNOWN'
  | 'HOST_MISMATCH'
  | 'AUTH_FAILED'
  | 'NEEDS_SECRET'
  | 'NETWORK'
  | 'KEY_ERROR'
  | 'AGENT_ERROR'
  | 'ENCRYPTION_UNAVAILABLE'
  | 'UNKNOWN'

export interface HostVerificationInfo {
  host: string
  port: number
  fingerprint: string
  reason: 'unknown' | 'mismatch'
  previousFingerprint?: string
}

export type SshEvent =
  | {
      type: 'status'
      sessionId: string
      status: 'connecting' | 'connected' | 'closed'
      message?: string
    }
  | { type: 'data'; sessionId: string; data: Uint8Array }
  | {
      type: 'error'
      sessionId: string
      code: SshErrorCode
      message: string
    }
  | {
      type: 'needs-secret'
      sessionId: string
      kind: 'password' | 'passphrase'
      reason: string
    }
  | { type: 'host-verification'; sessionId: string } & HostVerificationInfo

export interface AppInfo {
  appName: string
  version: string
  platform: Platform
  dataDir: string
  encryptionAvailable: boolean
  encryptionBackend: string
  isDev: boolean
}

export type TestConnectionResult =
  | {
      ok: true
      fingerprint: string
      message: string
    }
  | {
      ok: false
      code: SshErrorCode
      message: string
    }

export interface ConfirmDialogOptions {
  title: string
  message: string
  detail?: string
  confirmLabel?: string
  danger?: boolean
}

export interface SshYhosApi {
  platform: Platform
  profiles: {
    list(): Promise<ConnectionProfile[]>
    save(input: ProfileInput): Promise<ConnectionProfile>
    remove(id: string): Promise<void>
    saveSecret(input: ProfileSecretInput): Promise<ConnectionProfile>
    touch(id: string): Promise<void>
  }
  ssh: {
    connect(input: SessionConnectInput): Promise<void>
    write(sessionId: string, data: string): void
    resize(sessionId: string, cols: number, rows: number): void
    disconnect(sessionId: string): void
    test(input: ProfileInput): Promise<TestConnectionResult>
    onEvent(listener: (event: SshEvent) => void): () => void
  }
  history: {
    list(profileId: string): Promise<HistoryResult>
    add(profileId: string, command: string): Promise<void>
    clear(profileId?: string): Promise<void>
  }
  snippets: {
    list(): Promise<Snippet[]>
    save(input: SnippetInput): Promise<Snippet>
    remove(id: string): Promise<void>
  }
  settings: {
    get(): Promise<AppSettings>
    save(patch: Partial<AppSettings>): Promise<AppSettings>
  }
  knownHosts: {
    list(): Promise<KnownHost[]>
    trust(host: string, port: number, fingerprint: string): Promise<KnownHost>
    remove(id: string): Promise<void>
  }
  dialogs: {
    pickPrivateKey(): Promise<string | null>
    confirm(options: ConfirmDialogOptions): Promise<boolean>
    openDataDir(): Promise<void>
  }
  clipboard: {
    readText(): Promise<string>
    writeText(text: string): Promise<void>
  }
  app: {
    info(): Promise<AppInfo>
    openExternal(url: string): Promise<void>
    onMenuAction(listener: (action: string) => void): () => void
  }
}
