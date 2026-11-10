import { randomUUID } from 'node:crypto'
import type { AuthMethod, ConnectionProfile, ProfileInput } from '../../shared/types'
import { GROUP_FALLBACK, PROFILE_COLORS } from '../../shared/colors'
import { isRecord } from '../util'
import { JsonStore } from './json-store'
import type { Vault } from './vault'

interface ProfilesFile {
  version: 1
  profiles: ConnectionProfile[]
}

const emptyFile: ProfilesFile = { version: 1, profiles: [] }
const AUTH_METHODS: AuthMethod[] = ['password', 'key', 'agent']

function parseProfile(raw: unknown): ConnectionProfile | null {
  if (!isRecord(raw)) return null
  const id = typeof raw.id === 'string' ? raw.id : ''
  const host = typeof raw.host === 'string' ? raw.host : ''
  const username = typeof raw.username === 'string' ? raw.username : ''
  if (!id || !host || !username) return null
  const authMethod = AUTH_METHODS.includes(raw.authMethod as AuthMethod)
    ? (raw.authMethod as AuthMethod)
    : 'password'
  return {
    id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : `${username}@${host}`,
    host,
    port: typeof raw.port === 'number' && raw.port > 0 && raw.port <= 65535 ? raw.port : 22,
    username,
    authMethod,
    privateKeyPath: typeof raw.privateKeyPath === 'string' ? raw.privateKeyPath : null,
    group: typeof raw.group === 'string' ? raw.group : GROUP_FALLBACK,
    color: typeof raw.color === 'string' && /^#[0-9a-f]{6}$/iu.test(raw.color) ? raw.color : PROFILE_COLORS[0],
    hasPassword: raw.hasPassword === true,
    hasPassphrase: raw.hasPassphrase === true,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
    lastUsedAt: typeof raw.lastUsedAt === 'number' ? raw.lastUsedAt : null
  }
}

function parseProfiles(raw: unknown): ProfilesFile | null {
  if (!isRecord(raw) || !Array.isArray(raw.profiles)) return null
  const profiles: ConnectionProfile[] = []
  for (const item of raw.profiles) {
    const profile = parseProfile(item)
    if (profile) profiles.push(profile)
  }
  return { version: 1, profiles }
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

export class ProfileStore {
  private readonly store: JsonStore<ProfilesFile>

  constructor(
    file: string,
    private readonly vault: Vault
  ) {
    this.store = new JsonStore(file, () => emptyFile, parseProfiles)
  }

  list(): ConnectionProfile[] {
    return this.store
      .read()
      .profiles.map((profile) => this.refreshSecrets(profile))
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
  }

  get(id: string): ConnectionProfile | undefined {
    const profile = this.store.read().profiles.find((item) => item.id === id)
    return profile ? this.refreshSecrets(profile) : undefined
  }

  private refreshSecrets(profile: ConnectionProfile): ConnectionProfile {
    return {
      ...profile,
      hasPassword: this.vault.has(profile.id, 'password'),
      hasPassphrase: this.vault.has(profile.id, 'passphrase')
    }
  }

  async save(input: ProfileInput): Promise<ConnectionProfile> {
    const host = cleanText(input.host, 253)
    const username = cleanText(input.username, 128)
    if (!host) throw new Error('Escribe el host o la IP del servidor.')
    if (!username) throw new Error('Escribe el usuario de SSH.')

    const port = Number(input.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('El puerto debe ser un número entre 1 y 65535.')
    }
    if (!AUTH_METHODS.includes(input.authMethod)) {
      throw new Error('Método de autenticación no válido.')
    }

    const authMethod = input.authMethod
    const privateKeyPath = authMethod === 'key' ? cleanText(input.privateKeyPath, 4096) : null
    if (authMethod === 'key' && !privateKeyPath) {
      throw new Error('Selecciona el archivo de tu clave privada.')
    }

    const data = this.store.read()
    const existing = input.id ? data.profiles.find((item) => item.id === input.id) : undefined
    const now = Date.now()
    const id = existing?.id ?? randomUUID()
    const group = cleanText(input.group, 48) || GROUP_FALLBACK
    const color =
      typeof input.color === 'string' && /^#[0-9a-f]{6}$/iu.test(input.color)
        ? input.color
        : (existing?.color ?? PROFILE_COLORS[0])
    const name = cleanText(input.name, 80) || `${username}@${host}`

    const next: ConnectionProfile = {
      id,
      name,
      host,
      port,
      username,
      authMethod,
      privateKeyPath,
      group,
      color,
      hasPassword: false,
      hasPassphrase: false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastUsedAt: existing?.lastUsedAt ?? null
    }

    const secretPatch: { password?: string | null; passphrase?: string | null } = {}
    if (authMethod === 'password') {
      secretPatch.passphrase = null
      if (!input.rememberSecret) {
        secretPatch.password = null
      } else if (typeof input.password === 'string' && input.password.length > 0) {
        secretPatch.password = input.password
      } else if (!existing || existing.authMethod !== 'password') {
        secretPatch.password = null
      }
    } else if (authMethod === 'key') {
      secretPatch.password = null
      if (!input.rememberSecret) {
        secretPatch.passphrase = null
      } else if (typeof input.passphrase === 'string' && input.passphrase.length > 0) {
        secretPatch.passphrase = input.passphrase
      } else if (!existing || existing.authMethod !== 'key') {
        secretPatch.passphrase = null
      }
    } else {
      secretPatch.password = null
      secretPatch.passphrase = null
    }

    const secretRequested =
      (authMethod === 'password' && Boolean(secretPatch.password)) ||
      (authMethod === 'key' && Boolean(secretPatch.passphrase))
    const saved = await this.vault.set(id, secretPatch)
    if (!saved && secretRequested) {
      throw new Error(
        'No se pudo cifrar el secreto con el llavero del sistema. Desactiva «Recordar secreto» o instala un llavero (libsecret/KWallet).'
      )
    }

    next.hasPassword = this.vault.has(id, 'password')
    next.hasPassphrase = this.vault.has(id, 'passphrase')

    const profiles = existing
      ? data.profiles.map((item) => (item.id === id ? next : item))
      : [...data.profiles, next]
    this.store.write({ version: 1, profiles })

    return { ...next }
  }

  async saveSecret(
    profileId: string,
    kind: 'password' | 'passphrase',
    value: string
  ): Promise<ConnectionProfile> {
    const data = this.store.read()
    const profile = data.profiles.find((item) => item.id === profileId)
    if (!profile) throw new Error('La conexión ya no existe.')
    if (!value) throw new Error('El secreto está vacío.')

    const patch = kind === 'password' ? { password: value } : { passphrase: value }
    const saved = await this.vault.set(profileId, patch)
    if (!saved) {
      throw new Error('No se pudo cifrar el secreto con el llavero del sistema.')
    }

    const next = this.refreshSecrets({ ...profile, updatedAt: Date.now() })
    this.store.write({
      version: 1,
      profiles: data.profiles.map((item) => (item.id === profileId ? next : item))
    })
    return { ...next }
  }

  remove(id: string): void {
    const data = this.store.read()
    const profiles = data.profiles.filter((item) => item.id !== id)
    if (profiles.length === data.profiles.length) return
    this.store.write({ version: 1, profiles })
    this.vault.delete(id)
  }

  touch(id: string): void {
    const data = this.store.read()
    let changed = false
    const profiles = data.profiles.map((profile) => {
      if (profile.id !== id) return profile
      changed = true
      return { ...profile, lastUsedAt: Date.now() }
    })
    if (changed) this.store.write({ version: 1, profiles })
  }
}
