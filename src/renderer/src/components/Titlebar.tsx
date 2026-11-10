import { Lock, Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import { useStore } from '../store'
import { IconButton, Logo } from './ui'

export function Titlebar(): ReactNode {
  const openDialog = useStore((state) => state.openDialog)
  const appInfo = useStore((state) => state.appInfo)

  return (
    <header className="titlebar">
      <div className="titlebar-brand">
        <Logo size={22} />
        <span className="titlebar-name">SSH Yhos</span>
        <span className="local-badge" title="Todo se guarda en este equipo">
          <Lock size={11} />
          local
        </span>
      </div>
      <div className="titlebar-actions">
        {appInfo && appInfo.encryptionAvailable === false ? (
          <span className="titlebar-warning">Llavero no disponible</span>
        ) : null}
        <IconButton label="Ajustes" onClick={() => openDialog({ kind: 'settings' })}>
          <Settings size={16} />
        </IconButton>
      </div>
    </header>
  )
}
