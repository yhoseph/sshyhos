/// <reference types="vite/client" />

import type { SshYhosApi } from '@shared/types'

declare global {
  interface Window {
    api: SshYhosApi
  }
}

export {}
