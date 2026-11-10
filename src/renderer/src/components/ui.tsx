import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Logo({ size = 26 }: { size?: number }): ReactNode {
  return (
    <svg
      className="logo"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="logo-bg" x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#16222c" />
          <stop offset="1" stopColor="#0a0f14" />
        </linearGradient>
        <linearGradient id="logo-stroke" x1="9" y1="10" x2="32" y2="31" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7ff0bd" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#logo-bg)" />
      <rect x="1" y="1" width="38" height="38" rx="11" stroke="#4ee1a0" strokeOpacity="0.25" />
      <path
        d="M12 12.5L20.5 20L12 27.5"
        stroke="url(#logo-stroke)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M22.5 27.5H29.5" stroke="url(#logo-stroke)" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  )
}

export function IconButton({
  label,
  onClick,
  children,
  className = '',
  disabled = false,
  tone = 'default'
}: {
  label: string
  onClick?: () => void
  children: ReactNode
  className?: string
  disabled?: boolean
  tone?: 'default' | 'danger' | 'accent'
}): ReactNode {
  return (
    <button
      type="button"
      className={`icon-button icon-button--${tone} ${className}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled = false
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint?: string
  disabled?: boolean
}): ReactNode {
  return (
    <label className={`toggle-row ${disabled ? 'is-disabled' : ''}`}>
      <span className="toggle-copy">
        <span className="toggle-label">{label}</span>
        {hint ? <span className="toggle-hint">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`switch ${checked ? 'is-on' : ''}`}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
      >
        <span className="switch-knob" />
      </button>
    </label>
  )
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className = ''
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}): ReactNode {
  return (
    <div className={`field ${className}`}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? <span className="field-error">{error}</span> : null}
      {!error && hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  )
}

export function Modal({
  title,
  subtitle,
  icon,
  onClose,
  children,
  footer,
  width = 620
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
}): ReactNode {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="modal"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div className="modal-heading">
            {icon ? <span className="modal-icon">{icon}</span> : null}
            <div>
              <h2>{title}</h2>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
          </div>
          <IconButton label="Cerrar" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </div>
    </div>
  )
}

export function StatusDot({ status }: { status: string }): ReactNode {
  return <span className={`status-dot status-dot--${status}`} aria-hidden="true" />
}

export function KeyHint({ children }: { children: ReactNode }): ReactNode {
  return <kbd className="key-hint">{children}</kbd>
}

export function formatEndpoint(host: string, port: number): string {
  const isIpv6 = host.includes(':') && !host.startsWith('[')
  return `${isIpv6 ? `[${host}]` : host}:${port}`
}
