import { Menu, Plus, X } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useStore } from '../store'
import { StatusDot, formatEndpoint } from './ui'

export function TabBar({
  sidebarVisible,
  onShowSidebar
}: {
  sidebarVisible: boolean
  onShowSidebar: () => void
}): ReactNode {
  const tabs = useStore((state) => state.tabs)
  const activeTabId = useStore((state) => state.activeTabId)
  const setActiveTab = useStore((state) => state.setActiveTab)
  const closeTab = useStore((state) => state.closeTab)
  const openDialog = useStore((state) => state.openDialog)

  if (tabs.length === 0) {
    return (
      <div className="tabbar tabbar--empty">
        <div className="tabbar-empty-status">
          {!sidebarVisible ? (
            <button
              type="button"
              className="icon-button"
              onClick={onShowSidebar}
              aria-label="Mostrar conexiones"
              title="Mostrar conexiones"
            >
              <Menu size={17} />
            </button>
          ) : null}
          <span className="tabbar-empty-label">Sin sesiones activas</span>
        </div>
        <button
          type="button"
          className="ghost-button"
          onClick={() => openDialog({ kind: 'connection' })}
        >
          <Plus size={15} />
          Abrir conexión
        </button>
      </div>
    )
  }

  const active = tabs.find((tab) => tab.id === activeTabId)

  return (
    <div className="tabbar">
      {!sidebarVisible ? (
        <button
          type="button"
          className="icon-button tabbar-sidebar-toggle"
          onClick={onShowSidebar}
          aria-label="Mostrar conexiones"
          title="Mostrar conexiones"
        >
          <Menu size={17} />
        </button>
      ) : null}
      <div className="tab-strip" role="tablist" aria-label="Sesiones SSH">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? 'is-active' : ''}`}
            role="tab"
            aria-selected={tab.id === activeTabId}
            style={{ '--tab-color': tab.color } as CSSProperties}
            onAuxClick={(event) => {
              if (event.button === 1) closeTab(tab.id)
            }}
          >
            <button
              type="button"
              className="tab-main"
              onClick={() => setActiveTab(tab.id)}
              title={`${tab.profileName} · ${tab.username}@${formatEndpoint(tab.host, tab.port)}`}
            >
              <StatusDot status={tab.status} />
              <span className="tab-name">{tab.profileName}</span>
            </button>
            <button
              type="button"
              className="tab-close"
              onClick={() => closeTab(tab.id)}
              aria-label={`Cerrar ${tab.profileName}`}
              title="Cerrar sesión"
            >
              <X size={13} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="tab-new"
          onClick={() => openDialog({ kind: 'connection' })}
          aria-label="Nueva conexión"
          title="Nueva conexión"
        >
          <Plus size={16} />
        </button>
      </div>
      {active ? (
        <div className="tabbar-meta">
          <span className="tabbar-endpoint">
            {active.username}@{formatEndpoint(active.host, active.port)}
          </span>
        </div>
      ) : null}
    </div>
  )
}
