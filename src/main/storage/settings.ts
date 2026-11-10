import {
  DEFAULT_SETTINGS,
  FONT_FAMILIES,
  type AppSettings,
  type CursorStyle,
  type ThemeMode
} from '../../shared/types'
import { asBoolean, asNumber, clampInt, isRecord } from '../util'
import { JsonStore } from './json-store'

const THEMES: ThemeMode[] = ['dark', 'light', 'system']
const CURSORS: CursorStyle[] = ['block', 'bar', 'underline']

const emptyFile = (): AppSettings => ({ ...DEFAULT_SETTINGS })

function sanitize(raw: unknown): AppSettings | null {
  if (!isRecord(raw)) return null
  const theme = THEMES.includes(raw.theme as ThemeMode)
    ? (raw.theme as ThemeMode)
    : DEFAULT_SETTINGS.theme
  const cursorStyle = CURSORS.includes(raw.cursorStyle as CursorStyle)
    ? (raw.cursorStyle as CursorStyle)
    : DEFAULT_SETTINGS.cursorStyle
  const fontFamily =
    typeof raw.fontFamily === 'string' && raw.fontFamily in FONT_FAMILIES
      ? raw.fontFamily
      : DEFAULT_SETTINGS.fontFamily

  return {
    theme,
    fontSize: clampInt(asNumber(raw.fontSize, DEFAULT_SETTINGS.fontSize), 10, 26, DEFAULT_SETTINGS.fontSize),
    fontFamily,
    cursorStyle,
    cursorBlink: asBoolean(raw.cursorBlink, DEFAULT_SETTINGS.cursorBlink),
    copyOnSelect: asBoolean(raw.copyOnSelect, DEFAULT_SETTINGS.copyOnSelect),
    scrollback: clampInt(
      asNumber(raw.scrollback, DEFAULT_SETTINGS.scrollback),
      1000,
      50000,
      DEFAULT_SETTINGS.scrollback
    ),
    suggestionsEnabled: asBoolean(raw.suggestionsEnabled, DEFAULT_SETTINGS.suggestionsEnabled),
    ghostSuggestions: asBoolean(raw.ghostSuggestions, DEFAULT_SETTINGS.ghostSuggestions),
    saveHistory: asBoolean(raw.saveHistory, DEFAULT_SETTINGS.saveHistory),
    historyLimit: clampInt(
      asNumber(raw.historyLimit, DEFAULT_SETTINGS.historyLimit),
      100,
      5000,
      DEFAULT_SETTINGS.historyLimit
    )
  }
}

export class SettingsStore {
  private readonly store: JsonStore<AppSettings>

  constructor(file: string) {
    this.store = new JsonStore(file, emptyFile, sanitize)
  }

  get(): AppSettings {
    return this.store.read()
  }

  save(patch: Partial<AppSettings>): AppSettings {
    const next = sanitize({ ...this.get(), ...patch }) ?? emptyFile()
    this.store.write(next)
    return next
  }
}
