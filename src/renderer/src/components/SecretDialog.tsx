import { useState, type FormEvent, type ReactNode } from 'react'
import { Eye, EyeOff, KeyRound, Lock } from 'lucide-react'
import type { TerminalTab } from '../store'
import { useStore } from '../store'
import { Field, IconButton, Modal, Toggle, formatEndpoint } from './ui'

export function SecretDialog({ tab }: { tab: TerminalTab }): ReactNode {
  const prompt = tab.secretPrompt
  const appInfo = useStore((state) => state.appInfo)
  const provideSecret = useStore((state) => state.provideSecret)
  const cancelSecret = useStore((state) => state.cancelSecret)
  const [value, setValue] = useState('')
  const [visible, setVisible] = useState(false)
  const [remember, setRemember] = useState(appInfo?.encryptionAvailable !== false)
  const [error, setError] = useState<string | null>(null)

  if (!prompt) return null

  const isPassword = prompt.kind === 'password'
  const encryptionOff = appInfo?.encryptionAvailable === false

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!value) {
      setError(isPassword ? 'Escribe la contraseña.' : 'Escribe la passphrase.')
      return
    }
    setError(null)
    await provideSecret(tab.id, value, remember)
  }

  return (
    <Modal
      title={isPassword ? 'Contraseña necesaria' : 'Passphrase de la clave'}
      subtitle={`${tab.username}@${formatEndpoint(tab.host, tab.port)}`}
      icon={isPassword ? <KeyRound size={20} /> : <Lock size={20} />}
      onClose={() => cancelSecret(tab.id)}
      width={470}
      footer={
        <>
          <span className="footer-hint">
            <Lock size={13} /> Se usa solo para esta conexión.
          </span>
          <div className="footer-actions">
            <button type="button" className="ghost-button" onClick={() => cancelSecret(tab.id)}>
              Cancelar
            </button>
            <button type="submit" form="secret-form" className="primary-button">
              Conectar
            </button>
          </div>
        </>
      }
    >
      <form id="secret-form" onSubmit={(event) => void submit(event)} className="form-stack">
        <p className="dialog-text">{prompt.reason}</p>
        <Field
          label={isPassword ? 'Contraseña SSH' : 'Passphrase'}
          htmlFor="secret-value"
          error={error ?? undefined}
          hint="No se muestra en pantalla ni se envía a otro sitio."
        >
          <div className="input-with-action">
            <input
              id="secret-value"
              type={visible ? 'text' : 'password'}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoFocus
              autoComplete="current-password"
              placeholder={isPassword ? 'Contraseña' : 'Passphrase'}
            />
            <IconButton
              label={visible ? 'Ocultar' : 'Mostrar'}
              onClick={() => setVisible((current) => !current)}
            >
              {visible ? <EyeOff size={15} /> : <Eye size={15} />}
            </IconButton>
          </div>
        </Field>
        <Toggle
          checked={remember}
          onChange={setRemember}
          label="Guardar cifrado en este equipo"
          hint={
            encryptionOff
              ? 'El llavero del sistema no está disponible.'
              : 'Podrás reconectar sin volver a escribirlo.'
          }
          disabled={encryptionOff}
        />
      </form>
    </Modal>
  )
}
