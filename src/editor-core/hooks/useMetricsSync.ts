import { useEffect, useRef } from 'react'
import { connectMetricsWS, getDeployment } from '../../lib/api'
import {
  exitLiveSessionDueToRemoteEnd,
  isTerminalDeploymentStatus,
} from '../../lib/sessionCapture'
import { saveWsEventsJson } from '../../lib/wsEventsPersist'
import { useCanvasStore } from '../stores/canvasStore'
import { useMetricsStore } from '../stores/metricsStore'
import { isMetricsPlaybackEnabled } from '../playback/playbackConfig'
import {
  WS_STALE_CHECK_INTERVAL_MS,
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
import type { WsDeploymentMetrics } from '../playback/wsMetricsTypes'

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
  const wsRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFrameAtRef = useRef(0)
  const staleCloseRef = useRef(false)
  const staleCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    retryRef.current = 0
    lastFrameAtRef.current = 0
    staleCloseRef.current = false

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
      staleCheckRef.current = setInterval(() => {
        const ws = wsRef.current
        if (!ws) return
        if (
          isWsConnectionStale(ws.readyState, lastFrameAtRef.current, Date.now())
        ) {
          useMetricsStore
            .getState()
            .setStreamWarning('Reconnecting live metrics…')
          staleCloseRef.current = true
          retryRef.current = 0
          ws.close()
        }
      }, WS_STALE_CHECK_INTERVAL_MS)
    }

    const closeWs = () => {
      if (wsRef.current) {
        wsRef.current.onopen = null
        wsRef.current.onclose = null
        wsRef.current.onerror = null
        wsRef.current.onmessage = null
        wsRef.current.close()
        wsRef.current = null
      }
    }

    if (!deploymentId) {
      clearTimer()
      clearStaleCheck()
      clearPersistTimer()
      closeWs()
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

    const connect = () => {
      clearTimer()
      clearStaleCheck()
      staleCloseRef.current = false
      closeWs()
      if (isMetricsPlaybackEnabled()) {
        reconnectPlaybackBuffer()
      }

      const ws = connectMetricsWS(deploymentId)
      wsRef.current = ws
      startStaleCheck()

      ws.onopen = () => {
        retryRef.current = 0
        const m = useMetricsStore.getState()
        if (m.events.length === 0) {
          m.restorePersistedWsEvents(deploymentId)
        }
        if (isMetricsPlaybackEnabled()) {
          markEventsFired(useMetricsStore.getState().events)
        }
      }

      ws.onmessage = (ev) => {
        retryRef.current = 0
        lastFrameAtRef.current = Date.now()
        useMetricsStore.getState().setStreamWarning(null)
        try {
          const data = JSON.parse(ev.data as string) as WsDeploymentMetrics
          ingestWsFrame(data)
          schedulePersistWsEvents()
        } catch {
          /* ignore bad frame */
        }
      }

      ws.onerror = () => {
        /* onclose will handle reconnect */
      }

      ws.onclose = () => {
        wsRef.current = null
        clearStaleCheck()
        const wasStaleClose = staleCloseRef.current
        staleCloseRef.current = false
        const st = useCanvasStore.getState()
        if (st.deploymentId !== deploymentId) return
        if (wasStaleClose) {
          retryRef.current = 0
          timerRef.current = setTimeout(
            connect,
            wsReconnectDelayMs(0, true),
          )
          return
        }
        const maxRetries = 5
        if (retryRef.current >= maxRetries) {
          useMetricsStore
            .getState()
            .setStreamWarning('Live metrics connection dropped. Reconnecting...')
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
    }

    connect()

    return () => {
      clearTimer()
      clearStaleCheck()
      clearPersistTimer()
      closeWs()
      stopPlaybackLoop()
    }
  }, [deploymentId])
}
