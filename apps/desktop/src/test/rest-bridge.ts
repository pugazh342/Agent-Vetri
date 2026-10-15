import { vi } from 'vitest'

import type { VetriApiRequest } from '@/global'

/** Install a fake `window.vetriDesktop.api`, the preload bridge every REST helper sends through. */
export function installRestBridge(answer: (request: VetriApiRequest) => object) {
  const api = vi.fn(async (request: VetriApiRequest) => answer(request))

  Object.defineProperty(window, 'vetriDesktop', { configurable: true, value: { api } })

  return api
}
