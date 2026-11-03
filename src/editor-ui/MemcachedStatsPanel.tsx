import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchCacheStats, fetchKeyValue, fetchKeys, type KeyInfo } from '../lib/introspectApi'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import {
  introspectErrorMessage,
  isDeploymentInactiveError,
  LIVE_SESSION_ENDED_MESSAGE,
} from '../lib/liveSessionEnding'
import { sumMemcachedStat } from '../lib/memcachedStats'
import { SlDataError, SlDataHead, SlKeyCard } from './stacklabDataPanels'

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
  keyPatterns,
}: {
  deploymentId: string
  component: string
  keyPatterns?: string[]
}) {
  const pattern = useMemo(() => {
    const first = keyPatterns?.map((p) => p.trim()).find(Boolean)
    return first || '*'
  }, [keyPatterns])
  const liveSessionEnding = useCanvasStore((s) => s.liveSessionEnding)
  const [stats, setStats] = useState<Record<string, Record<string, string>> | undefined>()
  const [keys, setKeys] = useState<KeyInfo[]>([])
  const [truncated, setTruncated] = useState(false)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [valueLoading, setValueLoading] = useState<Record<string, boolean>>({})
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const selectedKeyRef = useRef<string | null>(null)
  selectedKeyRef.current = selectedKey
  const [lookup, setLookup] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadValue = useCallback(
    async (key: string) => {
      setValueLoading((prev) => ({ ...prev, [key]: true }))
      try {
        const kv = await fetchKeyValue(deploymentId, component, key)
        setValues((prev) => ({ ...prev, [key]: kv.value }))
        setError(null)
      } catch (err) {
        setValues((prev) => ({ ...prev, [key]: null }))
        const inactive = useCanvasStore.getState().liveSessionEnding || isDeploymentInactiveError(err)
        setError(inactive ? LIVE_SESSION_ENDED_MESSAGE : introspectErrorMessage(err))
      } finally {
        setValueLoading((prev) => ({ ...prev, [key]: false }))
      }
    },
    [deploymentId, component],
  )

  const load = useCallback(async () => {
    if (useCanvasStore.getState().liveSessionEnding) return
    setRefreshing(true)
    try {
      const [statsRes, keyRes] = await Promise.all([
        fetchCacheStats(deploymentId, component),
        fetchKeys(deploymentId, component, pattern, 0, 50),
      ])
      setStats(statsRes.stats)
      setKeys(keyRes.keys ?? [])
      setTruncated(Boolean(keyRes.truncated))
      setError(null)
      const open = selectedKeyRef.current
      if (open && (keyRes.keys ?? []).some((row) => row.key === open)) {
        void loadValue(open)
      }
    } catch (err) {
      const inactive = useCanvasStore.getState().liveSessionEnding || isDeploymentInactiveError(err)
      setError(inactive ? LIVE_SESSION_ENDED_MESSAGE : introspectErrorMessage(err))
    } finally {
      setRefreshing(false)
    }
  }, [deploymentId, component, pattern, loadValue])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), POLL_MS)
    return () => window.clearInterval(id)
  }, [load])

  return (
    <>
      <SlDataHead
        subtitle="Server stats, then key names. A click loads that one value."
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
      <form
        className="seg"
        style={{ margin: '12px 0', display: 'flex', gap: 8 }}
        onSubmit={(event) => {
          event.preventDefault()
          const key = lookup.trim()
          if (!key) return
          setSelectedKey(key)
          void loadValue(key)
        }}
      >
        <input
          aria-label="Memcached key"
          value={lookup}
          onChange={(event) => setLookup(event.target.value)}
          placeholder="key name"
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn ghost">
          Get
        </button>
      </form>
      {keys.length === 0 ? (
        <p className="note">
          <b>i</b>No keys in this dump.
        </p>
      ) : (
        <div className="keyset">
          {keys.map((row) => (
            <SlKeyCard
              key={row.key}
              name={row.key}
              type={row.type || 'string'}
              sizeBytes={row.memory}
              ttl={row.ttl}
              value={values[row.key]}
              loading={valueLoading[row.key]}
              selected={selectedKey === row.key}
              onSelect={() => {
                setSelectedKey(row.key)
                void loadValue(row.key)
              }}
            />
          ))}
        </div>
      )}
      <p className="note">
        <b>i</b>A get counts as a hit and refreshes the item in the LRU.
        {truncated ? ' This list is capped.' : ''}
      </p>
    </>
  )
}
