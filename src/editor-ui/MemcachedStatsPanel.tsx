import { useCallback, useEffect, useState } from 'react'
import { fetchCacheStats } from '../lib/introspectApi'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import {
  introspectErrorMessage,
  isDeploymentInactiveError,
  LIVE_SESSION_ENDED_MESSAGE,
} from '../lib/liveSessionEnding'
import { sumMemcachedStat } from '../lib/memcachedStats'
import { SlDataError, SlDataHead } from './stacklabDataPanels'

const POLL_MS = 5000

const STAT_ROWS = [
  { key: 'curr_items', label: 'Items' },
  { key: 'get_hits', label: 'Get hits' },
  { key: 'get_misses', label: 'Get misses' },
  { key: 'evictions', label: 'Evictions' },
  { key: 'bytes', label: 'Bytes used' },
  { key: 'limit_maxbytes', label: 'Byte limit' },
  { key: 'curr_connections', label: 'Connections' },
] as const

export function MemcachedStatsPanel({
  deploymentId,
  component,
}: {
  deploymentId: string
  component: string
}) {
  const liveSessionEnding = useCanvasStore((s) => s.liveSessionEnding)
  const [stats, setStats] = useState<Record<string, Record<string, string>> | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (useCanvasStore.getState().liveSessionEnding) return
    setRefreshing(true)
    try {
      const res = await fetchCacheStats(deploymentId, component)
      setStats(res.stats)
      setError(null)
    } catch (err) {
      const inactive = useCanvasStore.getState().liveSessionEnding || isDeploymentInactiveError(err)
      setError(inactive ? LIVE_SESSION_ENDED_MESSAGE : introspectErrorMessage(err))
    } finally {
      setRefreshing(false)
    }
  }, [deploymentId, component])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), POLL_MS)
    return () => window.clearInterval(id)
  }, [load])

  return (
    <>
      <SlDataHead
        subtitle="Server stats. Memcached does not list keys."
        onRefresh={liveSessionEnding ? undefined : () => void load()}
        refreshing={refreshing}
      />
      {error ? (
        <SlDataError
          message={error}
          onRetry={() => void load()}
          showRetry={!liveSessionEnding && error !== LIVE_SESSION_ENDED_MESSAGE}
        />
      ) : null}
      <dl className="sl-stat-list">
        {STAT_ROWS.map((row) => {
          const value = sumMemcachedStat(stats, row.key)
          return (
            <div key={row.key} className="sl-stat-row">
              <dt>{row.label}</dt>
              <dd>{value == null ? '—' : value.toLocaleString()}</dd>
            </div>
          )
        })}
      </dl>
    </>
  )
}
