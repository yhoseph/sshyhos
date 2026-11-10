import { useEffect, useState, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { useResolvedTheme } from './lib/theme'
import { useStore } from './store'
import { ConnectionDialog } from './components/ConnectionDialog'
import { HostKeyDialog } from './components/HostKeyDialog'
import { SecretDialog } from './components/SecretDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { Sidebar } from './components/Sidebar'
import { TabBar } from './components/TabBar'
import { TerminalView } from './components/TerminalView'
import { Titlebar } from './components/Titlebar'
import { Toasts } from './components/Toasts'
import { Logo } from './components/ui'
import { Welcome } from './components/Welcome'

function BootScreen({
  error,
  onRetry
}: {
  error?: string | null
  onRetry?: () => void
}): ReactNode {
  return (
    <div className="boot-screen">
      <div className="boot-card">
        <Logo size={56} />
        <h1>{error ? 'No se pudo iniciar' : 'Preparando tu consola local'}</h1>
        <p>
          {error ??
            'Cargando perfiles, ajustes y huellas desde este equipo. Nada sale de aquí.'}
        </p>
        {error ? (
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              onRetry?.()
            }}
          >
            <RefreshCw size={14} />
            Reintentar
          </button>
        ) : (
          <div className="boot-pulse" aria-hidden="true" />
        )}
      </div>
    </div>
  )
}

export function App(): ReactNode {
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const ready = useStore((state) => state.ready)
  const fatalError = useStore((state) => state.fatalError)
  const tabs = useStore((state) => state.tabs)
  const activeTabId = useStore((state) => state.activeTabId)
  const dialog = useStore((state) => state.dialog)
  const bootstrap = useStore((state) => state.bootstrap)
  const handleEvent = useStore((state) => state.handleEvent)
  const setActiveTab = useStore((state) => state.setActiveTab)
  const resolvedTheme = useResolvedTheme()

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null
  const promptTab =
    tabs.find((tab) => tab.hostPrompt || tab.secretPrompt) ?? null

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(() => window.api.ssh.onEvent(handleEvent), [handleEvent])

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  useEffect(() => {
    return window.api.app.onMenuAction((action) => {
      const state = useStore.getState()
      if (action === 'new-connection') {
        state.openDialog({ kind: 'connection' })
        return
      }
      if (action === 'settings') {
        state.openDialog({ kind: 'settings' })
        return
      }
      if (action === 'close-tab') {
        if (state.activeTabId) state.closeTab(state.activeTabId)
        return
      }
      if (action === 'next-tab' || action === 'prev-tab') {
        if (state.tabs.length < 2) return
        const index = state.tabs.findIndex((tab) => tab.id === state.activeTabId)
        const delta = action === 'next-tab' ? 1 : -1
        const next = state.tabs[(index + delta + state.tabs.length) % state.tabs.length]
        if (next) state.setActiveTab(next.id)
      }
    })
  }, [])

  // Si una conexión en segundo plano pide una contraseña o verificar una huella,
  // traemos su pestaña al frente para que el diálogo quede visible.
  useEffect(() => {
    if (promptTab && promptTab.id !== activeTabId) {
      setActiveTab(promptTab.id)
    }
  }, [promptTab, activeTabId, setActiveTab])

  if (!ready) {
    return (
      <div className="app">
        <Titlebar />
        <BootScreen onRetry={() => void bootstrap()} />
      </div>
    )
  }

  if (fatalError) {
    return (
      <div className="app">
        <Titlebar />
        <BootScreen error={fatalError} onRetry={() => void bootstrap()} />
        <Toasts />
      </div>
    )
  }

  return (
    <div className="app">
      <Titlebar />
      <div className="app-body">
        {sidebarVisible ? <Sidebar onHide={() => setSidebarVisible(false)} /> : null}
        <main className="workspace">
          <TabBar
            sidebarVisible={sidebarVisible}
            onShowSidebar={() => setSidebarVisible(true)}
          />
          <div className="workspace-content">
            {tabs.length === 0 ? (
              <Welcome />
            ) : (
              tabs.map((tab) => (
                <div
                  className={`terminal-pane ${tab.id === activeTabId ? 'is-active' : ''}`}
                  key={tab.id}
                  aria-hidden={tab.id !== activeTabId}
                >
                  <TerminalView tab={tab} isActive={tab.id === activeTabId} />
                </div>
              ))
            )}
          </div>
        </main>
      </div>

      <Toasts />

      {dialog?.kind === 'connection' ? (
        <ConnectionDialog
          key={dialog.profileId ?? 'new-connection'}
          profileId={dialog.profileId}
        />
      ) : null}
      {dialog?.kind === 'settings' ? (
        <SettingsDialog key={dialog.section ?? 'settings'} section={dialog.section} />
      ) : null}

      {promptTab?.hostPrompt ? <HostKeyDialog tab={promptTab} /> : null}
      {promptTab?.secretPrompt ? <SecretDialog tab={promptTab} /> : null}

      {activeTab?.status === 'connecting' && !promptTab ? (
        <div className="sr-only" role="status">
          Conectando con {activeTab.profileName}
        </div>
      ) : null}

      <GlobalShortcuts />
    </div>
  )
}

/**
 * Accesos globales que no dependen de que la terminal tenga el foco.
 * La paleta de sugerencias se abre desde cada pestaña con Ctrl+Espacio.
 */
function GlobalShortcuts(): null {
  const openDialog = useStore((state) => state.openDialog)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return
      const mod = event.ctrlKey || event.metaKey
      if (mod && event.shiftKey && event.code === 'KeyN') {
        event.preventDefault()
        openDialog({ kind: 'connection' })
        return
      }
      if (mod && event.code === 'Comma') {
        event.preventDefault()
        openDialog({ kind: 'settings' })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openDialog])

  return null
}
