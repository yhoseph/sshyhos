import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useStore } from '../store'

export function Toasts(): ReactNode {
  const toasts = useStore((state) => state.toasts)
  const dismiss = useStore((state) => state.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.tone}`}>
          <span className="toast-icon">
            {toast.tone === 'success' ? (
              <CircleCheck size={17} />
            ) : toast.tone === 'error' ? (
              <CircleAlert size={17} />
            ) : (
              <Info size={17} />
            )}
          </span>
          <span className="toast-message">{toast.message}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => dismiss(toast.id)}
            aria-label="Cerrar aviso"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
