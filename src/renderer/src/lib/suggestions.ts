import { BUILTIN_SNIPPETS } from '@shared/builtins'
import type { HistoryEntry, HistoryResult, Snippet } from '@shared/types'
import { fuzzyMatch } from './fuzzy'

export interface Suggestion {
  key: string
  name: string
  command: string
  description: string
  source: 'history' | 'snippet'
  count: number
  lastUsedAt: number
  score: number
  positions: number[]
}

interface HistoryCandidate {
  command: string
  count: number
  lastUsedAt: number
  rank: number
}

function historyCandidates(history: HistoryResult | undefined): HistoryCandidate[] {
  if (!history) return []
  const seen = new Set<string>()
  const result: HistoryCandidate[] = []
  const add = (entry: HistoryEntry, rank: number): void => {
    if (seen.has(entry.command)) return
    seen.add(entry.command)
    result.push({
      command: entry.command,
      count: entry.count,
      lastUsedAt: entry.lastUsedAt,
      rank
    })
  }
  history.profile.forEach((entry, index) => add(entry, index))
  history.global.forEach((entry, index) => add(entry, index + 40))
  return result
}

function ageBonus(lastUsedAt: number): number {
  const ageDays = Math.max(0, (Date.now() - lastUsedAt) / 86_400_000)
  return Math.max(0, 12 - ageDays * 0.4)
}

export function buildSuggestions(
  query: string,
  history: HistoryResult | undefined,
  customSnippets: Snippet[],
  limit = 40
): Suggestion[] {
  const q = query.trim()
  const historyItems = historyCandidates(history)
  const snippets = [...customSnippets, ...BUILTIN_SNIPPETS]
  const byCommand = new Map<string, Suggestion>()

  for (const item of historyItems) {
    const match = q ? fuzzyMatch(q, item.command) : null
    if (q && !match) continue
    byCommand.set(item.command, {
      key: `history:${item.command}`,
      name: item.command,
      command: item.command,
      description:
        item.count > 1 ? `Usado ${item.count} veces en este servidor` : 'Usado recientemente',
      source: 'history',
      count: item.count,
      lastUsedAt: item.lastUsedAt,
      score: (q && match ? match.score : 0) + (q ? 0 : 1000 - item.rank) + ageBonus(item.lastUsedAt) + item.count * 0.3,
      positions: match?.positions ?? []
    })
  }

  snippets.forEach((snippet, index) => {
    const commandMatch = q ? fuzzyMatch(q, snippet.command) : null
    const nameMatch = q ? fuzzyMatch(q, snippet.name) : null
    if (q && !commandMatch && !nameMatch) return

    const base = commandMatch?.score ?? (nameMatch ? nameMatch.score * 0.6 : 0)
    const existing = byCommand.get(snippet.command)
    const score = base + (q ? 0 : 700 - index) + (existing ? 20 : 0)
    byCommand.set(snippet.command, {
      key: `snippet:${snippet.id}`,
      name: snippet.name,
      command: snippet.command,
      description: snippet.description,
      source: 'snippet',
      count: existing?.count ?? 0,
      lastUsedAt: existing?.lastUsedAt ?? 0,
      score,
      positions: commandMatch?.positions ?? []
    })
  })

  return [...byCommand.values()]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return b.lastUsedAt - a.lastUsedAt
    })
    .slice(0, limit)
}

export function findGhostCommand(
  buffer: string,
  history: HistoryResult | undefined,
  customSnippets: Snippet[]
): string | null {
  const typed = buffer.trimEnd()
  if (typed.length < 2 || typed.includes('\n')) return null

  const candidates = historyCandidates(history)
  let best: { command: string; score: number } | null = null

  for (const item of candidates) {
    if (item.command.length <= typed.length) continue
    if (item.command.length > 500) continue
    if (!item.command.startsWith(typed)) continue
    const score = 1000 - item.rank + item.count * 3 + ageBonus(item.lastUsedAt) * 2
    if (!best || score > best.score) best = { command: item.command, score }
  }

  const snippets = [...customSnippets, ...BUILTIN_SNIPPETS]
  snippets.forEach((snippet, index) => {
    if (snippet.command.length <= typed.length) return
    if (snippet.command.length > 500) return
    if (!snippet.command.startsWith(typed)) return
    const score = 300 - index
    if (!best || score > best.score) best = { command: snippet.command, score }
  })

  return best?.command ?? null
}
