import type { ReactNode } from 'react'
import { Check, Copy, ShieldAlert, ShieldCheck } from 'lucide-react'
import type { TerminalTab } from '../store'
import { useStore } from '../store'
import { Modal, formatEndpoint } from './ui'

export function HostKeyDialog({ tab }: { tab: TerminalTab }): ReactNode {
  const prompt = tab.hostPrompt
  const trustHost = useStore((state) => state.trustHost)
  const declineHost = useStore((state) => state.declineHost)
  const addToast = useStore((state) => state.addToast)

  if (!prompt) return null

  const mismatch = prompt.reason === 'mismatch'

  const copyFingerprint = async (): Promise<void> => {
    try {
      await window.api.clipboard.writeText(prompt.fingerprint)
      addToast('Huella copiada.', 'success')
    } catch {
      addToast('No se pudo acceder al portapapeles.', 'error')
    }
  }

  return (
    <Modal
      title={mismatch ? 'La huella del servidor cambió' : 'Servidor nuevo'}
      subtitle={`${prompt.host}:${prompt.port} · ${tab.username}`}
      icon={mismatch ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
      onClose={() => declineHost(tab.id)}
      width={540}
      footer={
        <>
          <span className="footer-hint">
            {mismatch ? 'Verifica con el administrador antes de continuar.' : 'Se recordará en este equipo.'}
          </span>
          <div className="footer-actions">
            <button type="button" className="ghost-button" onClick={() => declineHost(tab.id)}>
              Cancelar
            </button>
            <button
              type="button"
              className={mismatch ? 'danger-button' : 'primary-button'}
              onClick={() => void trustHost(tab.id)}
            >
              <Check size={15} />
              {mismatch ? 'Confiar de todos modos' : 'Confiar y conectar'}
            </button>
          </div>
        </>
      }
    >
      <div className={`hostkey-box ${mismatch ? 'is-danger' : ''}`}>
        <p>
          {mismatch
            ? 'La clave pública que presenta este servidor no coincide con la que guardaste. Podría ser una reinstalación legítima… o un ataque de intermediario.'
            : 'Es la primera vez que conectas a este servidor. Comprueba que la huella coincide con la que muestra el administrador.'}
        </p>

        <div className="fingerprint-block">
          <span className="fingerprint-label">Huella SHA-256</span>
          <code>{prompt.fingerprint}</code>
          <button
            type="button"
            className="ghost-button small"
            onClick={() => void copyFingerprint()}
          >
            <Copy size={13} />
            Copiar
          </button>
        </div>

        {mismatch && prompt.previousFingerprint ? (
          <div className="fingerprint-block previous">
            <span className="fingerprint-label">Huella guardada anteriormente</span>
            <code>{prompt.previousFingerprint}</code>
          </div>
        ) : null}

        <p className="hostkey-endpoint">
          Destino: <strong>{tab.username}@{formatEndpoint(prompt.host, prompt.port)}</strong>
        </p>
      </div>
    </Modal>
  )
}
