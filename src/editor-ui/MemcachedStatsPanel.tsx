import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchCacheStats, fetchKeyValue, fetchKeys, type KeyInfo } from '../lib/introspectApi'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { cachePatternLabel } from '../lib/cacheBrowsePatterns'
import {
  memcachedEmptyKeysMessage,
  memcachedExampleKeys,
  memcachedManualKeyPlaceholder,
} from '../lib/memcachedKeyHints'
import {
  introspectErrorMessage,
  isDeploymentInactiveError,
  LIVE_SESSION_ENDED_MESSAGE,
} from '../lib/liveSessionEnding'
import { sumMemcachedStat } from '../lib/memcachedStats'
import { SlDataError, SlDataHead, SlKeyCard } from './stacklabDataPanels'

const POLL_MS = 5000
const ALL_KEY_PATTERNS = 'all'

const STAT_ROWS = [
  { key: 'curr_items', label: 'Items' },
  { key: 'get_hits', label: 'Get hits' },
  { key: 'get_misses', label: 'Get misses' },
  { key: 'evictions', label: 'Evictions' },
  { key: 'bytes', label: 'Bytes used' },
  { key: 'limit_maxbytes', label: 'Byte limit' },
  { key: 'curr_connections', label: 'Connections' },
] as const

function introspectFailure(err: unknown): string {
  const inactive = useCanvasStore.getState().liveSessionEnding || isDeploymentInactiveError(err)
  return inactive ? LIVE_SESSION_ENDED_MESSAGE : introspectErrorMessage(err)
}

export function MemcachedStatsPanel({
  deploymentId,
  component,
  keyPatterns,
}: {
  deploymentId: string
  component: string
  keyPatterns?: string[]
}) {
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)
  const patterns = useMemo(
    () => keyPatterns?.map((p) => p.trim()).filter(Boolean) ?? [],
    [keyPatterns],
  )
  const browsePatterns = useMemo(
    () => (patterns.length > 0 ? patterns : ['*']),
    [patterns],
  )
  const patternTabs = useMemo(
    () => (patterns.length > 1 ? [ALL_KEY_PATTERNS, ...patterns] : browsePatterns),
    [patterns, browsePatterns],
  )
  const [pattern, setPattern] = useState(() =>
    patterns.length > 1 ? ALL_KEY_PATTERNS : (browsePatterns[0] ?? '*'),
  )
  const exampleKeys = useMemo(() => memcachedExampleKeys(patterns), [patterns])
  const manualKeyPlaceholder = useMemo(
    () => memcachedManualKeyPlaceholder(snapshotTemplateId, patterns),
    [snapshotTemplateId, patterns],
  )
  const listPattern =
    pattern === ALL_KEY_PATTERNS || pattern === '*' ? undefined : pattern
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
  const [statsError, setStatsError] = useState<string | null>(null)
  const [keysError, setKeysError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    setPattern((current) =>
      patternTabs.includes(current) ? current : patternTabs[0] ?? '*',
    )
  }, [patternTabs])

  const loadValue = useCallback(
    async (key: string) => {
      setValueLoading((prev) => ({ ...prev, [key]: true }))
      try {
        const kv = await fetchKeyValue(deploymentId, component, key)
        setValues((prev) => ({ ...prev, [key]: kv.value }))
        setKeysError(null)
      } catch (err) {
        setValues((prev) => ({ ...prev, [key]: null }))
        setKeysError(introspectFailure(err))
      } finally {
        setValueLoading((prev) => ({ ...prev, [key]: false }))
      }
    },
    [deploymentId, component],
  )

  const load = useCallback(async () => {
    if (useCanvasStore.getState().liveSessionEnding) return
    setRefreshing(true)
    // No pattern: the API lists keys that match the template whitelist.
    // Do not send "*". Ecommerce does not allow that pattern.
    const [statsResult, keysResult] = await Promise.allSettled([
      fetchCacheStats(deploymentId, component),
      fetchKeys(deploymentId, component, listPattern, undefined, 50),
    ])
    if (statsResult.status === 'fulfilled') {
      setStats(statsResult.value.stats)
      setStatsError(null)
    } else {
      setStatsError(introspectFailure(statsResult.reason))
    }
    if (keysResult.status === 'fulfilled') {
      const keyRes = keysResult.value
      const rows = keyRes.keys ?? []
      setKeys(rows)
      setTruncated(Boolean(keyRes.truncated))
      setKeysError(null)
      const open = selectedKeyRef.current
      if (open && rows.some((row) => row.key === open)) {
        void loadValue(open)
      }
    } else {
      setKeysError(introspectFailure(keysResult.reason))
    }
    setRefreshing(false)
  }, [deploymentId, component, listPattern, loadValue])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), POLL_MS)
    return () => window.clearInterval(id)
  }, [load])

  return (
    <>
      <SlDataHead
        subtitle="Keys from a safe dump appear below. Click one to load its value."
        onRefresh={liveSessionEnding ? undefined : () => void load()}
        refreshing={refreshing}
      />
      {statsError ? (
        <SlDataError
          message={statsError}
          onRetry={() => void load()}
          showRetry={!liveSessionEnding && statsError !== LIVE_SESSION_ENDED_MESSAGE}
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
      {patternTabs.length > 1 ? (
        <div className="seg" role="group" aria-label="Key pattern" style={{ marginBottom: 12 }}>
          {patternTabs.map((p) => (
            <button
              key={p}
              type="button"
              className={pattern === p ? 'is-on' : ''}
              onClick={() => setPattern(p)}
            >
              {p === ALL_KEY_PATTERNS ? 'All' : cachePatternLabel(p, [])}
            </button>
          ))}
        </div>
      ) : null}
      {!keysError && keys.length > 0 ? (
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
      ) : null}
      {!keysError && keys.length === 0 ? (
        <p className="note">
          <b>i</b>{' '}
          {memcachedEmptyKeysMessage(snapshotTemplateId, patterns)}
        </p>
      ) : null}
      {exampleKeys.length > 0 ? (
        <div className="seg" role="group" aria-label="Example keys" style={{ margin: '12px 0', flexWrap: 'wrap' }}>
          <span className="note" style={{ marginRight: 8 }}>
            Try:
          </span>
          {exampleKeys.map((key) => (
            <button
              key={key}
              type="button"
              className="btn ghost"
              onClick={() => {
                setLookup(key)
                setSelectedKey(key)
                void loadValue(key)
              }}
            >
              {key}
            </button>
          ))}
        </div>
      ) : null}
      <form
        className="seg"
        style={{ margin: '12px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}
        onSubmit={(event) => {
          event.preventDefault()
          const key = lookup.trim()
          if (!key) return
          setSelectedKey(key)
          void loadValue(key)
        }}
      >
        <label className="note" style={{ width: '100%' }}>
          Or type an exact key from your app (not a glob):
        </label>
        <input
          aria-label="Memcached key"
          value={lookup}
          onChange={(event) => setLookup(event.target.value)}
          placeholder={manualKeyPlaceholder}
          style={{ flex: 1, minWidth: 120 }}
        />
        <button type="submit" className="btn ghost">
          Get
        </button>
      </form>
      {keysError ? (
        <SlDataError
          message={keysError}
          onRetry={() => void load()}
          showRetry={!liveSessionEnding && keysError !== LIVE_SESSION_ENDED_MESSAGE}
        />
      ) : null}
      <p className="note">
        <b>i</b>A get counts as a hit and refreshes the item in the LRU.
        {truncated ? ' This list is capped.' : ''}
      </p>
    </>
  )
}
