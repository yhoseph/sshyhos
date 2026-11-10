import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  CircleAlert,
  CircleCheck,
  Cpu,
  Eye,
  EyeOff,
  FileKey,
  FolderOpen,
  KeyRound,
  Lock,
  Server,
  ShieldCheck
} from 'lucide-react'
import { PROFILE_COLORS } from '@shared/colors'
import type { AuthMethod, TestConnectionResult } from '@shared/types'
import { useStore } from '../store'
import { Field, IconButton, Modal, Toggle } from './ui'

const AUTH_OPTIONS: Array<{ value: AuthMethod; label: string; icon: ReactNode }> = [
  { value: 'password', label: 'Contraseña', icon: <KeyRound size={15} /> },
  { value: 'key', label: 'Clave privada', icon: <FileKey size={15} /> },
  { value: 'agent', label: 'Agente SSH', icon: <Cpu size={15} /> }
]

export function ConnectionDialog({ profileId }: { profileId?: string }): ReactNode {
  const profiles = useStore((state) => state.profiles)
  const appInfo = useStore((state) => state.appInfo)
  const saveProfile = useStore((state) => state.saveProfile)
  const openProfile = useStore((state) => state.openProfile)
  const closeDialog = useStore((state) => state.closeDialog)
  const addToast = useStore((state) => state.addToast)

  const existing = useMemo(
    () => profiles.find((profile) => profile.id === profileId),
    [profiles, profileId]
  )

  const [name, setName] = useState(existing?.name ?? '')
  const [group, setGroup] = useState(existing?.group ?? 'General')
  const [color, setColor] = useState(existing?.color ?? PROFILE_COLORS[0])
  const [host, setHost] = useState(existing?.host ?? '')
  const [port, setPort] = useState(String(existing?.port ?? 22))
  const [username, setUsername] = useState(existing?.username ?? '')
  const [authMethod, setAuthMethod] = useState<AuthMethod>(existing?.authMethod ?? 'password')
  const [privateKeyPath, setPrivateKeyPath] = useState(existing?.privateKeyPath ?? '')
  const [password, setPassword] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [remember, setRemember] = useState(appInfo?.encryptionAvailable !== false)
  const [showPassword, setShowPassword] = useState(false)
  const [showPassphrase, setShowPassphrase] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null)

  useEffect(() => {
    setTestResult(null)
    setError(null)
  }, [host, port, username, authMethod, password, passphrase, privateKeyPath])

  const groups = useMemo(
    () => [...new Set(profiles.map((profile) => profile.group).filter(Boolean))].sort(),
    [profiles]
  )

  const buildInput = (): Parameters<typeof saveProfile>[0] => ({
    id: existing?.id,
    name,
    host,
    port: Number(port),
    username,
    authMethod,
    privateKeyPath: authMethod === 'key' ? privateKeyPath : null,
    group,
    color,
    password: password || undefined,
    passphrase: passphrase || undefined,
    rememberSecret: remember && appInfo?.encryptionAvailable !== false
  })

  const browseKey = async (): Promise<void> => {
    const path = await window.api.dialogs.pickPrivateKey()
    if (path) setPrivateKeyPath(path)
  }

  const runTest = async (): Promise<void> => {
    setTesting(true)
    setTestResult(null)
    setError(null)
    try {
      const result = await window.api.ssh.test(buildInput())
      setTestResult(result)
    } catch (err) {
      setTestResult({
        ok: false,
        code: 'UNKNOWN',
        message: err instanceof Error ? err.message : 'No se pudo probar la conexión.'
      })
    } finally {
      setTesting(false)
    }
  }

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const saved = await saveProfile(buildInput())
      addToast(existing ? 'Conexión actualizada.' : 'Conexión guardada.', 'success')
      closeDialog()
      openProfile(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la conexión.')
    } finally {
      setSaving(false)
    }
  }

  const encryptionOff = appInfo?.encryptionAvailable === false

  return (
    <Modal
      title={existing ? 'Editar conexión' : 'Nueva conexión'}
      subtitle={
        existing
          ? `Los secretos se guardan cifrados en este equipo.`
          : 'Configura el servidor y guarda las credenciales de forma local.'
      }
      icon={<Server size={20} />}
      onClose={closeDialog}
      width={700}
      footer={
        <>
          <div className="footer-status">
            {testResult ? (
              <span className={`inline-result ${testResult.ok ? 'ok' : 'bad'}`}>
                {testResult.ok ? <CircleCheck size={15} /> : <CircleAlert size={15} />}
                <span>
                  {testResult.message}
                  {testResult.ok ? (
                    <em className="fingerprint-inline">{testResult.fingerprint}</em>
                  ) : null}
                </span>
              </span>
            ) : (
              <span className="footer-hint">
                <Lock size={13} /> Nada se envía fuera de este equipo.
              </span>
            )}
          </div>
          <div className="footer-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => void runTest()}
              disabled={testing || saving}
            >
              {testing ? 'Probando…' : 'Probar'}
            </button>
            <button type="button" className="ghost-button" onClick={closeDialog}>
              Cancelar
            </button>
            <button
              type="submit"
              form="connection-form"
              className="primary-button"
              disabled={saving}
            >
              {saving ? 'Guardando…' : 'Guardar y conectar'}
            </button>
          </div>
        </>
      }
    >
      <form id="connection-form" onSubmit={(event) => void submit(event)} className="form-stack">
        {error ? (
          <div className="form-error">
            <CircleAlert size={15} />
            {error}
          </div>
        ) : null}

        <section className="form-section">
          <div className="form-section-title">Identidad</div>
          <div className="form-grid two">
            <Field label="Nombre" htmlFor="conn-name" hint="Solo para ti, por ejemplo «Producción».">
              <input
                id="conn-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Mi servidor"
                autoFocus
                maxLength={80}
              />
            </Field>
            <Field label="Grupo" htmlFor="conn-group" hint="Agrupa tus servidores en la barra lateral.">
              <input
                id="conn-group"
                value={group}
                onChange={(event) => setGroup(event.target.value)}
                placeholder="General"
                list="connection-groups"
                maxLength={48}
              />
              <datalist id="connection-groups">
                {groups.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </Field>
          </div>
          <div className="color-row">
            <span className="field-label">Color</span>
            <div className="swatches">
              {PROFILE_COLORS.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  className={`swatch ${swatch === color ? 'is-selected' : ''}`}
                  style={{ background: swatch }}
                  onClick={() => setColor(swatch)}
                  aria-label={`Color ${swatch}`}
                  title={swatch}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-title">Servidor</div>
          <div className="form-grid host-grid">
            <Field label="Host o IP" htmlFor="conn-host">
              <input
                id="conn-host"
                value={host}
                onChange={(event) => setHost(event.target.value)}
                placeholder="192.168.1.10 o servidor.ejemplo.com"
                spellCheck={false}
                autoComplete="off"
                required
              />
            </Field>
            <Field label="Puerto" htmlFor="conn-port">
              <input
                id="conn-port"
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(event) => setPort(event.target.value)}
                required
              />
            </Field>
            <Field label="Usuario" htmlFor="conn-user">
              <input
                id="conn-user"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="root, ubuntu, deploy…"
                spellCheck={false}
                autoComplete="off"
                required
              />
            </Field>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-title">Autenticación</div>
          <div className="segmented" role="tablist" aria-label="Método de autenticación">
            {AUTH_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={authMethod === option.value}
                className={`segment ${authMethod === option.value ? 'is-active' : ''}`}
                onClick={() => setAuthMethod(option.value)}
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>

          {authMethod === 'password' ? (
            <div className="auth-panel">
              <Field
                label="Contraseña"
                htmlFor="conn-password"
                hint={
                  existing?.hasPassword
                    ? 'Hay una contraseña guardada. Déjalo vacío para conservarla.'
                    : undefined
                }
              >
                <div className="input-with-action">
                  <input
                    id="conn-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={existing?.hasPassword ? '•••••••• (guardada)' : 'Contraseña SSH'}
                    autoComplete="new-password"
                  />
                  <IconButton
                    label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </IconButton>
                </div>
              </Field>
              <Toggle
                checked={remember}
                onChange={setRemember}
                label="Recordar contraseña en este equipo"
                hint={
                  encryptionOff
                    ? 'El llavero del sistema no está disponible. Se pedirá al conectar.'
                    : 'Se cifra con el llavero del sistema operativo.'
                }
                disabled={encryptionOff}
              />
            </div>
          ) : null}

          {authMethod === 'key' ? (
            <div className="auth-panel">
              <Field
                label="Archivo de clave privada"
                htmlFor="conn-key"
                hint="Formatos OpenSSH, PEM y PuTTY (.ppk). La clave nunca se copia."
              >
                <div className="input-with-action">
                  <input
                    id="conn-key"
                    value={privateKeyPath}
                    onChange={(event) => setPrivateKeyPath(event.target.value)}
                    placeholder="~/.ssh/id_ed25519"
                    spellCheck={false}
                  />
                  <IconButton label="Buscar clave" onClick={() => void browseKey()}>
                    <FolderOpen size={15} />
                  </IconButton>
                </div>
              </Field>
              <Field
                label="Passphrase de la clave"
                htmlFor="conn-passphrase"
                hint={
                  existing?.hasPassphrase
                    ? 'Hay una passphrase guardada. Déjalo vacío para conservarla.'
                    : 'Opcional si la clave no está cifrada.'
                }
              >
                <div className="input-with-action">
                  <input
                    id="conn-passphrase"
                    type={showPassphrase ? 'text' : 'password'}
                    value={passphrase}
                    onChange={(event) => setPassphrase(event.target.value)}
                    placeholder={existing?.hasPassphrase ? '•••••••• (guardada)' : 'Passphrase'}
                    autoComplete="new-password"
                  />
                  <IconButton
                    label={showPassphrase ? 'Ocultar passphrase' : 'Mostrar passphrase'}
                    onClick={() => setShowPassphrase((value) => !value)}
                  >
                    {showPassphrase ? <EyeOff size={15} /> : <Eye size={15} />}
                  </IconButton>
                </div>
              </Field>
              <Toggle
                checked={remember}
                onChange={setRemember}
                label="Recordar passphrase en este equipo"
                hint={
                  encryptionOff
                    ? 'El llavero del sistema no está disponible. Se pedirá al conectar.'
                    : 'Se cifra con el llavero del sistema operativo.'
                }
                disabled={encryptionOff}
              />
            </div>
          ) : null}

          {authMethod === 'agent' ? (
            <div className="auth-panel agent-note">
              <ShieldCheck size={18} />
              <div>
                <strong>Usar el agente SSH del sistema</strong>
                <p>
                  Se usará <code>SSH_AUTH_SOCK</code> en macOS/Linux o el agente de OpenSSH en
                  Windows. Asegúrate de tener tus claves añadidas con <code>ssh-add</code>.
                </p>
              </div>
            </div>
          ) : null}
        </section>

        <div className="security-note">
          <Lock size={14} />
          <span>
            Los perfiles, el historial y las huellas se guardan en tu carpeta de usuario. Los
            secretos se cifran con el llavero del sistema; nunca se envían a ningún servidor de
            sincronización.
          </span>
        </div>
      </form>
    </Modal>
  )
}
