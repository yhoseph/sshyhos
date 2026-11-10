import type { KnownHost } from '../../shared/types'
import { isRecord, knownHostId, normalizeHost } from '../util'
import { JsonStore } from './json-store'

interface KnownHostsFile {
  version: 1
  hosts: Record<string, KnownHost>
}

const emptyFile: KnownHostsFile = { version: 1, hosts: {} }

function parseHost(raw: unknown): KnownHost | null {
  if (!isRecord(raw)) return null
  const host = typeof raw.host === 'string' ? raw.host : ''
  const fingerprint = typeof raw.fingerprint === 'string' ? raw.fingerprint : ''
  const port = typeof raw.port === 'number' ? raw.port : 22
  if (!host || !fingerprint) return null
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : knownHostId(host, port),
    host,
    port,
    fingerprint,
    addedAt: typeof raw.addedAt === 'number' ? raw.addedAt : Date.now()
  }
}

function parseHosts(raw: unknown): KnownHostsFile | null {
  if (!isRecord(raw)) return null
  const hosts: Record<string, KnownHost> = {}
  if (isRecord(raw.hosts)) {
    for (const [id, value] of Object.entries(raw.hosts)) {
      const host = parseHost(value)
      if (host) hosts[id] = host
    }
  }
  return { version: 1, hosts }
}

export class KnownHostStore {
  private readonly store: JsonStore<KnownHostsFile>

  constructor(file: string) {
    this.store = new JsonStore(file, () => emptyFile, parseHosts)
  }

  list(): KnownHost[] {
    return Object.values(this.store.read().hosts).sort((a, b) => a.host.localeCompare(b.host))
  }

  get(host: string, port: number): KnownHost | undefined {
    return this.store.read().hosts[knownHostId(host, port)]
  }

  trust(host: string, port: number, fingerprint: string): KnownHost {
    const data = this.store.read()
    const id = knownHostId(host, port)
    const known: KnownHost = {
      id,
      host: normalizeHost(host),
      port,
      fingerprint,
      addedAt: data.hosts[id]?.addedAt ?? Date.now()
    }
    data.hosts[id] = known
    this.store.write(data)
    return { ...known }
  }

  remove(id: string): void {
    const data = this.store.read()
    if (!data.hosts[id]) return
    delete data.hosts[id]
    this.store.write(data)
  }
}
