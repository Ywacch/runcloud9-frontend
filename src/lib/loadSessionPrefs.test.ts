import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  defaultActorParams,
  defaultScheduleId,
  DEV_LOADGEN_CONFIG,
  formatActorParamLabel,
  formatSchedulePhaseSummary,
  readLoadSessionPrefs,
  writeLoadSessionPrefs,
} from './loadSessionPrefs'

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
  vi.unstubAllGlobals()
})

describe('loadSessionPrefs helpers', () => {
  it('prefers steady schedule when present', () => {
    expect(defaultScheduleId(DEV_LOADGEN_CONFIG)).toBe('steady')
  })

  it('builds actor defaults from config', () => {
    expect(defaultActorParams(DEV_LOADGEN_CONFIG)).toEqual({
      celebrityPostPct: 5,
      readAfterPostBoost: 1,
    })
  })

  it('formats actor param labels', () => {
    expect(formatActorParamLabel('celebrityPostPct')).toBe('Celebrity post pct')
  })

  it('summarizes schedule phases', () => {
    const summary = formatSchedulePhaseSummary(DEV_LOADGEN_CONFIG.schedules![1]!.phases)
    expect(summary).toContain('60s ×1')
    expect(summary).toContain('30s ×4')
  })

  it('round-trips activeUsers and drops garbage values', () => {
    writeLoadSessionPrefs('dep-users', { rps: 50, activeUsers: 500 })
    expect(readLoadSessionPrefs('dep-users')).toMatchObject({
      rps: 50,
      activeUsers: 500,
    })
    const map = JSON.parse(localStorage.getItem('runcloud9_load_session_prefs')!) as Record<
      string,
      { rps: number; activeUsers?: unknown }
    >
    map['dep-bad'] = { rps: 40, activeUsers: 'nope' }
    localStorage.setItem('runcloud9_load_session_prefs', JSON.stringify(map))
    expect(readLoadSessionPrefs('dep-bad')).toMatchObject({ rps: 40 })
    expect(readLoadSessionPrefs('dep-bad')?.activeUsers).toBeUndefined()
    writeLoadSessionPrefs('dep-plain', { rps: 30 })
    expect(readLoadSessionPrefs('dep-plain')?.activeUsers).toBeUndefined()
  })

  it('persists conversations preference per deployment', () => {
    writeLoadSessionPrefs('dep-a', {
      rps: 40,
      conversations: false,
    })
    expect(readLoadSessionPrefs('dep-a')).toMatchObject({
      rps: 40,
      conversations: false,
    })
    writeLoadSessionPrefs('dep-b', { rps: 50 })
    expect(readLoadSessionPrefs('dep-b')?.conversations).toBeUndefined()
  })
})
