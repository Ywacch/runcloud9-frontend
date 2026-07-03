import { useEffect, useState } from 'react'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { syncDbTierCWarmup } from '../lib/tierCWarmupSession'

/** Per-node DB Tier C warmup; clock survives inspector remounts within a session. */
export function useDbTierCWarmup(nodeId: string, m: MetricsBucket): boolean {
  const [nowMs, setNowMs] = useState(() => Date.now())
  const warmingUp = syncDbTierCWarmup(nodeId, m, nowMs)

  useEffect(() => {
    if (!warmingUp) return
    const id = window.setInterval(() => setNowMs(Date.now()), 5_000)
    return () => window.clearInterval(id)
  }, [warmingUp])

  return warmingUp
}
