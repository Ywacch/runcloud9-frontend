import { useEffect, useRef } from 'react'
import { connectLogsWS } from '../../lib/api'
import { useCanvasStore } from '../stores/canvasStore'
import { useLogStore, type RawLogLine } from '../stores/logStore'
import { shouldVerifyDeploymentAfterWsRetries } from './wsMaxRetryPolicy'
import { scheduleWsReconnectAfterMaxRetries } from './wsMaxRetryReconnect'
import {
  WS_STALE_CHECK_INTERVAL_MS,
  isWsConnectionStale,
  wsReconnectDelayMs,
} from './wsStaleWatchdog'

function isLogLine(x: unknown): x is RawLogLine {
  if (typeof x !== 'object' || x === null) return false
  const o = x as Record<string, unknown>
  const fieldsOk =
    o.fields === undefined ||
    (typeof o.fields === 'object' && o.fields !== null && !Array.isArray(o.fields))
  const levelOk = o.level === undefined || typeof o.level === 'string'
  const podOk = o.pod === undefined || typeof o.pod === 'string'
  return (
    typeof o.timestamp === 'string' &&
    typeof o.component === 'string' &&
    typeof o.message === 'string' &&
    fieldsOk &&
    levelOk &&
    podOk
  )
}

function ingestPayload(raw: unknown): void {
  const store = useLogStore.getState()
  if (Array.isArray(raw)) {
    const lines = raw.filter(isLogLine)
    if (lines.length) store.addBatch(lines)
    return
  }
  if (isLogLine(raw)) store.addLog(raw)
}

export function useLogSync(deploymentId: string | null): void {
  const retryRef = useRef(0)
  const wsRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFrameAtRef = useRef(0)
  const connectedAtRef = useRef(0)
  const staleCloseRef = useRef(false)
  const staleCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    retryRef.current = 0
    lastFrameAtRef.current = 0
    connectedAtRef.current = 0
    staleCloseRef.current = false

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
        const ws = wsRef.current
        if (!ws) return
        if (
          isWsConnectionStale(ws.readyState, lastFrameAtRef.current, Date.now(), {
            connectedAt: connectedAtRef.current,
          })
        ) {
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
      closeWs()
      return
    }

    const connect = () => {
      clearTimer()
      clearStaleCheck()
      staleCloseRef.current = false
      closeWs()

      const ws = connectLogsWS(deploymentId)
      wsRef.current = ws
      startStaleCheck()

      ws.onmessage = (ev) => {
        retryRef.current = 0
        lastFrameAtRef.current = Date.now()
        try {
          const data = JSON.parse(ev.data as string) as unknown
          ingestPayload(data)
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
        if (useCanvasStore.getState().deploymentId !== deploymentId) return
        if (wasStaleClose) {
          retryRef.current = 0
          timerRef.current = setTimeout(
            connect,
            wsReconnectDelayMs(0, true),
          )
          return
        }
        if (shouldVerifyDeploymentAfterWsRetries(retryRef.current)) {
          scheduleWsReconnectAfterMaxRetries({
            deploymentId,
            warningMessage: 'Live logs connection dropped. Reconnecting...',
            retryRef,
            timerRef,
            connect,
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
      closeWs()
    }
  }, [deploymentId])
}
