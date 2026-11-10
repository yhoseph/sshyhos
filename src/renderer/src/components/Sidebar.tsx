import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  KeyRound,
  Lock,
  PanelLeftClose,
  Pencil,
  Plus,
  Search,
  Settings,
  SquareTerminal,
  Trash
} from 'lucide-react'
import type { ConnectionProfile } from '@shared/types'
import { useStore } from '../store'
import { IconButton, KeyHint, Logo, StatusDot, formatEndpoint } from './ui'

function groupProfiles(profiles: ConnectionProfile[]): Array<[string, ConnectionProfile[]]> {
  const groups = new Map<string, ConnectionProfile[]>()
  for (const profile of profiles) {
    const group = profile.group || 'General'
    const list = groups.get(group) ?? []
    list.push(profile)
    groups.set(group, list)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
    .map(([name, list]) => [
      name,
      list.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
    ])
}

export function Sidebar({ onHide }: { onHide: () => void }): ReactNode {
  const [query, setQuery] = useState('')
  const profiles = useStore((state) => state.profiles)
  const tabs = useStore((state) => state.tabs)
  const appInfo = useStore((state) => state.appInfo)
  const openProfile = useStore((state) => state.openProfile)
  const openDialog = useStore((state) => state.openDialog)
  const removeProfile = useStore((state) => state.removeProfile)
  const addToast = useStore((state) => state.addToast)

  const grouped = useMemo(() => {
    const term = query.trim().toLowerCase()
    const filtered = term
      ? profiles.filter(
          (profile) =>
            profile.name.toLowerCase().includes(term) ||
            profile.host.toLowerCase().includes(term) ||
            profile.username.toLowerCase().includes(term) ||
            profile.group.toLowerCase().includes(term)
        )
      : profiles
    return groupProfiles(filtered)
  }, [profiles, query])

  const tabStatuses = useMemo(() => {
    const map = new Map<string, string>()
    for (const tab of tabs) {
      if (tab.status === 'connected' || tab.status === 'connecting') {
        map.set(tab.profileId, tab.status)
      }
    }
    return map
  }, [tabs])

  const askDelete = async (profile: ConnectionProfile): Promise<void> => {
    const confirmed = await window.api.dialogs.confirm({
      title: 'Eliminar conexión',
      message: `¿Eliminar «${profile.name}»?`,
      detail:
        'Se borrarán también la contraseña y la passphrase cifradas de este equipo. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger: true
    })
    if (!confirmed) return
    try {
      await removeProfile(profile.id)
      addToast('Conexión eliminada.', 'info')
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'No se pudo eliminar.', 'error')
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-heading">
          <div className="brand">
            <Logo size={28} />
            <div>
              <span className="brand-name">SSH Yhos</span>
              <span className="brand-sub">Consola local</span>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onHide}
            aria-label="Ocultar conexiones"
            title="Ocultar conexiones"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>

        <button
          type="button"
          className="primary-button new-connection"
          onClick={() => openDialog({ kind: 'connection' })}
        >
          <Plus size={16} />
          Nueva conexión
          <KeyHint>Ctrl ⇧ N</KeyHint>
        </button>

        <div className="search-box">
          <Search size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar servidor, usuario…"
            aria-label="Buscar conexiones"
            spellCheck={false}
          />
          {query ? (
            <button
              type="button"
              className="search-clear"
              onClick={() => setQuery('')}
              aria-label="Limpiar búsqueda"
            >
              ×
            </button>
          ) : null}
        </div>
      </div>

      <div className="sidebar-list">
        {grouped.length === 0 ? (
          <div className="sidebar-empty">
            {profiles.length === 0 ? (
              <>
                <SquareTerminal size={26} />
                <p>Todavía no hay servidores guardados.</p>
                <span>Crea tu primera conexión y todo quedará en este equipo.</span>
              </>
            ) : (
              <>
                <Search size={22} />
                <p>Sin resultados</p>
                <span>Prueba con otro nombre, host o usuario.</span>
              </>
            )}
          </div>
        ) : (
          grouped.map(([group, list]) => (
            <section className="profile-group" key={group}>
              <div className="group-label">
                <span>{group}</span>
                <span className="group-count">{list.length}</span>
              </div>
              {list.map((profile) => {
                const status = tabStatuses.get(profile.id)
                return (
                  <div
                    key={profile.id}
                    className="profile-item"
                    style={{ '--profile-color': profile.color } as CSSProperties}
                  >
                    <button
                      type="button"
                      className="profile-main"
                      onClick={(event) => openProfile(profile, event.shiftKey)}
                      title={`${profile.username}@${formatEndpoint(profile.host, profile.port)}\nShift+clic para abrir otra sesión`}
                    >
                      <span className="profile-accent" />
                      <span className="profile-glyph">
                        {profile.authMethod === 'key' ? (
                          <KeyRound size={15} />
                        ) : (
                          <SquareTerminal size={15} />
                        )}
                      </span>
                      <span className="profile-copy">
                        <span className="profile-name">{profile.name}</span>
                        <span className="profile-meta">
                          {profile.username}@{formatEndpoint(profile.host, profile.port)}
                        </span>
                      </span>
                      {status ? (
                        <StatusDot status={status} />
                      ) : (
                        <span className="profile-group-tag">{profile.group}</span>
                      )}
                    </button>
                    <div className="profile-actions">
                      <IconButton
                        label={`Editar ${profile.name}`}
                        onClick={() => openDialog({ kind: 'connection', profileId: profile.id })}
                      >
                        <Pencil size={14} />
                      </IconButton>
                      <IconButton
                        label={`Eliminar ${profile.name}`}
                        tone="danger"
                        onClick={() => void askDelete(profile)}
                      >
                        <Trash size={14} />
                      </IconButton>
                    </div>
                  </div>
                )
              })}
            </section>
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <button
          type="button"
          className="footer-button"
          onClick={() => openDialog({ kind: 'settings' })}
        >
          <Settings size={15} />
          Ajustes
        </button>
        <div className="local-note" title="Sin cuentas, sin nube, sin telemetría">
          <Lock size={12} />
          <span>Solo en este equipo</span>
          {appInfo ? <span className="version">v{appInfo.version}</span> : null}
        </div>
      </div>
    </aside>
  )
}
