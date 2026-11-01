import { useEffect, useRef, useState } from 'react'
import { getDeployment } from '../../lib/api'
import { parseAIPostmortem } from '../../lib/aiPostmortem'
import {
  POSTMORTEM_POLL_INTERVAL_MS,
  POSTMORTEM_POLL_MAX_MS,
  shouldPollPostmortem,
} from '../../lib/postmortemPoll'
import { useAuthStore } from '../../product/stores/authStore'
import { useCanvasStore, type SessionSummary } from '../stores/canvasStore'

export function usePostmortemPoll(summary: SessionSummary | null): {
  polling: boolean
  pollTimedOut: boolean
} {
  const isInternal = useAuthStore((s) => s.currentUser?.isInternal === true)
  const sessionKey = summary
    ? `${summary.deploymentId ?? ''}:${summary.template}:${summary.duration}`
    : ''
  const [pollTimedOut, setPollTimedOut] = useState(false)
  const [polling, setPolling] = useState(false)
  const [pollSessionKey, setPollSessionKey] = useState(sessionKey)
  if (sessionKey !== pollSessionKey) {
    setPollSessionKey(sessionKey)
    setPollTimedOut(false)
    setPolling(false)
  }
  const startedAtRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!summary) return
    const deploymentId = summary.deploymentId?.trim()
    let cancelled = false

    const clearPollTimer = () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    const tick = async () => {
      const elapsedMs = Date.now() - startedAtRef.current
      const current = useCanvasStore.getState().sessionSummary
      if (!current || cancelled) return
      const active = shouldPollPostmortem({
        postmortem: current.aiPostmortem,
        isInternal,
        hasDeploymentId: Boolean(deploymentId),
        elapsedMs,
      })
      setPolling(active)
      if (elapsedMs >= POSTMORTEM_POLL_MAX_MS) {
        setPollTimedOut(true)
        clearPollTimer()
        setPolling(false)
        return
      }
      if (!active || !deploymentId) return
      try {
        const dep = await getDeployment(deploymentId)
        const parsed = parseAIPostmortem(dep.metricsSummary?.ai_postmortem)
        if (parsed && parsed.status !== 'pending') {
          const live = useCanvasStore.getState().sessionSummary
          if (live && !cancelled) {
            useCanvasStore.getState().setSessionSummary({
              ...live,
              aiPostmortem: parsed,
            })
          }
          setPolling(false)
          clearPollTimer()
        }
      } catch {
        // keep polling until cap
      }
    }

    startedAtRef.current = Date.now()
    void tick()
    intervalRef.current = setInterval(() => {
      void tick()
    }, POSTMORTEM_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearPollTimer()
      setPolling(false)
    }
  }, [summary, isInternal])

  return { polling, pollTimedOut }
}
