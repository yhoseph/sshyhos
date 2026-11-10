import { randomUUID } from 'node:crypto'
import type { Snippet, SnippetInput } from '../../shared/types'
import { isRecord } from '../util'
import { JsonStore } from './json-store'

interface SnippetsFile {
  version: 1
  snippets: Snippet[]
}

const emptyFile: SnippetsFile = { version: 1, snippets: [] }

function parseSnippet(raw: unknown): Snippet | null {
  if (!isRecord(raw)) return null
  const name = typeof raw.name === 'string' ? raw.name : ''
  const command = typeof raw.command === 'string' ? raw.command : ''
  if (!name || !command) return null
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : randomUUID(),
    name,
    command,
    description: typeof raw.description === 'string' ? raw.description : '',
    builtin: false,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now()
  }
}

function parseSnippets(raw: unknown): SnippetsFile | null {
  if (!isRecord(raw) || !Array.isArray(raw.snippets)) return null
  const snippets: Snippet[] = []
  for (const item of raw.snippets) {
    const snippet = parseSnippet(item)
    if (snippet) snippets.push(snippet)
  }
  return { version: 1, snippets }
}

export class SnippetStore {
  private readonly store: JsonStore<SnippetsFile>

  constructor(file: string) {
    this.store = new JsonStore(file, () => emptyFile, parseSnippets)
  }

  list(): Snippet[] {
    return this.store
      .read()
      .snippets.map((snippet) => ({ ...snippet }))
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  save(input: SnippetInput): Snippet {
    const name = typeof input.name === 'string' ? input.name.trim().slice(0, 80) : ''
    const command = typeof input.command === 'string' ? input.command.trim().slice(0, 4000) : ''
    if (!name) throw new Error('Escribe un nombre para el comando.')
    if (!command) throw new Error('El comando no puede estar vacío.')

    const data = this.store.read()
    const existing = input.id ? data.snippets.find((item) => item.id === input.id) : undefined
    const snippet: Snippet = {
      id: existing?.id ?? randomUUID(),
      name,
      command,
      description:
        typeof input.description === 'string' ? input.description.trim().slice(0, 200) : '',
      builtin: false,
      createdAt: existing?.createdAt ?? Date.now()
    }

    const snippets = existing
      ? data.snippets.map((item) => (item.id === snippet.id ? snippet : item))
      : [...data.snippets, snippet]
    this.store.write({ version: 1, snippets })
    return { ...snippet }
  }

  remove(id: string): void {
    const data = this.store.read()
    const snippets = data.snippets.filter((item) => item.id !== id)
    if (snippets.length === data.snippets.length) return
    this.store.write({ version: 1, snippets })
  }
}
