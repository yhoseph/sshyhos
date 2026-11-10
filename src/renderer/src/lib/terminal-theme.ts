import type { ITheme } from '@xterm/xterm'
import type { ResolvedTheme } from './theme'

const dark: ITheme = {
  background: '#0b0f14',
  foreground: '#d7e2ee',
  cursor: '#4ee1a0',
  cursorAccent: '#0b0f14',
  selectionBackground: 'rgba(78, 225, 160, 0.25)',
  selectionForeground: '#ffffff',
  black: '#0f1720',
  red: '#ff6b81',
  green: '#4ee1a0',
  yellow: '#f5c46b',
  blue: '#63b3ff',
  magenta: '#c792ea',
  cyan: '#5eead4',
  white: '#d7e2ee',
  brightBlack: '#5b6b7c',
  brightRed: '#ff8fa0',
  brightGreen: '#7ff0bd',
  brightYellow: '#ffd98a',
  brightBlue: '#8ccaff',
  brightMagenta: '#dbb2ff',
  brightCyan: '#8ff5e4',
  brightWhite: '#f1f7ff'
}

const light: ITheme = {
  background: '#f7f9fc',
  foreground: '#1b2634',
  cursor: '#0f8a61',
  cursorAccent: '#f7f9fc',
  selectionBackground: 'rgba(15, 138, 97, 0.18)',
  selectionForeground: '#10202c',
  black: '#243447',
  red: '#c53030',
  green: '#0f7b55',
  yellow: '#8a6100',
  blue: '#1d63b8',
  magenta: '#7b3fb0',
  cyan: '#0b7285',
  white: '#e8edf3',
  brightBlack: '#6b7c8f',
  brightRed: '#d64545',
  brightGreen: '#14916a',
  brightYellow: '#9a6f00',
  brightBlue: '#2b74c9',
  brightMagenta: '#8d4cc4',
  brightCyan: '#0d8496',
  brightWhite: '#ffffff'
}

export function terminalTheme(theme: ResolvedTheme): ITheme {
  return theme === 'light' ? light : dark
}
