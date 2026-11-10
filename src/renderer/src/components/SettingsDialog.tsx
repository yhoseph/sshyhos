import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  Check,
  CircleAlert,
  Database,
  FolderOpen,
  HardDrive,
  Info,
  ListPlus,
  Lock,
  Monitor,
  Moon,
  Palette,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash
} from 'lucide-react'
import { BUILTIN_SNIPPETS } from '@shared/builtins'
import { FONT_FAMILIES, type AppSettings, type Platform, type Snippet } from '@shared/types'
import { useStore, type SettingsSection } from '../store'
import { Field, IconButton, Modal, Toggle, formatEndpoint } from './ui'

const SECTIONS: Array<{ id: SettingsSection; label: string; icon: ReactNode }> = [
  { id: 'general', label: 'General', icon: <Palette size={15} /> },
  { id: 'suggestions', label: 'Sugerencias', icon: <Sparkles size={15} /> },
  { id: 'hosts', label: 'Huellas', icon: <ShieldCheck size={15} /> },
  { id: 'about', label: 'Acerca de', icon: <Info size={15} /> }
]

const THEMES: Array<{ value: AppSettings['theme']; label: string; icon: ReactNode }> = [
  { value: 'dark', label: 'Oscuro', icon: <Moon size={14} /> },
  { value: 'light', label: 'Claro', icon: <Sun size={14} /> },
  { value: 'system', label: 'Sistema', icon: <Monitor size={14} /> }
]

const CURSORS: Array<{ value: AppSettings['cursorStyle']; label: string }> = [
  { value: 'block', label: 'Bloque' },
  { value: 'bar', label: 'Barra' },
  { value: 'underline', label: 'Subrayado' }
]

const FONT_SIZES = [100, 250, 500, 1000, 1500, 2000, 3000, 5000]
const SCROLLBACKS = [1000, 2000, 5000, 10000, 20000, 50000]

const PLATFORM_LABELS: Partial<Record<Platform, string>> = {
  win32: 'Windows',
  darwin: 'macOS',
  linux: 'Linux'
}

const numberOptions = (values: number[], current: number): number[] =>
  [...new Set([...values, current])].sort((a, b) => a - b)

interface SnippetDraft {
  id?: string
  name: string
  command: string
  description: string
}

const emptyDraft = (): SnippetDraft => ({ name: '', command: '', description: '' })

export function SettingsDialog({ section }: { section?: SettingsSection }): ReactNode {
  const [active, setActive] = useState<SettingsSection>(section ?? 'general')

  const settings = useStore((state) => state.settings)
  const snippets = useStore((state) => state.snippets)
  const knownHosts = useStore((state) => state.knownHosts)
  const appInfo = useStore((state) => state.appInfo)
  const saveSettings = useStore((state) => state.saveSettings)
  const saveSnippet = useStore((state) => state.saveSnippet)
  const removeSnippet = useStore((state) => state.removeSnippet)
  const clearHistory = useStore((state) => state.clearHistory)
  const forgetHost = useStore((state) => state.forgetHost)
  const refreshKnownHosts = useStore((state) => state.refreshKnownHosts)
  const addToast = useStore((state) => state.addToast)
  const closeDialog = useStore((state) => state.closeDialog)

  const [draft, setDraft] = useState<SnippetDraft | null>(null)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    void refreshKnownHosts()
  }, [refreshKnownHosts])

  const fontSizes = useMemo(
    () => numberOptions(FONT_SIZES, settings.historyLimit),
    [settings.historyLimit]
  )
  const scrollbackOptions = useMemo(
    () => numberOptions(SCROLLBACKS, settings.scrollback),
    [settings.scrollback]
  )

  const patch = (next: Partial<AppSettings>): void => {
    void saveSettings(next)
  }

  const confirmClearHistory = async (): Promise<void> => {
    const confirmed = await window.api.dialogs.confirm({
      title: 'Borrar historial',
      message: '¿Borrar todo el historial de comandos?',
      detail:
        'Se eliminarán los comandos aprendidos de todas las conexiones. Las recetas guardadas no se tocan.',
      confirmLabel: 'Borrar historial',
      danger: true
    })
    if (!confirmed) return
    setClearing(true)
    try {
      await clearHistory()
      addToast('Historial borrado.', 'success')
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'No se pudo borrar el historial.', 'error')
    } finally {
      setClearing(false)
    }
  }

  const editSnippet = (snippet: Snippet): void => {
    setDraft({
      id: snippet.id,
      name: snippet.name,
      command: snippet.command,
      description: snippet.description
    })
    setDraftError(null)
  }

  const submitSnippet = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!draft) return
    if (!draft.name.trim()) {
      setDraftError('Escribe un nombre para el comando.')
      return
    }
    if (!draft.command.trim()) {
      setDraftError('El comando no puede estar vacío.')
      return
    }
    try {
      await saveSnippet({
        id: draft.id,
        name: draft.name,
        command: draft.command,
        description: draft.description
      })
      addToast(draft.id ? 'Receta actualizada.' : 'Receta guardada.', 'success')
      setDraft(null)
      setDraftError(null)
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : 'No se pudo guardar la receta.')
    }
  }

  const askRemoveSnippet = async (snippet: Snippet): Promise<void> => {
    const confirmed = await window.api.dialogs.confirm({
      title: 'Eliminar receta',
      message: `¿Eliminar «${snippet.name}»?`,
      detail: 'Solo se borra de este equipo. Puedes volver a crearla cuando quieras.',
      confirmLabel: 'Eliminar',
      danger: true
    })
    if (!confirmed) return
    try {
      await removeSnippet(snippet.id)
      if (draft?.id === snippet.id) setDraft(null)
      addToast('Receta eliminada.', 'info')
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'No se pudo eliminar.', 'error')
    }
  }

  const askForgetHost = async (id: string, host: string, port: number): Promise<void> => {
    const confirmed = await window.api.dialogs.confirm({
      title: 'Olvidar huella',
      message: `¿Olvidar la huella de ${formatEndpoint(host, port)}?`,
      detail: 'La próxima conexión pedirá verificar la huella del servidor otra vez.',
      confirmLabel: 'Olvidar',
      danger: true
    })
    if (!confirmed) return
    try {
      await forgetHost(id)
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'No se pudo olvidar la huella.', 'error')
    }
  }

  const openDataDir = (): void => {
    void window.api.dialogs.openDataDir()
  }

  return (
    <Modal
      title="Ajustes"
      subtitle="Todo se guarda y se aplica solo en este equipo."
      icon={<Palette size={20} />}
      onClose={closeDialog}
      width={860}
      footer={
        <>
          <span className="footer-hint">
            <Check size={13} /> Los cambios se guardan al instante.
          </span>
          <div className="footer-actions">
            <button type="button" className="primary-button" onClick={closeDialog}>
              Cerrar
            </button>
          </div>
        </>
      }
    >
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Secciones de ajustes">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`settings-nav-item ${active === item.id ? 'is-active' : ''}`}
              onClick={() => setActive(item.id)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="settings-panel">
          {active === 'general' ? (
            <>
              <section className="settings-group">
                <div className="settings-group-title">
                  <Sun size={13} /> Apariencia
                </div>
                <div className="settings-row">
                  <div className="settings-row-label">
                    Tema
                    <span>Elige el aspecto de la interfaz y de la terminal.</span>
                  </div>
                  <div className="segmented" role="tablist" aria-label="Tema">
                    {THEMES.map((theme) => (
                      <button
                        key={theme.value}
                        type="button"
                        role="tab"
                        aria-selected={settings.theme === theme.value}
                        className={`segment ${settings.theme === theme.value ? 'is-active' : ''}`}
                        onClick={() => patch({ theme: theme.value })}
                      >
                        {theme.icon}
                        {theme.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-label">
                    Tipografía
                    <span>Fuente monoespaciada de la terminal.</span>
                  </div>
                  <select
                    value={settings.fontFamily}
                    onChange={(event) => patch({ fontFamily: event.target.value })}
                    aria-label="Tipografía de la terminal"
                  >
                    {Object.entries(FONT_FAMILIES).map(([value, font]) => (
                      <option key={value} value={value}>
                        {font.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="settings-row">
                  <div className="settings-row-label">
                    Tamaño de letra
                    <span>También puedes usar Ctrl + / Ctrl − dentro de la terminal.</span>
                  </div>
                  <div className="range-row">
                    <input
                      type="range"
                      min={10}
                      max={26}
                      step={1}
                      value={settings.fontSize}
                      onChange={(event) => patch({ fontSize: Number(event.target.value) })}
                      aria-label="Tamaño de letra"
                    />
                    <span className="range-value">{settings.fontSize} px</span>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-label">
                    Cursor
                    <span>Forma del cursor de la terminal.</span>
                  </div>
                  <div className="segmented" role="tablist" aria-label="Estilo del cursor">
                    {CURSORS.map((cursor) => (
                      <button
                        key={cursor.value}
                        type="button"
                        role="tab"
                        aria-selected={settings.cursorStyle === cursor.value}
                        className={`segment ${settings.cursorStyle === cursor.value ? 'is-active' : ''}`}
                        onClick={() => patch({ cursorStyle: cursor.value })}
                      >
                        {cursor.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-label">
                    Historial de desplazamiento
                    <span>Líneas que permanecen disponibles al subir.</span>
                  </div>
                  <select
                    value={settings.scrollback}
                    onChange={(event) => patch({ scrollback: Number(event.target.value) })}
                    aria-label="Historial de desplazamiento"
                  >
                    {scrollbackOptions.map((value) => (
                      <option key={value} value={value}>
                        {value.toLocaleString('es')} líneas
                      </option>
                    ))}
                  </select>
                </div>

                <Toggle
                  checked={settings.cursorBlink}
                  onChange={(value) => patch({ cursorBlink: value })}
                  label="Cursor parpadeante"
                  hint="Un cursor fijo resulta más discreto en capturas y grabaciones."
                />
                <Toggle
                  checked={settings.copyOnSelect}
                  onChange={(value) => patch({ copyOnSelect: value })}
                  label="Copiar al seleccionar"
                  hint="El texto seleccionado va al portapapeles del sistema automáticamente."
                />
              </section>

              <div className="settings-note">
                <Lock size={14} />
                <span>
                  Los ajustes viven en un archivo local dentro de tu carpeta de usuario. No hay
                  cuentas ni sincronización.
                </span>
              </div>
            </>
          ) : null}

          {active === 'suggestions' ? (
            <>
              <section className="settings-group">
                <div className="settings-group-title">
                  <Sparkles size={13} /> Sugerencias
                </div>
                <Toggle
                  checked={settings.suggestionsEnabled}
                  onChange={(value) => patch({ suggestionsEnabled: value })}
                  label="Sugerencias de comandos"
                  hint="Aprende de tu historial local y de las recetas integradas."
                />
                <Toggle
                  checked={settings.ghostSuggestions}
                  onChange={(value) => patch({ ghostSuggestions: value })}
                  label="Texto fantasma al escribir"
                  hint="Muestra el resto del comando en gris. Pulsa → para aceptarlo."
                  disabled={!settings.suggestionsEnabled}
                />
                <div className="settings-note">
                  <Lock size={14} />
                  <span>
                    Las sugerencias se calculan en tu equipo. Nunca se envía ningún comando ni
                    fragmento de historial a internet.
                  </span>
                </div>
              </section>

              <section className="settings-group">
                <div className="settings-group-title">
                  <HardDrive size={13} /> Historial local
                </div>
                <Toggle
                  checked={settings.saveHistory}
                  onChange={(value) => patch({ saveHistory: value })}
                  label="Guardar comandos ejecutados"
                  hint="Solo se guardan comandos escritos a mano y confirmados por el servidor. Las contraseñas ocultas se descartan."
                />
                <div className="settings-row">
                  <div className="settings-row-label">
                    Comandos por conexión
                    <span>Se conservan los más recientes; el historial global guarda el doble.</span>
                  </div>
                  <select
                    value={settings.historyLimit}
                    onChange={(event) => patch({ historyLimit: Number(event.target.value) })}
                    aria-label="Límite de historial"
                  >
                    {fontSizes.map((value) => (
                      <option key={value} value={value}>
                        {value.toLocaleString('es')} comandos
                      </option>
                    ))}
                  </select>
                </div>
                <div className="settings-actions">
                  <button
                    type="button"
                    className="danger-ghost-button"
                    onClick={() => void confirmClearHistory()}
                    disabled={clearing}
                  >
                    <Trash size={14} />
                    {clearing ? 'Borrando…' : 'Borrar todo el historial'}
                  </button>
                  <span className="settings-actions-note">
                    No afecta a las recetas que hayas guardado.
                  </span>
                </div>
              </section>

              <section className="settings-group">
                <div className="settings-group-title">
                  <ListPlus size={13} /> Mis recetas
                  <span className="settings-group-badge">{snippets.length}</span>
                </div>

                {snippets.length === 0 && !draft ? (
                  <div className="snippet-empty">
                    <ListPlus size={20} />
                    <p>Todavía no hay recetas propias.</p>
                    <span>Guarda comandos que uses a menudo para insertarlos con dos teclas.</span>
                  </div>
                ) : (
                  <div className="snippet-list">
                    {snippets.map((snippet) => (
                      <div className="snippet-row" key={snippet.id}>
                        <div className="snippet-copy">
                          <span className="snippet-name">{snippet.name}</span>
                          <code className="snippet-command">{snippet.command}</code>
                          {snippet.description ? (
                            <span className="snippet-desc">{snippet.description}</span>
                          ) : null}
                        </div>
                        <div className="snippet-actions">
                          <IconButton label={`Editar ${snippet.name}`} onClick={() => editSnippet(snippet)}>
                            <Pencil size={14} />
                          </IconButton>
                          <IconButton
                            label={`Eliminar ${snippet.name}`}
                            tone="danger"
                            onClick={() => void askRemoveSnippet(snippet)}
                          >
                            <Trash size={14} />
                          </IconButton>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {draft ? (
                  <form className="snippet-form" onSubmit={(event) => void submitSnippet(event)}>
                    <div className="snippet-form-grid">
                      <Field label="Nombre" htmlFor="snippet-name">
                        <input
                          id="snippet-name"
                          value={draft.name}
                          onChange={(event) =>
                            setDraft((current) =>
                              current ? { ...current, name: event.target.value } : current
                            )
                          }
                          placeholder="Reiniciar nginx"
                          maxLength={80}
                          autoFocus
                        />
                      </Field>
                      <Field label="Descripción" htmlFor="snippet-description">
                        <input
                          id="snippet-description"
                          value={draft.description}
                          onChange={(event) =>
                            setDraft((current) =>
                              current ? { ...current, description: event.target.value } : current
                            )
                          }
                          placeholder="Opcional, para reconocerlo en la paleta"
                          maxLength={200}
                        />
                      </Field>
                    </div>
                    <Field
                      label="Comando"
                      htmlFor="snippet-command"
                      hint="Se inserta tal cual. No se ejecuta hasta que pulses Intro."
                      error={draftError ?? undefined}
                    >
                      <textarea
                        id="snippet-command"
                        value={draft.command}
                        onChange={(event) =>
                          setDraft((current) =>
                            current ? { ...current, command: event.target.value } : current
                          )
                        }
                        placeholder="sudo systemctl restart nginx"
                        rows={2}
                        spellCheck={false}
                      />
                    </Field>
                    <div className="snippet-form-actions">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => {
                          setDraft(null)
                          setDraftError(null)
                        }}
                      >
                        Cancelar
                      </button>
                      <button type="submit" className="primary-button">
                        {draft.id ? 'Guardar cambios' : 'Guardar receta'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="settings-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => {
                        setDraft(emptyDraft())
                        setDraftError(null)
                      }}
                    >
                      <Plus size={14} />
                      Nueva receta
                    </button>
                    <span className="settings-actions-note">
                      Además se incluyen {BUILTIN_SNIPPETS.length} recetas integradas de solo lectura.
                    </span>
                  </div>
                )}
              </section>
            </>
          ) : null}

          {active === 'hosts' ? (
            <>
              <section className="settings-group">
                <div className="settings-group-title">
                  <ShieldCheck size={13} /> Servidores verificados
                  <span className="settings-group-badge">{knownHosts.length}</span>
                </div>
                <p className="settings-group-lead">
                  La primera vez que conectas, SSH Yhos guarda la huella SHA-256 de la clave del
                  servidor. Si cambia, se te avisará antes de enviar credenciales.
                </p>

                {knownHosts.length === 0 ? (
                  <div className="known-empty">
                    <ShieldCheck size={22} />
                    <p>No hay huellas guardadas.</p>
                    <span>Se añadirán cuando aceptes la huella de un servidor nuevo.</span>
                  </div>
                ) : (
                  <div className="known-list">
                    {knownHosts.map((host) => (
                      <div className="known-row" key={host.id}>
                        <div className="known-main">
                          <span className="known-host">
                            {formatEndpoint(host.host, host.port)}
                          </span>
                          <code className="known-fingerprint">{host.fingerprint}</code>
                          <span className="known-date">
                            Verificado el{' '}
                            {new Date(host.addedAt).toLocaleDateString('es', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                        <div className="known-actions">
                          <button
                            type="button"
                            className="ghost-button small"
                            onClick={() => void askForgetHost(host.id, host.host, host.port)}
                          >
                            <Trash size={13} />
                            Olvidar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div className="settings-note">
                <CircleAlert size={14} />
                <span>
                  Si una huella cambió y no sabes por qué, cancela la conexión y confirma la nueva
                  huella con el administrador del servidor por otro canal.
                </span>
              </div>
            </>
          ) : null}

          {active === 'about' ? (
            <>
              <div className="about-hero">
                <div className="modal-icon">
                  <Lock size={20} />
                </div>
                <div>
                  <strong>SSH Yhos</strong>
                  <span>Cliente SSH de escritorio, local y cifrado.</span>
                </div>
              </div>

              <section className="settings-group">
                <div className="settings-group-title">
                  <Info size={13} /> Información técnica
                </div>
                <div className="about-grid">
                  <div className="about-row">
                    <span className="about-label">Versión</span>
                    <span className="about-value">{appInfo?.version ?? '0.1.0'}</span>
                  </div>
                  <div className="about-row">
                    <span className="about-label">Plataforma</span>
                    <span className="about-value">
                      {appInfo ? (PLATFORM_LABELS[appInfo.platform] ?? appInfo.platform) : '—'}
                    </span>
                  </div>
                  <div className="about-row">
                    <span className="about-label">Cifrado de secretos</span>
                    <span className="about-value">
                      {appInfo?.encryptionAvailable ? (
                        <span className="about-badge ok">
                          <ShieldCheck size={12} /> Disponible · {appInfo.encryptionBackend}
                        </span>
                      ) : (
                        <span className="about-badge bad">
                          <CircleAlert size={12} /> No disponible
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="about-row">
                    <span className="about-label">Carpeta de datos</span>
                    <span className="about-value">
                      <code className="path-code">{appInfo?.dataDir ?? '—'}</code>
                    </span>
                  </div>
                  <div className="about-row">
                    <span className="about-label">Modo</span>
                    <span className="about-value">
                      {appInfo?.isDev ? 'Desarrollo' : 'Producción'}
                    </span>
                  </div>
                </div>
                <div className="settings-actions">
                  <button type="button" className="ghost-button" onClick={openDataDir}>
                    <FolderOpen size={14} />
                    Abrir carpeta de datos
                  </button>
                  <span className="settings-actions-note">
                    <Database size={12} /> profiles.json · secrets.json · history.json · known-hosts.json
                  </span>
                </div>
              </section>

              <section className="settings-group">
                <div className="settings-group-title">
                  <ShieldCheck size={13} /> Privacidad por diseño
                </div>
                <ul className="about-list">
                  <li>Las credenciales se cifran con DPAPI, Keychain, libsecret o KWallet.</li>
                  <li>Nada se sube a la nube: no hay cuentas, telemetría ni sincronización.</li>
                  <li>El historial y las huellas son archivos locales que puedes borrar.</li>
                  <li>Si el llavero del sistema no está disponible, no se guarda ningún secreto.</li>
                </ul>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
