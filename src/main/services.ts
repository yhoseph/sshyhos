import { app } from 'electron'
import { join } from 'node:path'
import type { SshEvent } from '../shared/types'
import { SessionManager } from './ssh/session-manager'
import { HistoryStore } from './storage/history'
import { KnownHostStore } from './storage/known-hosts'
import { ProfileStore } from './storage/profiles'
import { SettingsStore } from './storage/settings'
import { SnippetStore } from './storage/snippets'
import { Vault } from './storage/vault'

export interface Services {
  dataDir: string
  profiles: ProfileStore
  vault: Vault
  settings: SettingsStore
  history: HistoryStore
  snippets: SnippetStore
  knownHosts: KnownHostStore
  sessions: SessionManager
}

export function createServices(emit: (event: SshEvent) => void): Services {
  const dataDir = app.getPath('userData')
  const vault = new Vault(join(dataDir, 'secrets.json'))
  const profiles = new ProfileStore(join(dataDir, 'profiles.json'), vault)
  const settings = new SettingsStore(join(dataDir, 'settings.json'))
  const history = new HistoryStore(join(dataDir, 'history.json'), settings)
  const snippets = new SnippetStore(join(dataDir, 'snippets.json'))
  const knownHosts = new KnownHostStore(join(dataDir, 'known-hosts.json'))
  const sessions = new SessionManager(profiles, vault, knownHosts, emit)

  return {
    dataDir,
    profiles,
    vault,
    settings,
    history,
    snippets,
    knownHosts,
    sessions
  }
}
