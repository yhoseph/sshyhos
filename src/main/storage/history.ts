import type { HistoryEntry, HistoryResult } from '../../shared/types'
import { isRecord } from '../util'
import { JsonStore } from './json-store'
import type { SettingsStore } from './settings'

interface HistoryFile {
  version: 1
  global: HistoryEntry[]
  byProfile: Record<string, HistoryEntry[]>
}

const emptyFile = (): HistoryFile => ({ version: 1, global: [], byProfile: {} })

function parseEntry(raw: unknown): HistoryEntry | null {
  if (!isRecord(raw)) return null
  const command = typeof raw.command === 'string' ? raw.command : ''
  if (!command) return null
  return {
    command,
    count: typeof raw.count === 'number' && raw.count > 0 ? Math.round(raw.count) : 1,
    lastUsedAt: typeof raw.lastUsedAt === 'number' ? raw.lastUsedAt : 0
  }
}

function parseList(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return []
  const list: HistoryEntry[] = []
  for (const item of raw) {
    const entry = parseEntry(item)
    if (entry) list.push(entry)
  }
  return list
}

function parseHistory(raw: unknown): HistoryFile | null {
  if (!isRecord(raw)) return null
  const byProfile: Record<string, HistoryEntry[]> = {}
  if (isRecord(raw.byProfile)) {
    for (const [profileId, list] of Object.entries(raw.byProfile)) {
      byProfile[profileId] = parseList(list)
    }
  }
  return { version: 1, global: parseList(raw.global), byProfile }
}

const byRecency = (a: HistoryEntry, b: HistoryEntry): number => b.lastUsedAt - a.lastUsedAt

function addTo(entries: HistoryEntry[], command: string, limit: number): HistoryEntry[] {
  const now = Date.now()
  const existing = entries.find((entry) => entry.command === command)
  let next: HistoryEntry[]
  if (existing) {
    next = entries.map((entry) =>
      entry.command === command ? { ...entry, count: entry.count + 1, lastUsedAt: now } : entry
    )
  } else {
    next = [{ command, count: 1, lastUsedAt: now }, ...entries]
  }
  return next.sort(byRecency).slice(0, limit)
}

export class HistoryStore {
  private readonly store: JsonStore<HistoryFile>

  constructor(
    file: string,
    private readonly settings: SettingsStore
  ) {
    this.store = new JsonStore(file, emptyFile, parseHistory)
  }

  list(profileId: string): HistoryResult {
    const data = this.store.read()
    return {
      profile: [...(data.byProfile[profileId] ?? [])].sort(byRecency),
      global: [...data.global].sort(byRecency)
    }
  }

  add(profileId: string, rawCommand: string): void {
    if (!this.settings.get().saveHistory) return
    const command = rawCommand.trim()
    if (!command || command.startsWith(' ') || command.length > 2000) return
    if (command.includes('\n') || command.includes('\r')) return

    const data = this.store.read()
    const limit = this.settings.get().historyLimit
    data.byProfile[profileId] = addTo(data.byProfile[profileId] ?? [], command, limit)
    data.global = addTo(data.global, command, limit * 2)
    this.store.write(data)
  }

  clear(profileId?: string): void {
    const data = this.store.read()
    if (profileId) {
      delete data.byProfile[profileId]
      this.store.write(data)
      return
    }
    this.store.write(emptyFile())
  }
}
