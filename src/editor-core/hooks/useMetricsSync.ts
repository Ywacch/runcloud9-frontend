import { useEffect, useRef } from 'react'
import { connectMetricsSSE, connectMetricsWS, getDeployment } from '../../lib/api'
import {
  exitLiveSessionDueToRemoteEnd,
  isTerminalDeploymentStatus,
} from '../../lib/sessionCapture'
import { saveWsEventsJson } from '../../lib/wsEventsPersist'
import { nextStreamTransport, sseStreamsEnabled } from '../../lib/streamTransport'
import { useCanvasStore } from '../stores/canvasStore'
import { useMetricsStore } from '../stores/metricsStore'
import {
  isMetricsPlaybackEnabled,
  WS_TRANSPORT_DEAD_MS,
} from '../playback/playbackConfig'
import {
  WS_STALE_CHECK_INTERVAL_MS,
  isMetricsDataDegraded,
  isWsConnectionStale,
  wsReconnectDelayMs,
} from './wsStaleWatchdog'
import { markEventsFired } from '../playback/eventPlayback'
import {
  pushBufferedSample,
  reconnectPlaybackBuffer,
  startPlaybackLoop,
  stopPlaybackLoop,
} from '../playback/playbackLoop'
import {
  applyWsFrameToStore,
  parseServerTimestamp,
} from '../playback/wsMetricsFrame'
import { parseMetricsStreamPayload } from '../playback/ssePayload'
import type { WsDeploymentMetrics } from '../playback/wsMetricsTypes'

const TRANSPORT_RECONNECT_WARNING =
  'Live metrics connection dropped. Reconnecting...'

const EVENTSOURCE_CONNECTING = 0
const EVENTSOURCE_CLOSED = 2

type MetricsStream = WebSocket | EventSource

function streamReadyState(stream: MetricsStream): number {
  return stream.readyState
}

function ingestWsFrame(payload: WsDeploymentMetrics): void {
  const playback = isMetricsPlaybackEnabled()

  // Always append chart history from the WS frame (same source as headlines).
  // Playback owns event timing only — not chart series — so inspector graphs
  // cannot stay empty when headlines are already updating.
  if (playback) {
    const events = applyWsFrameToStore(payload, {
      appendCharts: true,
      pushEvents: false,
    })
    pushBufferedSample({
      receivedAt: Date.now(),
      serverTimestamp: parseServerTimestamp(payload),
      payload,
      events,
    })
    return
  }

  applyWsFrameToStore(payload, { appendCharts: true, pushEvents: true })
}

export function useMetricsSync(deploymentId: string | null): void {
  const retryRef = useRef(0)
  const failedOpensRef = useRef(0)
  const streamRef = useRef<MetricsStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFrameAtRef = useRef(0)
  const connectedAtRef = useRef(0)
  const staleCloseRef = useRef(false)
  const staleCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastPayloadRef = useRef({ snapshotAgeMs: 0, collectPending: false })

  useEffect(() => {
    retryRef.current = 0
    failedOpensRef.current = 0
    lastFrameAtRef.current = 0
    connectedAtRef.current = 0
    staleCloseRef.current = false
    lastPayloadRef.current = { snapshotAgeMs: 0, collectPending: false }

    const clearPersistTimer = () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current)
        persistTimerRef.current = null
      }
    }

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const clearStaleCheck = () => {
      if (staleCheckRef.current) {
        clearInterval(staleCheckRef.current)
        staleCheckRef.current = null
      }
    }

    const startStaleCheck = () => {
      clearStaleCheck()
      lastFrameAtRef.current = 0
      connectedAtRef.current = Date.now()
      staleCheckRef.current = setInterval(() => {
        const stream = streamRef.current
        if (!stream) return
        const store = useMetricsStore.getState()
        const now = Date.now()
        if (
          isWsConnectionStale(
            streamReadyState(stream),
            lastFrameAtRef.current,
            now,
            {
              connectedAt: connectedAtRef.current,
              staleThresholdMs: WS_TRANSPORT_DEAD_MS,
            },
          )
        ) {
          store.setStreamWarning(TRANSPORT_RECONNECT_WARNING)
          staleCloseRef.current = true
          retryRef.current = 0
          if (stream instanceof WebSocket) {
            stream.close()
          } else {
            stream.close()
          }
          return
        }
        const { snapshotAgeMs, collectPending } = lastPayloadRef.current
        if (isMetricsDataDegraded(snapshotAgeMs, collectPending)) {
          store.setMetricsDegraded(true)
          return
        }
        store.setMetricsDegraded(false)
        const warning = store.streamWarning
        if (
          warning === TRANSPORT_RECONNECT_WARNING ||
          warning === 'Reconnecting live metrics…'
        ) {
          store.setStreamWarning(null)
        }
      }, WS_STALE_CHECK_INTERVAL_MS)
    }

    const closeStream = () => {
      const stream = streamRef.current
      if (!stream) return
      if (stream instanceof WebSocket) {
        stream.onopen = null
        stream.onclose = null
        stream.onerror = null
        stream.onmessage = null
        stream.close()
      } else {
        stream.onopen = null
        stream.onmessage = null
        stream.onerror = null
        stream.close()
      }
      streamRef.current = null
    }

    if (!deploymentId) {
      clearTimer()
      clearStaleCheck()
      clearPersistTimer()
      closeStream()
      stopPlaybackLoop()
      useMetricsStore.getState().setStreamWarning(null)
      return
    }

    if (isMetricsPlaybackEnabled()) {
      startPlaybackLoop()
    }

    const schedulePersistWsEvents = () => {
      clearPersistTimer()
      persistTimerRef.current = setTimeout(() => {
        persistTimerRef.current = null
        const evs = useMetricsStore.getState().events
        saveWsEventsJson(deploymentId, JSON.stringify(evs))
      }, 350)
    }

    const handleMetricsMessage = (raw: string) => {
      retryRef.current = 0
      failedOpensRef.current = 0
      lastFrameAtRef.current = Date.now()
      try {
        const data = parseMetricsStreamPayload(raw)
        lastPayloadRef.current = {
          snapshotAgeMs: Number(data.snapshotAgeMs ?? 0),
          collectPending: Boolean(data.collectPending),
        }
        ingestWsFrame(data)
        schedulePersistWsEvents()
      } catch {
        /* ignore bad frame; transport liveness still updated above */
      }
    }

    const onStreamOpen = () => {
      retryRef.current = 0
      failedOpensRef.current = 0
      const m = useMetricsStore.getState()
      if (m.events.length === 0) {
        m.restorePersistedWsEvents(deploymentId)
      }
      if (isMetricsPlaybackEnabled()) {
        markEventsFired(useMetricsStore.getState().events)
      }
    }

    const scheduleReconnectAfterClose = () => {
      streamRef.current = null
      clearStaleCheck()
      const wasStaleClose = staleCloseRef.current
      staleCloseRef.current = false
      const st = useCanvasStore.getState()
      if (st.deploymentId !== deploymentId) return
      if (wasStaleClose) {
        const delay = wsReconnectDelayMs(retryRef.current)
        retryRef.current += 1
        timerRef.current = setTimeout(connect, delay)
        return
      }
      const maxRetries = 5
      if (retryRef.current >= maxRetries) {
        useMetricsStore
          .getState()
          .setStreamWarning(TRANSPORT_RECONNECT_WARNING)
        void getDeployment(deploymentId)
          .then((dep) => {
            if (isTerminalDeploymentStatus(dep.status)) {
              exitLiveSessionDueToRemoteEnd()
              return
            }
            retryRef.current = 0
            timerRef.current = setTimeout(connect, 2000)
          })
          .catch(() => {
            retryRef.current = 0
            timerRef.current = setTimeout(connect, 2000)
          })
        return
      }
      const delay = wsReconnectDelayMs(retryRef.current, false)
      retryRef.current += 1
      timerRef.current = setTimeout(connect, delay)
    }

    const connect = () => {
      clearTimer()
      clearStaleCheck()
      staleCloseRef.current = false
      closeStream()
      if (isMetricsPlaybackEnabled()) {
        reconnectPlaybackBuffer()
      }

      const flagOn = sseStreamsEnabled()
      const transport = nextStreamTransport(flagOn, failedOpensRef.current)
      if (flagOn && failedOpensRef.current >= 2) {
        useMetricsStore.getState().setStreamWarning(TRANSPORT_RECONNECT_WARNING)
      }

      if (transport === 'sse') {
        const es = connectMetricsSSE(deploymentId)
        streamRef.current = es
        startStaleCheck()

        es.onopen = () => {
          onStreamOpen()
        }

        es.onmessage = (ev) => {
          handleMetricsMessage(ev.data)
        }

        es.onerror = () => {
          if (es.readyState === EVENTSOURCE_CONNECTING) {
            failedOpensRef.current += 1
            es.close()
            streamRef.current = null
            clearStaleCheck()
            const delay = wsReconnectDelayMs(retryRef.current)
            retryRef.current += 1
            timerRef.current = setTimeout(connect, delay)
            return
          }
          if (es.readyState === EVENTSOURCE_CLOSED) {
            scheduleReconnectAfterClose()
          }
        }
        return
      }

      const ws = connectMetricsWS(deploymentId)
      streamRef.current = ws
      startStaleCheck()

      ws.onopen = () => {
        onStreamOpen()
      }

      ws.onmessage = (ev) => {
        handleMetricsMessage(ev.data as string)
      }

      ws.onerror = () => {
        /* onclose will handle reconnect */
      }

      ws.onclose = () => {
        scheduleReconnectAfterClose()
      }
    }

    connect()

    return () => {
      clearTimer()
      clearStaleCheck()
      clearPersistTimer()
      closeStream()
      stopPlaybackLoop()
    }
  }, [deploymentId])
}