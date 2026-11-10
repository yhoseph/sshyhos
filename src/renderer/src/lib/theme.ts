import { useEffect, useState } from 'react'
import { useStore } from '../store'

export type ResolvedTheme = 'dark' | 'light'

export function useResolvedTheme(): ResolvedTheme {
  const mode = useStore((state) => state.settings.theme)
  const [system, setSystem] = useState<ResolvedTheme>(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  )

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const update = (): void => setSystem(query.matches ? 'dark' : 'light')
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return mode === 'system' ? system : mode
}
