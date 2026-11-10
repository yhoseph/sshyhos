import { ArrowRight, Keyboard, Lock, Plus, Server, ShieldCheck, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { useStore } from '../store'
import { KeyHint, Logo, formatEndpoint } from './ui'

export function Welcome(): ReactNode {
  const profiles = useStore((state) => state.profiles)
  const openProfile = useStore((state) => state.openProfile)
  const openDialog = useStore((state) => state.openDialog)

  const recent = [...profiles]
    .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))
    .slice(0, 4)

  return (
    <div className="welcome">
      <div className="welcome-hero">
        <div className="welcome-mark">
          <Logo size={64} />
        </div>
        <p className="eyebrow">Consola SSH de escritorio</p>
        <h1>Tus servidores, en tu máquina.</h1>
        <p className="welcome-lead">
          Conexiones rápidas, credenciales cifradas y sugerencias de comandos que nunca salen de
          este equipo.
        </p>
        <div className="welcome-actions">
          <button
            type="button"
            className="primary-button large"
            onClick={() => openDialog({ kind: 'connection' })}
          >
            <Plus size={17} />
            Nueva conexión
          </button>
          <span className="welcome-shortcut">
            o pulsa <KeyHint>Ctrl ⇧ N</KeyHint>
          </span>
        </div>

        <div className="feature-row">
          <div className="feature">
            <span className="feature-icon">
              <ShieldCheck size={18} />
            </span>
            <div>
              <strong>Huellas verificadas</strong>
              <span>Protección contra servidores suplantados.</span>
            </div>
          </div>
          <div className="feature">
            <span className="feature-icon">
              <Sparkles size={18} />
            </span>
            <div>
              <strong>Sugerencias locales</strong>
              <span>Historial y recetas al escribir, sin nube.</span>
            </div>
          </div>
          <div className="feature">
            <span className="feature-icon">
              <Lock size={18} />
            </span>
            <div>
              <strong>Cifrado del sistema</strong>
              <span>DPAPI, Keychain o libsecret según tu SO.</span>
            </div>
          </div>
        </div>
      </div>

      {recent.length > 0 ? (
        <section className="recent-section">
          <div className="section-heading">
            <h2>Recientes</h2>
            <span>Shift + clic abre una sesión extra</span>
          </div>
          <div className="recent-grid">
            {recent.map((profile) => (
              <button
                type="button"
                className="recent-card"
                key={profile.id}
                onClick={(event) => openProfile(profile, event.shiftKey)}
              >
                <span className="recent-color" style={{ background: profile.color }} />
                <span className="recent-icon">
                  <Server size={18} />
                </span>
                <span className="recent-copy">
                  <strong>{profile.name}</strong>
                  <span>
                    {profile.username}@{formatEndpoint(profile.host, profile.port)}
                  </span>
                </span>
                <ArrowRight size={16} className="recent-arrow" />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <footer className="welcome-footer">
        <span>
          <Keyboard size={14} /> Dentro de la terminal: <KeyHint>Ctrl Espacio</KeyHint> abre las
          sugerencias
        </span>
        <span>
          <Lock size={13} /> Sin telemetría · sin cuentas · sin sincronización
        </span>
      </footer>
    </div>
  )
}
