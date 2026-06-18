import { useCanvasStore } from '../stores/canvasStore'
import { useMetricsStore } from '../stores/metricsStore'
import {
  interpolateNodeBuckets,
  interpolateSystemSample,
} from './interpolate'
import { MetricsBuffer } from './MetricsBuffer'
import {
  BUFFER_LAG_MS,
  isMetricsPlaybackEnabled,
  MAX_DELTA_MS,
} from './playbackConfig'
import { resetTweenStore } from './tweenStore'
import type { BufferedSample } from './wsMetricsTypes'

const buffer = new MetricsBuffer()

let playheadMs = 0
let rafId = 0
let lastFrameMs = 0
let loopActive = false

export function getMetricsBuffer(): MetricsBuffer {
  return buffer
}

export function resetPlaybackState(): void {
  buffer.clear()
  playheadMs = 0
  lastFrameMs = 0
  useMetricsStore.getState().setChartFrozen(false)
}

export function pushBufferedSample(sample: BufferedSample): void {
  buffer.add(sample)
}

function shouldRunPlayback(): boolean {
  return (
    isMetricsPlaybackEnabled() &&
    useCanvasStore.getState().mode === 'live'
  )
}

function tick(now: number): void {
  rafId = requestAnimationFrame(tick)
  if (!shouldRunPlayback()) return

  const deltaMs = lastFrameMs > 0 ? now - lastFrameMs : 16
  lastFrameMs = now
  const cappedDelta = Math.min(deltaMs, MAX_DELTA_MS)

  const targetPlayhead = now - BUFFER_LAG_MS
  if (playheadMs === 0) {
    playheadMs = targetPlayhead
  }

  const frozen = buffer.isFrozen(playheadMs)
  useMetricsStore.getState().setChartFrozen(frozen)

  if (frozen) return

  playheadMs = Math.min(playheadMs + cappedDelta, targetPlayhead)

  const bracket = buffer.samplesAroundPlayhead(playheadMs)
  if (!bracket) return

  const commitKey = bracket.before.serverTimestamp
  const nodeBuckets = interpolateNodeBuckets(bracket, playheadMs)
  const store = useMetricsStore.getState()

  for (const [nodeId, bucket] of Object.entries(nodeBuckets)) {
    store.pushPlaybackChartPoint(nodeId, bucket, commitKey)
  }

  const systemSample = interpolateSystemSample(bracket, playheadMs)
  if (systemSample) {
    store.pushPlaybackSystemSample(systemSample, commitKey)
  }
}

export function startPlaybackLoop(): void {
  if (loopActive) return
  loopActive = true
  lastFrameMs = 0
  if (rafId === 0) {
    rafId = requestAnimationFrame(tick)
  }
}

export function stopPlaybackLoop(): void {
  loopActive = false
  if (rafId !== 0) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
  lastFrameMs = 0
}

export function clearPlaybackSession(): void {
  stopPlaybackLoop()
  resetPlaybackState()
  resetTweenStore()
}

/** Test hook: advance one playback frame at a wall time. */
export function runPlaybackTickForTest(now: number): void {
  tick(now)
}
