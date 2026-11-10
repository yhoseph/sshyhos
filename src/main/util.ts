import type { SshErrorCode } from '../shared/types'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** Huella estilo OpenSSH: SHA256:base64 (sin relleno). */
export function toFingerprint(hostKey: Buffer): string {
  return `SHA256:${hostKey.toString('base64').replace(/=+$/u, '')}`
}

export interface FriendlySshError {
  code: SshErrorCode
  message: string
}

export function friendlySshError(error: unknown, host: string, port: number): FriendlySshError {
  const err = error instanceof Error ? error : new Error(String(error))
  const errno = (err as NodeJS.ErrnoException).code
  const raw = err.message || 'Error desconocido'
  const target = `${host}:${port}`

  if (errno === 'ENOTFOUND' || errno === 'EAI_AGAIN') {
    return {
      code: 'NETWORK',
      message: `No se pudo resolver «${host}». Revisa el nombre del servidor o tu DNS.`
    }
  }
  if (errno === 'ECONNREFUSED') {
    return {
      code: 'NETWORK',
      message: `La conexión a ${target} fue rechazada. ¿Está el servidor SSH activo y el puerto es correcto?`
    }
  }
  if (errno === 'ETIMEDOUT' || /timed out|timeout/iu.test(raw)) {
    return {
      code: 'NETWORK',
      message: `Se agotó el tiempo de espera al conectar con ${target}. Revisa la red, el puerto o un cortafuegos.`
    }
  }
  if (errno === 'EHOSTUNREACH' || errno === 'ENETUNREACH') {
    return {
      code: 'NETWORK',
      message: `No hay ruta hasta ${target}. Comprueba que estás en la red correcta o usa una VPN.`
    }
  }
  if (/authentication methods failed|authentication failed|Permission denied/iu.test(raw)) {
    return {
      code: 'AUTH_FAILED',
      message: 'El servidor rechazó las credenciales. Revisa el usuario, la contraseña o la clave.'
    }
  }
  if (/parse (private|openSSH|PPK)|privateKey|unsupported key format|no key/iu.test(raw)) {
    return {
      code: 'KEY_ERROR',
      message: `No se pudo leer la clave privada: ${raw}`
    }
  }
  if (/agent/iu.test(raw)) {
    return {
      code: 'AGENT_ERROR',
      message: `No se pudo usar el agente SSH: ${raw}`
    }
  }
  if (/EACCES|permission denied.*\.ssh|ENOENT/iu.test(raw)) {
    return {
      code: 'KEY_ERROR',
      message: `No se pudo abrir la clave privada. Revisa la ruta y los permisos. (${raw})`
    }
  }
  return {
    code: 'UNKNOWN',
    message: raw
  }
}

export function normalizeHost(host: string): string {
  return host.trim().toLowerCase()
}

export function knownHostId(host: string, port: number): string {
  const clean = normalizeHost(host).replace(/^\[|\]$/gu, '')
  return `${clean}:${port}`
}
