import { describe, expect, it, beforeEach } from 'vitest'
import { useCanvasStore } from '../stores/canvasStore'
import { useMetricsStore } from '../stores/metricsStore'
import { BUFFER_LAG_MS, STALE_THRESHOLD_MS } from './playbackConfig'
import { resetEventPlayback } from './eventPlayback'
import {
  getMetricsBuffer,
  getPlayheadMs,
  pushBufferedSample,
  reconnectPlaybackBuffer,
  resetPlaybackState,
  runPlaybackTickForTest,
} from './playbackLoop'
import type { BufferedSample } from './wsMetricsTypes'

function sample(ts: number): BufferedSample {
  return {
    receivedAt: ts,
    serverTimestamp: ts,
    payload: {
      timestamp: new Date(ts).toISOString(),
      components: { 'app-server': { requestRate: 10 } },
    },
    events: [],
  }
}

describe('playbackLoop reconnect', () => {
  beforeEach(() => {
    resetEventPlayback()
    resetPlaybackState()
    useCanvasStore.setState({ mode: 'live' })
    useMetricsStore.setState({ chartFrozen: false, streamWarning: null })
  })

  it('keeps playhead on reconnect while clearing buffer', () => {
    const now = 100_000
    pushBufferedSample(sample(now - 4000))
    pushBufferedSample(sample(now - 2000))
    runPlaybackTickForTest(now)
    const playheadBefore = getPlayheadMs()
    expect(playheadBefore).toBeGreaterThan(0)

    reconnectPlaybackBuffer()
    expect(getMetricsBuffer().length).toBe(0)
    expect(getPlayheadMs()).toBe(playheadBefore)
  })

  it('snaps playhead after reconnect when gap exceeds 2x buffer lag', () => {
    const base = 200_000
    pushBufferedSample(sample(base))
    pushBufferedSample(sample(base + 2000))
    runPlaybackTickForTest(base + 5000)
    const playheadBefore = getPlayheadMs()

    reconnectPlaybackBuffer()

    const recoveryBase = base + 60_000
    pushBufferedSample(sample(recoveryBase))
    pushBufferedSample(sample(recoveryBase + 2000))

    const snapTarget = recoveryBase + 2000 - BUFFER_LAG_MS
    if (Math.abs(snapTarget - playheadBefore) > 2 * BUFFER_LAG_MS) {
      expect(getPlayheadMs()).toBe(snapTarget)
    } else {
      expect(getPlayheadMs()).toBe(playheadBefore)
    }
  })
})

describe('playbackLoop stale stream', () => {
  beforeEach(() => {
    resetEventPlayback()
    resetPlaybackState()
    useCanvasStore.setState({ mode: 'live' })
    useMetricsStore.setState({
      chartFrozen: false,
      streamWarning: null,
      playbackCatchingUp: false,
    })
  })

  it('sets stream warning and freezes charts when wall frames stop', () => {
    const wall = 500_000
    pushBufferedSample(sample(wall - 10_000))
    pushBufferedSample(sample(wall - 8000))

    runPlaybackTickForTest(wall + STALE_THRESHOLD_MS + 1)

    expect(useMetricsStore.getState().streamWarning).toContain('stale')
    expect(useMetricsStore.getState().chartFrozen).toBe(true)
  })
})

describe('playbackLoop chart underrun', () => {
  beforeEach(() => {
    resetEventPlayback()
    resetPlaybackState()
    useCanvasStore.setState({ mode: 'live' })
    useMetricsStore.setState({
      chartFrozen: false,
      streamWarning: null,
      playbackCatchingUp: false,
    })
  })

  it('advances playhead in Unix wall-clock space (not rAF time origin)', () => {
    // Regression: rAF gives ~seconds since navigation; samples use Date.now().
    // Mixing them left charts frozen for the whole session.
    const wall = Date.UTC(2026, 6, 31, 12, 0, 0)
    pushBufferedSample(sample(wall - 4000))
    pushBufferedSample(sample(wall - 2000))
    pushBufferedSample(sample(wall))

    runPlaybackTickForTest(wall)

    expect(getPlayheadMs()).toBeGreaterThan(wall - BUFFER_LAG_MS - 1)
    expect(getPlayheadMs()).toBeLessThanOrEqual(wall - BUFFER_LAG_MS)
    expect(useMetricsStore.getState().chartFrozen).toBe(false)
  })
})
