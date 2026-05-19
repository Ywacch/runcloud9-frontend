import { useEffect, useRef } from 'react'
import { connectLogsWS } from '../lib/api'
import { useCanvasStore } from '../store/canvasStore'
import { useLogStore, type RawLogLine } from '../store/logStore'

function isLogLine(x: unknown): x is RawLogLine {
  if (typeof x !== 'object' || x === null) return false
  const o = x as Record<string, unknown>
  const fieldsOk =
    o.fields === undefined ||
    (typeof o.fields === 'object' && o.fields !== null && !Array.isArray(o.fields))
  const levelOk = o.level === undefined || typeof o.level === 'string'
  return (
    typeof o.timestamp === 'string' &&
    typeof o.component === 'string' &&
    typeof o.message === 'string' &&
    fieldsOk &&
    levelOk
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

  useEffect(() => {
    retryRef.current = 0

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
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
      closeWs()
      return
    }

    const connect = () => {
      clearTimer()
      closeWs()

      const ws = connectLogsWS(deploymentId)
      wsRef.current = ws

      ws.onmessage = (ev) => {
        retryRef.current = 0
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
        if (useCanvasStore.getState().deploymentId !== deploymentId) return
        if (retryRef.current >= 5) return
        const delay = Math.min(30_000, 1000 * Math.pow(2, retryRef.current))
        retryRef.current += 1
        timerRef.current = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      clearTimer()
      closeWs()
    }
  }, [deploymentId])
}
