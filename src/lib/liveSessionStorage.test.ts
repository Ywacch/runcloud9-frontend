import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CanvasSnapshot } from '../editor-core/stores/canvasStore'
import {
  clearLiveSessionPersist,
  persistLiveSession,
  readLiveSessionPersist,
  readPersistedProvisionStartedAt,
} from './liveSessionStorage'

const snapshot: CanvasSnapshot = {
  version: '1.0',
  nodes: [],
  edges: [],
  exportedAt: '2026-01-01T00:00:00.000Z',
}

function installLocalStorageMock() {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
  })
}

beforeEach(() => {
  installLocalStorageMock()
})

afterEach(() => {
  clearLiveSessionPersist()
  vi.unstubAllGlobals()
})

describe('liveSessionStorage provision clock', () => {
  it('records provisionStartedAt on first persist', () => {
    const before = Date.now()
    persistLiveSession('dep-1', snapshot)
    const started = readPersistedProvisionStartedAt('dep-1')
    expect(started).toBeGreaterThanOrEqual(before)
    expect(readLiveSessionPersist()?.deploymentId).toBe('dep-1')
  })

  it('keeps the original provisionStartedAt across later persists', () => {
    persistLiveSession('dep-1', snapshot)
    const first = readPersistedProvisionStartedAt('dep-1')
    persistLiveSession('dep-1', { ...snapshot })
    expect(readPersistedProvisionStartedAt('dep-1')).toBe(first)
  })

  it('starts a new clock for a different deployment', () => {
    persistLiveSession('dep-1', snapshot)
    persistLiveSession('dep-2', snapshot)
    expect(readPersistedProvisionStartedAt('dep-2')).not.toBeNull()
    expect(readPersistedProvisionStartedAt('dep-1')).toBeNull()
  })
})
