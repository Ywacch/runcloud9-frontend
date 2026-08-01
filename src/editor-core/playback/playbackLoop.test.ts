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

  it('stays unfrozen when lag equals sample interval (one sample ahead)', () => {
    // WS collect ~2s + BUFFER_LAG 2s → typically one sample ahead of playhead.
    // Old isFrozen(<2 ahead) froze charts here; bracketed playhead must not.
    const t0 = 300_000
    pushBufferedSample(sample(t0))
    pushBufferedSample(sample(t0 + 2000))
    pushBufferedSample(sample(t0 + 4000))

    runPlaybackTickForTest(t0 + 4000)

    expect(useMetricsStore.getState().chartFrozen).toBe(false)
    expect(getPlayheadMs()).toBeGreaterThan(0)
  })
})
