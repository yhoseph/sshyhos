import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from 'node:fs'
import { dirname } from 'node:path'

/**
 * Archivo JSON pequeño con escritura atómica y permisos restrictivos.
 * Si el archivo está corrupto se conserva una copia y se usan los valores por defecto.
 */
export class JsonStore<T> {
  constructor(
    readonly file: string,
    private readonly fallback: () => T,
    private readonly parse: (raw: unknown) => T | null
  ) {}

  read(): T {
    try {
      if (!existsSync(this.file)) return this.fallback()
      const raw: unknown = JSON.parse(readFileSync(this.file, 'utf8'))
      const parsed = this.parse(raw)
      if (parsed !== null) return parsed
      this.backupCorrupt()
      return this.fallback()
    } catch {
      this.backupCorrupt()
      return this.fallback()
    }
  }

  write(value: T): void {
    const dir = dirname(this.file)
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600
    })
    renameSync(tmp, this.file)
    if (process.platform !== 'win32') {
      try {
        chmodSync(this.file, 0o600)
      } catch {
        // Los permisos son una defensa extra; no impedimos guardar si fallan.
      }
    }
  }

  private backupCorrupt(): void {
    if (!existsSync(this.file)) return
    try {
      copyFileSync(this.file, `${this.file}.corrupt-${Date.now()}`)
    } catch {
      // Sin copia de seguridad, seguimos con los valores por defecto.
    }
  }
}
