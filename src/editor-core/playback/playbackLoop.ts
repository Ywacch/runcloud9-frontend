import { useCanvasStore } from '../stores/canvasStore'
import { useMetricsStore } from '../stores/metricsStore'
import {
  enqueuePlaybackEvents,
  firePlaybackEventsUpTo,
  resetEventPlayback,
  clearPendingPlaybackEvents,
} from './eventPlayback'
import {
  interpolateNodeBuckets,
  interpolateSystemSample,
} from './interpolate'
import { MetricsBuffer } from './MetricsBuffer'
import {
  BUFFER_LAG_MS,
  isMetricsPlaybackEnabled,
  MAX_DELTA_MS,
  STALE_THRESHOLD_MS,
} from './playbackConfig'
import { resetTweenStore } from './tweenStore'
import type { BufferedSample } from './wsMetricsTypes'

const buffer = new MetricsBuffer()

let playheadMs = 0
let rafId = 0
let lastFrameMs = 0
let loopActive = false
let lastWallReceivedMs = 0
let reconnectCatchUp = false

export function getMetricsBuffer(): MetricsBuffer {
  return buffer
}

export function getPlayheadMs(): number {
  return playheadMs
}

export function getLastWallReceivedMs(): number {
  return lastWallReceivedMs
}

export function resetPlaybackState(): void {
  buffer.clear()
  playheadMs = 0
  lastFrameMs = 0
  lastWallReceivedMs = 0
  reconnectCatchUp = false
  clearPendingPlaybackEvents()
  useMetricsStore.getState().setChartFrozen(false)
  useMetricsStore.getState().setPlaybackCatchingUp(false)
}

/** Reconnect: clear buffer + pending events but keep playhead position. */
export function reconnectPlaybackBuffer(): void {
  buffer.clear()
  clearPendingPlaybackEvents()
  reconnectCatchUp = true
  useMetricsStore.getState().setChartFrozen(true)
  useMetricsStore.getState().setPlaybackCatchingUp(true)
}

export function noteWallFrameReceived(at = Date.now()): void {
  lastWallReceivedMs = at
}

function tryRecoverAfterReconnect(): void {
  if (!reconnectCatchUp || buffer.length < 2) return

  const samples = buffer.getSamples()
  const second = samples[1]
  if (!second) return

  const snapTarget = second.serverTimestamp - BUFFER_LAG_MS
  if (
    playheadMs > 0 &&
    Math.abs(snapTarget - playheadMs) > 2 * BUFFER_LAG_MS
  ) {
    playheadMs = snapTarget
  }

  reconnectCatchUp = false
  useMetricsStore.getState().setPlaybackCatchingUp(false)
}

export function pushBufferedSample(sample: BufferedSample): void {
  noteWallFrameReceived(sample.receivedAt)
  buffer.add(sample)
  if (sample.events.length > 0) {
    enqueuePlaybackEvents(sample.events, playheadMs)
  }
  tryRecoverAfterReconnect()
}

function shouldRunPlayback(): boolean {
  return (
    isMetricsPlaybackEnabled() &&
    useCanvasStore.getState().mode === 'live'
  )
}

function isStreamStale(now: number): boolean {
  return (
    lastWallReceivedMs > 0 &&
    now - lastWallReceivedMs > STALE_THRESHOLD_MS
  )
}

function advancePlaybackFrame(now: number): void {
  if (!shouldRunPlayback()) return

  const store = useMetricsStore.getState()
  const deltaMs = lastFrameMs > 0 ? now - lastFrameMs : 16
  lastFrameMs = now
  const cappedDelta = Math.min(deltaMs, MAX_DELTA_MS)

  const targetPlayhead = now - BUFFER_LAG_MS
  if (playheadMs === 0) {
    playheadMs = targetPlayhead
  }

  const stale = isStreamStale(now)
  if (stale) {
    store.setStreamWarning('Connection stale — metrics may be outdated')
  }

  firePlaybackEventsUpTo(playheadMs)

  const underrunFrozen = buffer.isFrozen(playheadMs)
  const chartsFrozen = underrunFrozen || stale || reconnectCatchUp
  store.setChartFrozen(chartsFrozen)

  if (underrunFrozen || reconnectCatchUp) return

  playheadMs = Math.min(playheadMs + cappedDelta, targetPlayhead)

  firePlaybackEventsUpTo(playheadMs)

  if (stale) return

  const bracket = buffer.samplesAroundPlayhead(playheadMs)
  if (!bracket) return

  const commitKey = bracket.before.serverTimestamp
  const nodeBuckets = interpolateNodeBuckets(bracket, playheadMs)

  for (const [nodeId, bucket] of Object.entries(nodeBuckets)) {
    store.pushPlaybackChartPoint(nodeId, bucket, commitKey)
  }

  const systemSample = interpolateSystemSample(bracket, playheadMs)
  if (systemSample) {
    store.pushPlaybackSystemSample(systemSample, commitKey)
  }
}

function tick(now: number): void {
  rafId = requestAnimationFrame(tick)
  advancePlaybackFrame(now)
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
  resetEventPlayback()
  resetTweenStore()
}

/** Test hook: advance one playback frame at a wall time. */
export function runPlaybackTickForTest(now: number): void {
  advancePlaybackFrame(now)
}
