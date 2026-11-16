import { useEffect, useRef } from 'react'
import { connectLogsSSE, connectLogsWS } from '../../lib/api'
import { nextStreamTransport, sseStreamsEnabled } from '../../lib/streamTransport'
import { useCanvasStore } from '../stores/canvasStore'
import { useLogStore, type RawLogLine } from '../stores/logStore'
import { shouldVerifyDeploymentAfterWsRetries } from './wsMaxRetryPolicy'
import { scheduleWsReconnectAfterMaxRetries } from './wsMaxRetryReconnect'
import {
  WS_STALE_CHECK_INTERVAL_MS,
  isWsConnectionStale,
  wsReconnectDelayMs,
} from './wsStaleWatchdog'

const LOGS_FALLBACK_WARNING = 'Live logs connection dropped. Reconnecting...'

const EVENTSOURCE_CONNECTING = 0
const EVENTSOURCE_CLOSED = 2

type LogStream = WebSocket | EventSource

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
  const failedOpensRef = useRef(0)
  const streamRef = useRef<LogStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFrameAtRef = useRef(0)
  const connectedAtRef = useRef(0)
  const staleCloseRef = useRef(false)
  const staleCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    retryRef.current = 0
    failedOpensRef.current = 0
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
        const stream = streamRef.current
        if (!stream) return
        if (
          isWsConnectionStale(
            stream.readyState,
            lastFrameAtRef.current,
            Date.now(),
            {
              connectedAt: connectedAtRef.current,
            },
          )
        ) {
          staleCloseRef.current = true
          retryRef.current = 0
          if (stream instanceof WebSocket) {
            stream.close()
          } else {
            stream.close()
          }
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
      closeStream()
      return
    }

    const handleLogMessage = (raw: string) => {
      retryRef.current = 0
      failedOpensRef.current = 0
      lastFrameAtRef.current = Date.now()
      try {
        const data = JSON.parse(raw) as unknown
        ingestPayload(data)
      } catch {
        /* ignore bad frame */
      }
    }

    const scheduleReconnectAfterClose = () => {
      streamRef.current = null
      clearStaleCheck()
      const wasStaleClose = staleCloseRef.current
      staleCloseRef.current = false
      if (useCanvasStore.getState().deploymentId !== deploymentId) return
      if (wasStaleClose) {
        const delay = wsReconnectDelayMs(retryRef.current)
        retryRef.current += 1
        timerRef.current = setTimeout(connect, delay)
        return
      }
      if (shouldVerifyDeploymentAfterWsRetries(retryRef.current)) {
        scheduleWsReconnectAfterMaxRetries({
          deploymentId,
          warningMessage: LOGS_FALLBACK_WARNING,
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

    const connect = () => {
      clearTimer()
      clearStaleCheck()
      staleCloseRef.current = false
      closeStream()

      const flagOn = sseStreamsEnabled()
      const transport = nextStreamTransport(flagOn, failedOpensRef.current)

      if (transport === 'sse') {
        const es = connectLogsSSE(deploymentId)
        streamRef.current = es
        startStaleCheck()

        es.onopen = () => {
          retryRef.current = 0
          failedOpensRef.current = 0
        }

        es.onmessage = (ev) => {
          handleLogMessage(ev.data)
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

      const ws = connectLogsWS(deploymentId)
      streamRef.current = ws
      startStaleCheck()

      ws.onmessage = (ev) => {
        handleLogMessage(ev.data as string)
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
      closeStream()
    }
  }, [deploymentId])
}