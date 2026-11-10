import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { CornerDownLeft, Search, Sparkles, Terminal } from 'lucide-react'
import type { Suggestion } from '../lib/suggestions'
import { KeyHint } from './ui'

function Highlight({ text, positions }: { text: string; positions: number[] }): ReactNode {
  if (positions.length === 0) return <>{text}</>
  const marks = new Set(positions)
  return (
    <>
      {text.split('').map((char, index) =>
        marks.has(index) ? (
          <mark key={index} className="match">
            {char}
          </mark>
        ) : (
          char
        )
      )}
    </>
  )
}

export function CommandPalette({
  query,
  onQueryChange,
  suggestions,
  activeIndex,
  onActiveIndexChange,
  onSelect,
  onClose
}: {
  query: string
  onQueryChange: (value: string) => void
  suggestions: Suggestion[]
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  onSelect: (suggestion: Suggestion, run: boolean) => void
  onClose: () => void
}): ReactNode {
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      onActiveIndexChange(Math.min(activeIndex + 1, suggestions.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      onActiveIndexChange(Math.max(activeIndex - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const selected = suggestions[activeIndex]
      if (selected) onSelect(selected, event.ctrlKey || event.metaKey)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div
        className="command-palette"
        role="dialog"
        aria-label="Sugerencias de comandos"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="palette-input">
          <Sparkles size={17} className="palette-spark" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar comandos, recetas o historial…"
            spellCheck={false}
            autoComplete="off"
          />
          <KeyHint>Esc</KeyHint>
        </div>

        <div className="palette-list" ref={listRef}>
          {suggestions.length === 0 ? (
            <div className="palette-empty">
              <Search size={20} />
              <p>No hay coincidencias</p>
              <span>Escribe otra palabra o guarda recetas en Ajustes.</span>
            </div>
          ) : (
            suggestions.map((suggestion, index) => (
              <button
                key={suggestion.key}
                type="button"
                data-active={index === activeIndex}
                className={`palette-item ${index === activeIndex ? 'is-active' : ''}`}
                onMouseMove={() => onActiveIndexChange(index)}
                onClick={() => onSelect(suggestion, false)}
              >
                <span className={`palette-source palette-source--${suggestion.source}`}>
                  {suggestion.source === 'history' ? <Terminal size={13} /> : <Sparkles size={13} />}
                </span>
                <span className="palette-copy">
                  <span className="palette-command">
                    <Highlight text={suggestion.command} positions={suggestion.positions} />
                  </span>
                  <span className="palette-desc">
                    {suggestion.description || suggestion.name}
                    {suggestion.count > 1 ? ` · ${suggestion.count}×` : ''}
                  </span>
                </span>
                <span className="palette-badge">
                  {suggestion.source === 'history' ? 'historial' : 'receta'}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="palette-footer">
          <span>
            <KeyHint>↑</KeyHint>
            <KeyHint>↓</KeyHint> navegar
          </span>
          <span>
            <CornerDownLeft size={12} /> insertar
          </span>
          <span>
            <KeyHint>Ctrl</KeyHint>
            <CornerDownLeft size={12} /> insertar y ejecutar
          </span>
        </div>
      </div>
    </div>
  )
}
