import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Terminal as Xterm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import {
  CircleAlert,
  ClipboardPaste,
  Copy,
  Eraser,
  Lock,
  RefreshCw,
  Sparkles,
  SquareCheck,
  TriangleAlert,
  X
} from 'lucide-react'
import { FONT_FAMILIES } from '@shared/types'
import { terminalTheme } from '../lib/terminal-theme'
import { useResolvedTheme } from '../lib/theme'
import { buildSuggestions, findGhostCommand, type Suggestion } from '../lib/suggestions'
import { useStore, type TerminalTab } from '../store'
import { CommandPalette } from './CommandPalette'
import { IconButton, StatusDot, formatEndpoint } from './ui'

interface BufferState {
  text: string
  cursor: number
  trusted: boolean
  echoConfirmed: boolean
}

interface GhostState {
  command: string
  suffix: string
  displaySuffix: string
  left: number
  top: number
  height: number
}

interface ContextMenuState {
  x: number
  y: number
  hasSelection: boolean
}

const FALLBACK_FONT =
  '"JetBrains Mono", "Cascadia Code", "Fira Code", "SFMono-Regular", Consolas, monospace'

function statusLabel(status: TerminalTab['status']): string {
  if (status === 'connected') return 'Conectada'
  if (status === 'connecting') return 'Conectando…'
  if (status === 'error') return 'Error de conexión'
  return 'Desconectada'
}

export function TerminalView({
  tab,
  isActive
}: {
  tab: TerminalTab
  isActive: boolean
}): ReactNode {
  const hostRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Xterm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const ghostRef = useRef<GhostState | null>(null)
  const bufferRef = useRef<BufferState>({ text: '', cursor: 0, trusted: true, echoConfirmed: false })
  const ghostTimerRef = useRef<number | null>(null)
  const ghostRefreshRef = useRef<(() => void) | null>(null)
  const paletteOpenRef = useRef(false)
  const isActiveRef = useRef(isActive)

  const [ghost, setGhost] = useState<GhostState | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [paletteIndex, setPaletteIndex] = useState(0)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const copyRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const pasteRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const lastCopyTimeRef = useRef(0)
  const lastPasteTimeRef = useRef(0)

  const settings = useStore((state) => state.settings)
  const history = useStore((state) => state.historyByProfile[tab.profileId])
  const snippets = useStore((state) => state.snippets)
  const profile = useStore((state) => state.profiles.find((item) => item.id === tab.profileId))
  const resolvedTheme = useResolvedTheme()

  const copySelection = async (): Promise<void> => {
    const now = Date.now()
    if (now - lastCopyTimeRef.current < 250) return
    lastCopyTimeRef.current = now

    const term = termRef.current
    const selection = term?.getSelection()
    if (!selection) {
      useStore.getState().addToast('Selecciona texto en la terminal para copiarlo.', 'info')
      return
    }
    try {
      await window.api.clipboard.writeText(selection)
      term?.clearSelection()
      useStore.getState().addToast('Texto copiado.', 'success')
    } catch {
      useStore.getState().addToast('No se pudo acceder al portapapeles.', 'error')
    }
  }

  const pasteClipboard = async (): Promise<void> => {
    const now = Date.now()
    if (now - lastPasteTimeRef.current < 250) return
    lastPasteTimeRef.current = now

    try {
      const text = await window.api.clipboard.readText()
      if (text) {
        const term = termRef.current
        if (!term) return
        term.focus()
        term.paste(text)
      }
    } catch {
      useStore.getState().addToast('No se pudo leer el portapapeles.', 'error')
    }
  }

  copyRef.current = copySelection
  pasteRef.current = pasteClipboard

  useEffect(() => {
    if (!contextMenu) return
    const close = (): void => setContextMenu(null)
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('click', close)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [contextMenu])

  const fontStack = FONT_FAMILIES[settings.fontFamily]?.stack ?? FALLBACK_FONT
  const suggestions = useMemo(
    () => buildSuggestions(paletteQuery, history, snippets),
    [paletteQuery, history, snippets]
  )

  useEffect(() => {
    setPaletteIndex(0)
  }, [paletteQuery])

  useEffect(() => {
    paletteOpenRef.current = paletteOpen
  }, [paletteOpen])

  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  // Montaje del terminal: una sola instancia por pestaña.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const current = useStore.getState().settings
    const term = new Xterm({
      fontFamily: FONT_FAMILIES[current.fontFamily]?.stack ?? FALLBACK_FONT,
      fontSize: current.fontSize,
      cursorStyle: current.cursorStyle,
      cursorBlink: current.cursorBlink,
      scrollback: current.scrollback,
      theme: terminalTheme(
        current.theme === 'light'
          ? 'light'
          : current.theme === 'dark'
            ? 'dark'
            : window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light'
      ),
      allowProposedApi: false,
      macOptionIsMeta: true,
      minimumContrastRatio: 1,
      rightClickSelectsWord: false
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(
      new WebLinksAddon((_event, uri) => {
        void window.api.app.openExternal(uri)
      })
    )
    term.open(host)
    termRef.current = term
    fitRef.current = fit

    try {
      fit.fit()
    } catch {
      // El contenedor puede no tener tamaño en el primer frame.
    }

    const hideGhost = (): void => {
      if (!ghostRef.current) return
      ghostRef.current = null
      setGhost(null)
    }

    const showGhost = (next: GhostState): void => {
      ghostRef.current = next
      setGhost(next)
    }

    const echoedInTerminal = (text: string): boolean => {
      const buffer = term.buffer.active
      const tail = text.trim().slice(-24)
      if (!tail) return false
      const currentLine = buffer.getLine(buffer.cursorY)?.translateToString(false) ?? ''
      if (currentLine.includes(tail)) return true
      const previousLine = buffer.getLine(buffer.cursorY - 1)?.translateToString(false) ?? ''
      return previousLine.includes(tail)
    }

    const refreshGhost = (): void => {
      const buffer = bufferRef.current
      const state = useStore.getState()
      const active = state.tabs.find((item) => item.id === tab.id)

      if (
        !active ||
        active.status !== 'connected' ||
        !buffer.trusted ||
        term.buffer.active.type !== 'normal' ||
        buffer.cursor !== buffer.text.length ||
        buffer.text.trim().length < 2
      ) {
        hideGhost()
        return
      }

      // Solo confiamos en lo que el servidor ha devuelto por eco. Así no se
      // registra lo que se escribe en prompts ocultos (sudo, passphrase…).
      if (!echoedInTerminal(buffer.text)) {
        buffer.echoConfirmed = false
        hideGhost()
        return
      }
      buffer.echoConfirmed = true

      if (
        !state.settings.suggestionsEnabled ||
        !state.settings.ghostSuggestions ||
        paletteOpenRef.current
      ) {
        hideGhost()
        return
      }

      const command = findGhostCommand(
        buffer.text,
        state.historyByProfile[tab.profileId],
        state.snippets
      )
      if (!command) {
        hideGhost()
        return
      }

      const stage = stageRef.current
      const screen = host.querySelector<HTMLElement>('.xterm-screen')
      if (!stage || !screen || term.cols <= 0 || term.rows <= 0) {
        hideGhost()
        return
      }

      const stageRect = stage.getBoundingClientRect()
      const screenRect = screen.getBoundingClientRect()
      const activeBuffer = term.buffer.active
      const visibleRow = activeBuffer.cursorY - activeBuffer.viewportY
      if (
        screenRect.width <= 0 ||
        screenRect.height <= 0 ||
        visibleRow < 0 ||
        visibleRow >= term.rows ||
        activeBuffer.cursorX >= term.cols
      ) {
        hideGhost()
        return
      }

      const cellWidth = screenRect.width / term.cols
      const cellHeight = screenRect.height / term.rows
      const suffix = command.slice(buffer.text.length)
      if (!suffix) {
        hideGhost()
        return
      }

      showGhost({
        command,
        suffix,
        displaySuffix: suffix.length > 100 ? `${suffix.slice(0, 100)}…` : suffix,
        left: screenRect.left - stageRect.left + activeBuffer.cursorX * cellWidth,
        top: screenRect.top - stageRect.top + visibleRow * cellHeight,
        height: cellHeight
      })
    }

    const scheduleGhost = (delay = 35): void => {
      if (ghostTimerRef.current !== null) window.clearTimeout(ghostTimerRef.current)
      ghostTimerRef.current = window.setTimeout(() => {
        ghostTimerRef.current = null
        refreshGhost()
      }, delay)
    }
    ghostRefreshRef.current = refreshGhost

    const resetBuffer = (): void => {
      bufferRef.current = { text: '', cursor: 0, trusted: true, echoConfirmed: false }
      hideGhost()
    }

    const recordCommand = (): void => {
      const buffer = bufferRef.current
      const state = useStore.getState()
      const echoed = buffer.echoConfirmed || echoedInTerminal(buffer.text)
      if (buffer.trusted && echoed && term.buffer.active.type === 'normal') {
        const command = buffer.text.trim()
        if (command) state.recordCommand(tab.profileId, command)
      }
      resetBuffer()
    }

    const insertText = (text: string): void => {
      const buffer = bufferRef.current
      const before = buffer.text.slice(0, buffer.cursor)
      const after = buffer.text.slice(buffer.cursor)
      buffer.text = before + text + after
      buffer.cursor += text.length
      buffer.trusted = true
    }

    const acceptGhost = (): boolean => {
      const suggestion = ghostRef.current
      const buffer = bufferRef.current
      if (!suggestion || buffer.cursor !== buffer.text.length) return false
      window.api.ssh.write(tab.id, suggestion.suffix)
      buffer.text += suggestion.suffix
      buffer.cursor = buffer.text.length
      hideGhost()
      scheduleGhost(80)
      return true
    }

    const handleData = (data: string): void => {
      if (!data) return
      const buffer = bufferRef.current

      if (term.buffer.active.type === 'alternate') {
        window.api.ssh.write(tab.id, data)
        resetBuffer()
        return
      }

      if (data === '\r' || data === '\r\n') {
        recordCommand()
        window.api.ssh.write(tab.id, data)
        return
      }

      if (data.length > 1 && (data.includes('\r') || data.includes('\n'))) {
        buffer.trusted = false
        hideGhost()
        window.api.ssh.write(tab.id, data)
        resetBuffer()
        return
      }

      if (data.startsWith('\x1b')) {
        if (data === '\x1b[C' || data === '\x1bOC') {
          if (buffer.cursor === buffer.text.length && acceptGhost()) return
          buffer.cursor = Math.min(buffer.text.length, buffer.cursor + 1)
        } else if (data === '\x1b[D' || data === '\x1bOD') {
          buffer.cursor = Math.max(0, buffer.cursor - 1)
        } else if (data === '\x1b[H' || data === '\x1b[1~' || data === '\x1bOH') {
          buffer.cursor = 0
        } else if (data === '\x1b[F' || data === '\x1b[4~' || data === '\x1bOF') {
          buffer.cursor = buffer.text.length
        } else if (data === '\x1b[3~') {
          buffer.text = buffer.text.slice(0, buffer.cursor) + buffer.text.slice(buffer.cursor + 1)
        } else {
          buffer.trusted = false
        }
        window.api.ssh.write(tab.id, data)
        scheduleGhost()
        return
      }

      if (data === '\x03' || data === '\x04') {
        window.api.ssh.write(tab.id, data)
        resetBuffer()
        return
      }
      if (data === '\x15') {
        buffer.text = ''
        buffer.cursor = 0
        window.api.ssh.write(tab.id, data)
        scheduleGhost()
        return
      }
      if (data === '\x01') {
        buffer.cursor = 0
        window.api.ssh.write(tab.id, data)
        return
      }
      if (data === '\x05') {
        buffer.cursor = buffer.text.length
        window.api.ssh.write(tab.id, data)
        return
      }
      if (data === '\x17') {
        const before = buffer.text.slice(0, buffer.cursor)
        const after = buffer.text.slice(buffer.cursor)
        const trimmed = before.replace(/\S+\s*$/u, '')
        buffer.text = trimmed + after
        buffer.cursor = trimmed.length
        window.api.ssh.write(tab.id, data)
        scheduleGhost()
        return
      }
      if (data === '\x7f' || data === '\x08') {
        if (buffer.cursor > 0) {
          buffer.text =
            buffer.text.slice(0, buffer.cursor - 1) + buffer.text.slice(buffer.cursor)
          buffer.cursor -= 1
        }
        window.api.ssh.write(tab.id, data)
        scheduleGhost()
        return
      }
      if (data === '\t') {
        buffer.trusted = false
        hideGhost()
        window.api.ssh.write(tab.id, data)
        return
      }

      const printable = [...data].filter((char) => char >= ' ' && char !== '\x7f').join('')
      if (printable) insertText(printable)
      window.api.ssh.write(tab.id, data)
      scheduleGhost()
    }

    const adjustFont = (delta: number, reset = false): void => {
      const state = useStore.getState().settings
      const next = reset ? 14 : Math.min(26, Math.max(10, state.fontSize + delta))
      if (next !== state.fontSize) void useStore.getState().saveSettings({ fontSize: next })
    }

    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true
      const isMac = window.api.platform === 'darwin'

      // Sugerencias / paleta
      if (event.ctrlKey && event.code === 'Space') {
        setPaletteOpen(true)
        setPaletteQuery('')
        setPaletteIndex(0)
        return false
      }

      // Copiar:
      // - Ctrl+C / Cmd+C (con texto seleccionado): copia y limpia selección (evita enviar SIGINT)
      //   Si NO hay selección, pasa a xterm para enviar \x03 (SIGINT / cancelar comando).
      // - Ctrl+Shift+C / Cmd+Shift+C: siempre copia
      // - Ctrl+Insert (con selección): estándar terminal
      const hasSel = term.hasSelection()
      const isCopy =
        (event.ctrlKey && event.shiftKey && event.code === 'KeyC') ||
        (!isMac && event.ctrlKey && !event.shiftKey && !event.altKey && event.code === 'KeyC' && hasSel) ||
        (isMac && event.metaKey && !event.shiftKey && !event.altKey && event.code === 'KeyC' && hasSel) ||
        (event.ctrlKey && !event.shiftKey && !event.altKey && event.code === 'Insert' && hasSel)

      if (isCopy) {
        event.preventDefault()
        event.stopPropagation()
        void copyRef.current()
        return false
      }

      // Pegar:
      // - Ctrl+V / Cmd+V
      // - Ctrl+Shift+V / Cmd+Shift+V
      // - Shift+Insert (estándar terminal)
      const isPaste =
        (!isMac && event.ctrlKey && !event.altKey && event.code === 'KeyV') ||
        (isMac && event.metaKey && !event.altKey && event.code === 'KeyV') ||
        (event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey && event.code === 'Insert')

      if (isPaste) {
        event.preventDefault()
        event.stopPropagation()
        void pasteRef.current()
        return false
      }

      // Seleccionar todo con Ctrl+Shift+A
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyA') {
        event.preventDefault()
        event.stopPropagation()
        term.selectAll()
        return false
      }

      if ((event.ctrlKey || event.metaKey) && (event.code === 'Equal' || event.code === 'NumpadAdd')) {
        adjustFont(1)
        return false
      }
      if ((event.ctrlKey || event.metaKey) && (event.code === 'Minus' || event.code === 'NumpadSubtract')) {
        adjustFont(-1)
        return false
      }
      if ((event.ctrlKey || event.metaKey) && event.code === 'Digit0') {
        adjustFont(0, true)
        return false
      }
      return true
    })

    const handleContextMenu = (e: MouseEvent): void => {
      e.preventDefault()
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        hasSelection: term.hasSelection()
      })
    }

    const handleDomCopy = (e: ClipboardEvent): void => {
      const selection = term.getSelection()
      if (selection) {
        e.preventDefault()
        e.stopPropagation()
        void copyRef.current()
      }
    }

    const handleDomPaste = (e: ClipboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      void pasteRef.current()
    }

    host.addEventListener('contextmenu', handleContextMenu)
    host.addEventListener('copy', handleDomCopy)
    host.addEventListener('paste', handleDomPaste)

    const dataDisposable = term.onData(handleData)
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      window.api.ssh.resize(tab.id, cols, rows)
      scheduleGhost(50)
    })
    const selectionDisposable = term.onSelectionChange(() => {
      if (!useStore.getState().settings.copyOnSelect) return
      const selection = term.getSelection()
      if (selection) void window.api.clipboard.writeText(selection).catch(() => undefined)
    })

    const unsubscribe = window.api.ssh.onEvent((event) => {
      if (event.sessionId !== tab.id) return
      if (event.type === 'data') {
        term.write(event.data)
        scheduleGhost(15)
        return
      }
      if (event.type === 'status' && event.status === 'connected' && isActiveRef.current) {
        term.focus()
      }
    })

    const observer = new ResizeObserver(() => {
      if (!isActiveRef.current) return
      if (host.clientWidth <= 0 || host.clientHeight <= 0) return
      window.requestAnimationFrame(() => {
        try {
          fit.fit()
        } catch {
          // Ignorado: el tamaño puede cambiar durante el redimensionado.
        }
        scheduleGhost(60)
      })
    })
    observer.observe(host)

    if (isActiveRef.current) term.focus()

    return () => {
      if (ghostTimerRef.current !== null) window.clearTimeout(ghostTimerRef.current)
      ghostRefreshRef.current = null
      unsubscribe()
      observer.disconnect()
      dataDisposable.dispose()
      resizeDisposable.dispose()
      selectionDisposable.dispose()
      host.removeEventListener('contextmenu', handleContextMenu)
      host.removeEventListener('copy', handleDomCopy)
      host.removeEventListener('paste', handleDomPaste)
      window.api.ssh.disconnect(tab.id)
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
    // Una pestaña = una instancia de terminal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.id])

  // Conexión / reconexión.
  useEffect(() => {
    const term = termRef.current
    if (!term) return
    const state = useStore.getState()
    const current = state.tabs.find((item) => item.id === tab.id)
    if (tab.connectAttempt > 0) {
      term.write('\r\n\x1b[38;5;244m[reconectando…]\x1b[0m\r\n')
    }
    void window.api.ssh
      .connect({
        sessionId: tab.id,
        profileId: tab.profileId,
        cols: term.cols,
        rows: term.rows,
        password: current?.ephemeralPassword,
        passphrase: current?.ephemeralPassphrase
      })
      .catch((error: unknown) => {
        useStore.getState().setTabConnection(tab.id, {
          status: 'error',
          message: error instanceof Error ? error.message : 'No se pudo iniciar la conexión.'
        })
      })
  }, [tab.id, tab.profileId, tab.connectAttempt])

  // Ajustes visuales del terminal.
  useEffect(() => {
    const term = termRef.current
    if (!term) return
    term.options.fontFamily = fontStack
    term.options.fontSize = settings.fontSize
    term.options.cursorStyle = settings.cursorStyle
    term.options.cursorBlink = settings.cursorBlink
    term.options.scrollback = settings.scrollback
    term.options.theme = terminalTheme(resolvedTheme)
    const frame = window.requestAnimationFrame(() => {
      if (isActiveRef.current) {
        try {
          fitRef.current?.fit()
        } catch {
          // Ignorado.
        }
      }
      ghostRefreshRef.current?.()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [
    fontStack,
    settings.fontSize,
    settings.cursorStyle,
    settings.cursorBlink,
    settings.scrollback,
    resolvedTheme
  ])

  // Al activar una pestaña hay que recalcular el tamaño.
  useEffect(() => {
    isActiveRef.current = isActive
    if (!isActive) {
      setGhost(null)
      ghostRef.current = null
      return
    }
    const frame = window.requestAnimationFrame(() => {
      const term = termRef.current
      try {
        fitRef.current?.fit()
        term?.refresh(0, Math.max(0, term.rows - 1))
        term?.focus()
      } catch {
        // Ignorado.
      }
      ghostRefreshRef.current?.()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [isActive])

  const openPalette = (): void => {
    setPaletteOpen(true)
    setPaletteQuery('')
    setPaletteIndex(0)
    setGhost(null)
    ghostRef.current = null
  }

  const closePalette = (): void => {
    setPaletteOpen(false)
    window.setTimeout(() => {
      termRef.current?.focus()
      ghostRefreshRef.current?.()
    }, 10)
  }

  const insertSuggestion = (suggestion: Suggestion, run: boolean): void => {
    const term = termRef.current
    if (!term) return
    window.api.ssh.write(tab.id, `\x15${suggestion.command}${run ? '\r' : ''}`)
    bufferRef.current = {
      text: run ? '' : suggestion.command,
      cursor: run ? 0 : suggestion.command.length,
      trusted: true,
      echoConfirmed: false
    }
    if (run) useStore.getState().recordCommand(tab.profileId, suggestion.command)
    closePalette()
  }

  const authLabel =
    profile?.authMethod === 'key'
      ? 'Clave pública'
      : profile?.authMethod === 'agent'
        ? 'Agente SSH'
        : 'Contraseña'

  return (
    <div className="terminal-shell">
      <div className="terminal-toolbar">
        <div className="terminal-title">
          <StatusDot status={tab.status} />
          <div className="terminal-title-copy">
            <span className="terminal-name">{tab.profileName}</span>
            <span className="terminal-sub">
              {tab.username}@{formatEndpoint(tab.host, tab.port)}
            </span>
          </div>
        </div>
        <div className="terminal-actions">
          <button
            type="button"
            className="suggest-button"
            onClick={openPalette}
            title="Sugerencias de comandos (Ctrl+Espacio)"
          >
            <Sparkles size={14} />
            Sugerencias
            <kbd>Ctrl Espacio</kbd>
          </button>
          <span className="toolbar-divider" />
          <IconButton
            label="Copiar selección (Ctrl+C / Ctrl+Shift+C)"
            onClick={() => void copySelection()}
          >
            <Copy size={15} />
          </IconButton>
          <IconButton
            label="Pegar (Ctrl+V / Ctrl+Shift+V)"
            onClick={() => void pasteClipboard()}
          >
            <ClipboardPaste size={15} />
          </IconButton>
          <IconButton
            label="Reconectar"
            onClick={() => useStore.getState().reconnectTab(tab.id)}
            disabled={tab.status === 'connecting'}
          >
            <RefreshCw size={15} className={tab.status === 'connecting' ? 'spin' : ''} />
          </IconButton>
          <IconButton
            label="Cerrar pestaña"
            tone="danger"
            onClick={() => useStore.getState().closeTab(tab.id)}
          >
            <X size={15} />
          </IconButton>
        </div>
      </div>

      {tab.status === 'error' && tab.message ? (
        <div className="terminal-alert">
          <TriangleAlert size={15} />
          <span>{tab.message}</span>
          <button
            type="button"
            className="ghost-button small"
            onClick={() => useStore.getState().reconnectTab(tab.id)}
          >
            <RefreshCw size={13} /> Reintentar
          </button>
        </div>
      ) : null}

      {tab.status === 'closed' && tab.message ? (
        <div className="terminal-alert subtle">
          <CircleAlert size={14} />
          <span>{tab.message}</span>
          <button
            type="button"
            className="ghost-button small"
            onClick={() => useStore.getState().reconnectTab(tab.id)}
          >
            <RefreshCw size={13} /> Reconectar
          </button>
        </div>
      ) : null}

      <div className="terminal-stage" ref={stageRef}>
        <div className="terminal-host" ref={hostRef} />
        {ghost ? (
          <div
            className="ghost-suggestion"
            style={{
              left: ghost.left,
              top: ghost.top,
              height: ghost.height,
              lineHeight: `${ghost.height}px`,
              fontFamily: fontStack,
              fontSize: `${settings.fontSize}px`
            }}
            aria-hidden="true"
          >
            <span className="ghost-text">{ghost.displaySuffix}</span>
            <span className="ghost-hint">→</span>
          </div>
        ) : null}

        {paletteOpen ? (
          <CommandPalette
            query={paletteQuery}
            onQueryChange={setPaletteQuery}
            suggestions={suggestions}
            activeIndex={paletteIndex}
            onActiveIndexChange={setPaletteIndex}
            onSelect={insertSuggestion}
            onClose={closePalette}
          />
        ) : null}

        {contextMenu ? (
          <div
            className="terminal-context-menu"
            style={{
              left: Math.min(contextMenu.x, window.innerWidth - 190),
              top: Math.min(contextMenu.y, window.innerHeight - 170)
            }}
            onClick={(e) => e.stopPropagation()}
            role="menu"
            aria-label="Opciones de terminal"
          >
            <button
              type="button"
              className="context-menu-item"
              disabled={!contextMenu.hasSelection}
              onClick={() => {
                void copySelection()
                setContextMenu(null)
                termRef.current?.focus()
              }}
              role="menuitem"
            >
              <Copy size={14} />
              <span>Copiar</span>
              <kbd>Ctrl+C</kbd>
            </button>
            <button
              type="button"
              className="context-menu-item"
              onClick={() => {
                void pasteClipboard()
                setContextMenu(null)
                termRef.current?.focus()
              }}
              role="menuitem"
            >
              <ClipboardPaste size={14} />
              <span>Pegar</span>
              <kbd>Ctrl+V</kbd>
            </button>
            <div className="context-menu-separator" />
            <button
              type="button"
              className="context-menu-item"
              onClick={() => {
                termRef.current?.selectAll()
                setContextMenu(null)
                termRef.current?.focus()
              }}
              role="menuitem"
            >
              <SquareCheck size={14} />
              <span>Seleccionar todo</span>
            </button>
            <button
              type="button"
              className="context-menu-item"
              onClick={() => {
                termRef.current?.clear()
                setContextMenu(null)
                termRef.current?.focus()
              }}
              role="menuitem"
            >
              <Eraser size={14} />
              <span>Limpiar terminal</span>
            </button>
          </div>
        ) : null}
      </div>

      <div className="terminal-statusbar">
        <span className={`status-text status-text--${tab.status}`}>
          <StatusDot status={tab.status} />
          {statusLabel(tab.status)}
        </span>
        <span className="status-divider" />
        <span className="status-meta">
          {tab.username}@{formatEndpoint(tab.host, tab.port)}
        </span>
        <span className="status-chip">{authLabel}</span>
        <span className="status-spacer" />
        <span className="status-tip">
          <Lock size={11} /> Historial local
        </span>
        <span className="status-tip">
          <Sparkles size={11} /> Ctrl+Espacio
        </span>
        <span className="status-tip">→ acepta sugerencia</span>
      </div>
    </div>
  )
}
