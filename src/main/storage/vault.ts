import { safeStorage } from 'electron'
import { JsonStore } from './json-store'
import { isRecord } from '../util'

interface StoredSecret {
  password?: string
  passphrase?: string
}

interface VaultFile {
  version: 1
  secrets: Record<string, StoredSecret>
}

export interface SecretBundle {
  password?: string
  passphrase?: string
}

const emptyFile: VaultFile = { version: 1, secrets: {} }

function parseVault(raw: unknown): VaultFile | null {
  if (!isRecord(raw) || !isRecord(raw.secrets)) return null
  const secrets: Record<string, StoredSecret> = {}
  for (const [id, value] of Object.entries(raw.secrets)) {
    if (!isRecord(value)) continue
    const record: StoredSecret = {}
    if (typeof value.password === 'string') record.password = value.password
    if (typeof value.passphrase === 'string') record.passphrase = value.passphrase
    if (record.password || record.passphrase) secrets[id] = record
  }
  return { version: 1, secrets }
}

/**
 * Guarda secretos cifrados con el almacén del sistema operativo:
 * DPAPI en Windows, Keychain en macOS y libsecret/KWallet en Linux.
 * Nada se envía fuera del equipo.
 */
export class Vault {
  private readonly store: JsonStore<VaultFile>
  private cache: VaultFile | null = null

  constructor(file: string) {
    this.store = new JsonStore(file, () => emptyFile, parseVault)
  }

  private load(): VaultFile {
    if (!this.cache) this.cache = this.store.read()
    return this.cache
  }

  private persist(): void {
    if (!this.cache) return
    this.store.write(this.cache)
  }

  async isAvailable(): Promise<boolean> {
    try {
      return await safeStorage.isAsyncEncryptionAvailable()
    } catch {
      return false
    }
  }

  backend(): string {
    if (process.platform === 'linux') {
      try {
        return safeStorage.getSelectedStorageBackend()
      } catch {
        return 'unknown'
      }
    }
    if (process.platform === 'darwin') return 'keychain'
    if (process.platform === 'win32') return 'dpapi'
    return 'unknown'
  }

  has(profileId: string, field: 'password' | 'passphrase'): boolean {
    const record = this.load().secrets[profileId]
    return Boolean(record?.[field])
  }

  async get(profileId: string): Promise<SecretBundle> {
    const record = this.load().secrets[profileId]
    if (!record) return {}
    if (!(await this.isAvailable())) return {}

    const bundle: SecretBundle = {}
    for (const field of ['password', 'passphrase'] as const) {
      const cipher = record[field]
      if (!cipher) continue
      try {
        const decrypted = await safeStorage.decryptStringAsync(Buffer.from(cipher, 'base64'))
        bundle[field] = decrypted.result
      } catch {
        // Si el llavero cambió o el dato está dañado, se ignora y se pedirá de nuevo.
      }
    }
    return bundle
  }

  /**
   * undefined conserva el valor actual, null lo elimina y string lo reemplaza.
   */
  async set(
    profileId: string,
    patch: { password?: string | null; passphrase?: string | null }
  ): Promise<boolean> {
    if (!(await this.isAvailable())) return false

    const file = this.load()
    const record: StoredSecret = { ...file.secrets[profileId] }

    for (const field of ['password', 'passphrase'] as const) {
      const value = patch[field]
      if (value === undefined) continue
      if (value === null || value === '') {
        delete record[field]
        continue
      }
      try {
        const encrypted = await safeStorage.encryptStringAsync(value)
        record[field] = encrypted.toString('base64')
      } catch {
        return false
      }
    }

    if (record.password || record.passphrase) {
      file.secrets[profileId] = record
    } else {
      delete file.secrets[profileId]
    }
    this.persist()
    return true
  }

  delete(profileId: string): void {
    const file = this.load()
    if (!file.secrets[profileId]) return
    delete file.secrets[profileId]
    this.persist()
  }
}
