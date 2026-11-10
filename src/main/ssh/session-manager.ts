import { readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Client, utils, type ClientChannel, type ConnectConfig } from 'ssh2'
import type {
  ProfileInput,
  SessionConnectInput,
  SshErrorCode,
  SshEvent,
  TestConnectionResult
} from '../../shared/types'
import type { KnownHostStore } from '../storage/known-hosts'
import type { ProfileStore } from '../storage/profiles'
import type { Vault } from '../storage/vault'
import { friendlySshError, toFingerprint, type FriendlySshError } from '../util'

interface ActiveSession {
  id: string
  profileId: string
  client: Client
  stream: ClientChannel | null
  cols: number
  rows: number
  ready: boolean
  closed: boolean
  verification: {
    host: string
    port: number
    fingerprint: string
    reason: 'unknown' | 'mismatch'
    previousFingerprint?: string
  } | null
}

class SetupError extends Error {
  constructor(
    readonly code: SshErrorCode,
    message: string,
    readonly secretKind?: 'password' | 'passphrase',
    readonly reason = ''
  ) {
    super(message)
  }
}

interface PreparedAuth {
  password?: string
  privateKey?: Buffer
  passphrase?: string
  agent?: string
}

function expandHome(path: string): string {
  if (path === '~') return homedir()
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(homedir(), path.slice(2))
  return path
}

function loadPrivateKey(path: string): Buffer {
  const expanded = expandHome(path)
  try {
    const stats = statSync(expanded)
    if (!stats.isFile()) throw new Error('La ruta no es un archivo.')
    if (stats.size > 2 * 1024 * 1024) throw new Error('El archivo de clave es demasiado grande.')
    return readFileSync(expanded)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new SetupError(
      'KEY_ERROR',
      `No se pudo leer la clave privada en «${expanded}». Revisa la ruta y sus permisos. (${message})`
    )
  }
}

function prepareAuth(
  authMethod: string,
  privateKeyPath: string | null | undefined,
  password: string | undefined,
  passphrase: string | undefined
): PreparedAuth {
  if (authMethod === 'password') {
    if (!password) {
      throw new SetupError(
        'NEEDS_SECRET',
        'Esta conexión necesita una contraseña.',
        'password',
        'La contraseña no está guardada en este equipo.'
      )
    }
    return { password }
  }

  if (authMethod === 'key') {
    if (!privateKeyPath) {
      throw new SetupError('KEY_ERROR', 'Esta conexión no tiene una clave privada configurada.')
    }
    const keyData = loadPrivateKey(privateKeyPath)
    const parsed = utils.parseKey(keyData, passphrase)
    if (parsed instanceof Error) {
      if (/no passphrase given/iu.test(parsed.message)) {
        throw new SetupError(
          'NEEDS_SECRET',
          'La clave privada está cifrada y necesita su passphrase.',
          'passphrase',
          'Introduce la passphrase de la clave para continuar.'
        )
      }
      if (/bad passphrase|integrity check|decrypt|incorrect passphrase/iu.test(parsed.message)) {
        throw new SetupError(
          'KEY_ERROR',
          'La passphrase de la clave no es correcta o el archivo está dañado.'
        )
      }
      throw new SetupError('KEY_ERROR', `No se pudo interpretar la clave privada: ${parsed.message}`)
    }
    return { privateKey: keyData, passphrase }
  }

  const agent = process.env.SSH_AUTH_SOCK
    ? process.env.SSH_AUTH_SOCK
    : process.platform === 'win32'
      ? '\\\\.\\pipe\\openssh-ssh-agent'
      : undefined
  if (!agent) {
    throw new SetupError(
      'AGENT_ERROR',
      'No se encontró un agente SSH. Inicia ssh-agent o define SSH_AUTH_SOCK.'
    )
  }
  return { agent }
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

export class SessionManager {
  private readonly sessions = new Map<string, ActiveSession>()

  constructor(
    private readonly profiles: ProfileStore,
    private readonly vault: Vault,
    private readonly knownHosts: KnownHostStore,
    private readonly emit: (event: SshEvent) => void
  ) {}

  async connect(input: SessionConnectInput): Promise<void> {
    try {
      await this.start(input)
    } catch (error) {
      if (error instanceof SetupError) {
        if (error.code === 'NEEDS_SECRET' && error.secretKind) {
          this.emit({
            type: 'needs-secret',
            sessionId: input.sessionId,
            kind: error.secretKind,
            reason: error.reason || error.message
          })
        } else {
          this.emit({
            type: 'error',
            sessionId: input.sessionId,
            code: error.code,
            message: error.message
          })
        }
        return
      }
      const friendly = friendlySshError(error, 'el servidor', 22)
      this.emit({
        type: 'error',
        sessionId: input.sessionId,
        code: friendly.code,
        message: friendly.message
      })
    }
  }

  private async start(input: SessionConnectInput): Promise<void> {
    const sessionId = typeof input.sessionId === 'string' ? input.sessionId.slice(0, 100) : ''
    if (!sessionId) throw new SetupError('UNKNOWN', 'Sesión no válida.')

    const profile = this.profiles.get(input.profileId)
    if (!profile) {
      this.emit({
        type: 'error',
        sessionId,
        code: 'PROFILE_NOT_FOUND',
        message: 'La conexión ya no existe. Ciérrala y vuelve a crearla.'
      })
      return
    }

    this.disconnect(sessionId)
    this.emit({ type: 'status', sessionId, status: 'connecting' })

    const stored = await this.vault.get(profile.id)
    const password = input.password ?? stored.password
    const passphrase = input.passphrase ?? stored.passphrase
    const auth = prepareAuth(profile.authMethod, profile.privateKeyPath, password, passphrase)

    const cols = clamp(input.cols, 2, 1000, 80)
    const rows = clamp(input.rows, 2, 500, 24)
    const known = this.knownHosts.get(profile.host, profile.port)

    const client = new Client()
    const session: ActiveSession = {
      id: sessionId,
      profileId: profile.id,
      client,
      stream: null,
      cols,
      rows,
      ready: false,
      closed: false,
      verification: null
    }
    this.sessions.set(sessionId, session)

    const config: ConnectConfig = {
      host: profile.host,
      port: profile.port,
      username: profile.username,
      readyTimeout: 20000,
      keepaliveInterval: 15000,
      keepaliveCountMax: 4,
      tryKeyboard: true,
      hostVerifier: (key: Buffer) => {
        const fingerprint = toFingerprint(key)
        if (!known) {
          session.verification = {
            host: profile.host,
            port: profile.port,
            fingerprint,
            reason: 'unknown'
          }
          return false
        }
        if (known.fingerprint !== fingerprint) {
          session.verification = {
            host: profile.host,
            port: profile.port,
            fingerprint,
            reason: 'mismatch',
            previousFingerprint: known.fingerprint
          }
          return false
        }
        return true
      }
    }

    if (auth.password) config.password = auth.password
    if (auth.privateKey) {
      config.privateKey = auth.privateKey
      if (auth.passphrase) config.passphrase = auth.passphrase
    }
    if (auth.agent) config.agent = auth.agent

    client.on('banner', (message: string) => {
      if (session.closed) return
      this.emit({
        type: 'data',
        sessionId,
        data: new Uint8Array(Buffer.from(`${message.replace(/\r?\n/gu, '\r\n')}\r\n`, 'utf8'))
      })
    })

    client.on('keyboard-interactive', (_name, _instructions, _lang, prompts, finish) => {
      if (auth.password) {
        finish(prompts.map(() => auth.password ?? ''))
      } else {
        finish([])
      }
    })

    client.on('ready', () => {
      if (session.closed) return
      session.ready = true
      this.profiles.touch(profile.id)
      this.emit({ type: 'status', sessionId, status: 'connected' })

      client.shell({ term: 'xterm-256color', cols, rows }, (error, stream) => {
        if (error) {
          this.fail(session, {
            code: 'UNKNOWN',
            message: `La autenticación funcionó, pero no se pudo abrir la shell: ${error.message}`
          })
          return
        }
        session.stream = stream
        stream.on('data', (chunk: Buffer) => {
          if (session.closed) return
          this.emit({ type: 'data', sessionId, data: new Uint8Array(chunk) })
        })
        stream.stderr.on('data', (chunk: Buffer) => {
          if (session.closed) return
          this.emit({ type: 'data', sessionId, data: new Uint8Array(chunk) })
        })
        stream.on('close', () => {
          if (session.closed) return
          this.closeSession(session, 'La sesión SSH se cerró.')
        })
      })
    })

    client.on('error', (error: Error) => {
      if (session.closed) return
      session.closed = true
      this.sessions.delete(sessionId)
      if (session.verification) {
        this.emit({ type: 'host-verification', sessionId, ...session.verification })
        this.safeEnd(session)
        return
      }
      const friendly: FriendlySshError = friendlySshError(error, profile.host, profile.port)
      this.emit({
        type: 'error',
        sessionId,
        code: friendly.code,
        message: friendly.message
      })
      this.safeEnd(session)
    })

    client.on('close', () => {
      if (session.closed) return
      if (!session.ready) {
        session.closed = true
        this.sessions.delete(sessionId)
        this.emit({
          type: 'error',
          sessionId,
          code: 'NETWORK',
          message: `La conexión con ${profile.host}:${profile.port} se cerró antes de completar el inicio de sesión.`
        })
        return
      }
      this.closeSession(session, 'Conexión finalizada.')
    })

    client.connect(config)
  }

  private fail(session: ActiveSession, error: FriendlySshError): void {
    if (session.closed) return
    session.closed = true
    this.sessions.delete(session.id)
    this.emit({
      type: 'error',
      sessionId: session.id,
      code: error.code,
      message: error.message
    })
    this.safeEnd(session)
  }

  private closeSession(session: ActiveSession, message: string): void {
    if (session.closed) return
    session.closed = true
    this.sessions.delete(session.id)
    this.emit({ type: 'status', sessionId: session.id, status: 'closed', message })
    this.safeEnd(session)
  }

  private safeEnd(session: ActiveSession): void {
    try {
      session.stream?.end()
    } catch {
      // Ignorado: la conexión ya estaba cerrada.
    }
    try {
      session.client.end()
    } catch {
      // Ignorado: la conexión ya estaba cerrada.
    }
  }

  write(sessionId: string, data: string): void {
    if (typeof data !== 'string' || data.length === 0 || data.length > 1024 * 1024) return
    const session = this.sessions.get(sessionId)
    session?.stream?.write(data)
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.cols = clamp(cols, 2, 1000, 80)
    session.rows = clamp(rows, 2, 500, 24)
    try {
      session.stream?.setWindow(session.rows, session.cols, 0, 0)
    } catch {
      // El canal puede no estar listo todavía.
    }
  }

  disconnect(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.closed = true
    this.sessions.delete(sessionId)
    this.safeEnd(session)
  }

  disconnectAll(): void {
    for (const id of [...this.sessions.keys()]) this.disconnect(id)
  }

  disconnectProfile(profileId: string): void {
    for (const [id, session] of this.sessions) {
      if (session.profileId === profileId) this.disconnect(id)
    }
  }

  async test(input: ProfileInput): Promise<TestConnectionResult> {
    const host = typeof input.host === 'string' ? input.host.trim() : ''
    const username = typeof input.username === 'string' ? input.username.trim() : ''
    const port = clamp(Number(input.port), 1, 65535, 22)
    if (!host || !username) {
      return { ok: false, code: 'UNKNOWN', message: 'Completa el host y el usuario para probar.' }
    }

    let password = input.password
    let passphrase = input.passphrase
    if (input.id) {
      const stored = await this.vault.get(input.id)
      password = password || stored.password
      passphrase = passphrase || stored.passphrase
    }

    let auth: PreparedAuth
    try {
      auth = prepareAuth(input.authMethod, input.privateKeyPath, password, passphrase)
    } catch (error) {
      if (error instanceof SetupError) {
        return { ok: false, code: error.code, message: error.message }
      }
      return { ok: false, code: 'UNKNOWN', message: 'No se pudo preparar la autenticación.' }
    }

    return new Promise<TestConnectionResult>((resolve) => {
      const client = new Client()
      let settled = false
      let fingerprint = ''

      const finish = (result: TestConnectionResult): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        try {
          client.end()
        } catch {
          // Ignorado.
        }
        resolve(result)
      }

      const timer = setTimeout(() => {
        finish({
          ok: false,
          code: 'NETWORK',
          message: `Se agotó el tiempo de espera al conectar con ${host}:${port}.`
        })
      }, 22000)

      const config: ConnectConfig = {
        host,
        port,
        username,
        readyTimeout: 20000,
        tryKeyboard: true,
        hostVerifier: (key: Buffer) => {
          fingerprint = toFingerprint(key)
          return true
        }
      }
      if (auth.password) config.password = auth.password
      if (auth.privateKey) {
        config.privateKey = auth.privateKey
        if (auth.passphrase) config.passphrase = auth.passphrase
      }
      if (auth.agent) config.agent = auth.agent

      client.on('keyboard-interactive', (_name, _instructions, _lang, prompts, done) => {
        done(auth.password ? prompts.map(() => auth.password ?? '') : [])
      })

      client.on('ready', () => {
        finish({
          ok: true,
          fingerprint,
          message: `Conexión y autenticación correctas con ${username}@${host}:${port}.`
        })
      })

      client.on('error', (error: Error) => {
        const friendly = friendlySshError(error, host, port)
        finish({ ok: false, code: friendly.code, message: friendly.message })
      })

      client.on('close', () => {
        finish({
          ok: false,
          code: 'NETWORK',
          message: `La conexión con ${host}:${port} se cerró antes de completar la prueba.`
        })
      })

      try {
        client.connect(config)
      } catch (error) {
        const friendly = friendlySshError(error, host, port)
        finish({ ok: false, code: friendly.code, message: friendly.message })
      }
    })
  }
}
