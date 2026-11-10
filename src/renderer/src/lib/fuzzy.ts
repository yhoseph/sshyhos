export interface FuzzyMatch {
  score: number
  positions: number[]
}

const SEPARATORS = new Set([' ', '/', '-', '.', '_', ':', '=', ',', '|', '&', ';'])

/**
 * Coincidencia por subsecuencia, con bonus para prefijos y límites de palabra.
 * Devuelve null si no aparece la consulta completa.
 */
export function fuzzyMatch(query: string, target: string): FuzzyMatch | null {
  const q = query.trim().toLowerCase()
  if (!q) return { score: 0, positions: [] }

  const lower = target.toLowerCase()
  const positions: number[] = []
  let score = 0
  let targetIndex = 0
  let previous = -2

  for (const char of q) {
    const found = lower.indexOf(char, targetIndex)
    if (found === -1) return null
    positions.push(found)

    if (found === 0 || SEPARATORS.has(lower[found - 1] ?? '')) score += 12
    if (found === previous + 1) score += 8
    score += Math.max(0, 6 - (found - targetIndex) * 0.2)
    previous = found
    targetIndex = found + 1
  }

  if (lower.startsWith(q)) score += 60
  else if (lower.split(/[\s/._:-]+/u).some((word) => word.startsWith(q))) score += 20

  score -= Math.min(14, target.length * 0.04)
  return { score, positions }
}
