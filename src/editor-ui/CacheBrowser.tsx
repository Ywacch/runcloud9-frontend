import { useCallback, useEffect, useMemo, useState } from 'react'
import { fmtBytes } from '../lib/format'
import {
  fetchKeys,
  fetchKeyValue,
  type KeyInfo,
  type KeyValue,
} from '../lib/introspectApi'
import {
  canShowTimelineView,
  parseZsetRows,
} from '../lib/timelineMember'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { trackEvent } from '../lib/analytics'
import { InlineDisclosure } from './InlineDisclosure'
import { TimelineCard } from './TimelineCard'

type RedisType = string
type DetailViewMode = 'raw' | 'timeline'

function typePillClass(t: string): string {
  const k = t.toLowerCase()
  if (k === 'zset') return 'bg-cyan-500/25 text-cyan-200'
  if (k === 'string') return 'bg-emerald-500/25 text-emerald-200'
  if (k === 'hash') return 'bg-amber-500/25 text-amber-200'
  if (k === 'list') return 'bg-violet-500/25 text-violet-200'
  if (k === 'set') return 'bg-rose-500/25 text-rose-200'
  if (k === 'stream') return 'bg-blue-500/25 text-blue-200'
  return 'bg-[var(--c9-surface)] text-[var(--c9-muted)]'
}

function fmtTtl(ttl: number): string {
  if (ttl === -1) return '∞'
  return `${ttl}s`
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded border border-red-700/50 bg-red-950/65 px-2 py-2 text-xs text-red-100">
      <p>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 rounded bg-red-900/80 px-2 py-1 text-[11px] font-semibold hover:bg-red-800"
      >
        Retry
      </button>
    </div>
  )
}

function ZsetRawTable({ value }: { value: unknown }) {
  const parsed = parseZsetRows(value)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse font-mono text-[10px]">
        <thead>
          <tr className="border-b border-[var(--c9-border)] text-[var(--c9-muted)]">
            <th className="px-1 py-1 text-left">Rank</th>
            <th className="px-1 py-1 text-left">Member</th>
            <th className="px-1 py-1 text-left">Score</th>
          </tr>
        </thead>
        <tbody>
          {parsed.map((r, i) => (
            <tr key={i} className="border-b border-[var(--c9-border)]/50">
              <td className="px-1 py-1">{i + 1}</td>
              <td className="px-1 py-1 text-[var(--c9-text)]">{r.member}</td>
              <td className="px-1 py-1 text-[var(--c9-muted)]">{r.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function KeyValueView({ kv }: { kv: KeyValue }) {
  const t = (kv.type || 'string').toLowerCase()
  const v = kv.value

  if (t === 'string' || t === 'none') {
    return (
      <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10px] text-[var(--c9-text)]">
        {typeof v === 'string' ? v : JSON.stringify(v, null, 2)}
      </pre>
    )
  }

  if (t === 'list' && Array.isArray(v)) {
    return (
      <ol className="list-decimal space-y-1 pl-4 font-mono text-[10px] text-[var(--c9-text)]">
        {(v as unknown[]).map((item, i) => (
          <li key={i}>{typeof item === 'object' ? JSON.stringify(item) : String(item)}</li>
        ))}
      </ol>
    )
  }

  if (t === 'set' && Array.isArray(v)) {
    return (
      <ul className="list-disc space-y-1 pl-4 font-mono text-[10px] text-[var(--c9-text)]">
        {(v as unknown[]).map((item, i) => (
          <li key={i}>{typeof item === 'object' ? JSON.stringify(item) : String(item)}</li>
        ))}
      </ul>
    )
  }

  if (t === 'zset' && Array.isArray(v)) {
    return <ZsetRawTable value={v} />
  }

  if (t === 'hash' && v && typeof v === 'object' && !Array.isArray(v)) {
    const entries = Object.entries(v as Record<string, unknown>)
    return (
      <table className="w-full border-collapse font-mono text-[10px]">
        <tbody>
          {entries.map(([hk, hv]) => (
            <tr key={hk} className="border-b border-[var(--c9-border)]/40">
              <td className="py-1 pr-2 align-top text-[var(--c9-accent)]">{hk}</td>
              <td className="break-all py-1 text-[var(--c9-text)]">
                {typeof hv === 'object' ? JSON.stringify(hv) : String(hv)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  if (t === 'stream' && Array.isArray(v)) {
    return (
      <div className="space-y-2 font-mono text-[10px]">
        {(v as unknown[]).map((msg, i) => (
          <div
            key={i}
            className="rounded border border-[var(--c9-border)]/60 bg-[var(--c9-bg)]/50 p-2"
          >
            <pre className="whitespace-pre-wrap text-[var(--c9-text)]">
              {JSON.stringify(msg, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    )
  }

  return (
    <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[10px] text-[var(--c9-text)]">
      {JSON.stringify(v, null, 2)}
    </pre>
  )
}

interface CacheBrowserProps {
  deploymentId: string
  component: string
  keyPatterns?: string[]
}

export function CacheBrowser({
  deploymentId,
  component,
  keyPatterns,
}: CacheBrowserProps) {
  const patterns = useMemo(
    () => (keyPatterns?.length ? keyPatterns : ['*']),
    [keyPatterns],
  )
  const [pattern, setPattern] = useState(() => patterns[0] ?? '*')
  const [keys, setKeys] = useState<KeyInfo[]>([])
  const [keyCount, setKeyCount] = useState<number | null>(null)
  const [nextCursor, setNextCursor] = useState(0)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [keyValue, setKeyValue] = useState<KeyValue | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailView, setDetailView] = useState<DetailViewMode>('raw')

  useEffect(() => {
    setPattern((current) =>
      patterns.includes(current) ? current : (patterns[0] ?? '*'),
    )
  }, [patterns])

  const timelineEligible = useMemo(() => {
    if (!selectedKey || !keyValue) return false
    return canShowTimelineView({
      key: selectedKey,
      type: keyValue.type,
      value: keyValue.value,
      keyPatterns: patterns,
    })
  }, [selectedKey, keyValue, patterns])

  useEffect(() => {
    if (!timelineEligible && detailView === 'timeline') {
      setDetailView('raw')
    }
  }, [timelineEligible, detailView])

  const scanFromStart = useCallback(
    async (pat: string) => {
      setError(null)
      setLoading(true)
      setKeys([])
      setKeyCount(null)
      setNextCursor(0)
      setSelectedKey(null)
      setKeyValue(null)
      setDetailView('raw')
      try {
        const res = await fetchKeys(deploymentId, component, pat, 0, 50)
        setKeys(res.keys)
        setNextCursor(res.cursor)
        setKeyCount(Number.isFinite(res.keyCount) ? Number(res.keyCount) : null)
        const template = useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
        trackEvent('data_inspector_used', {
          template,
          componentType: component,
          operationCategory: 'scan_keys',
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to scan keys')
        setKeys([])
      } finally {
        setLoading(false)
      }
    },
    [deploymentId, component],
  )

  useEffect(() => {
    void scanFromStart(pattern)
  }, [deploymentId, component, pattern, scanFromStart])

  const loadMore = useCallback(async () => {
    if (nextCursor <= 0) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetchKeys(deploymentId, component, pattern, nextCursor, 50)
      setKeys((k) => [...k, ...res.keys])
      setNextCursor(res.cursor)
      if (Number.isFinite(res.keyCount)) {
        setKeyCount(Number(res.keyCount))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more keys')
    } finally {
      setLoading(false)
    }
  }, [deploymentId, component, pattern, nextCursor])

  const onSelectKey = useCallback(
    async (keyName: string) => {
      setSelectedKey(keyName)
      setDetailLoading(true)
      setKeyValue(null)
      setDetailView('raw')
      try {
        const kv = await fetchKeyValue(deploymentId, component, keyName)
        setKeyValue(kv)
        const template = useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
        trackEvent('data_inspector_used', {
          template,
          componentType: component,
          operationCategory: 'fetch_value',
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load key value')
      } finally {
        setDetailLoading(false)
      }
    },
    [deploymentId, component],
  )

  const refresh = () => void scanFromStart(pattern)

  return (
    <div className="space-y-3">
      {keyCount != null ? (
        <p className="text-xs font-semibold text-[var(--c9-text)]">
          {keyCount} {keyCount === 1 ? 'key' : 'keys'}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-[10px]">
          <span className="font-semibold text-[var(--c9-muted)]">Pattern</span>
          <select
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            className="max-w-[10rem] rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--c9-text)]"
          >
            {patterns.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void scanFromStart(pattern)}
          className="rounded border border-[var(--c9-border)] px-2 py-0.5 text-[10px] font-semibold text-[var(--c9-text)] hover:bg-[var(--c9-surface)]"
        >
          Scan
        </button>
        <button
          type="button"
          onClick={refresh}
          className="text-[11px] text-[var(--c9-accent)] hover:underline"
        >
          ↻ Refresh
        </button>
      </div>

      {error ? <ErrorBox message={error} onRetry={refresh} /> : null}

      {loading && keys.length === 0 ? (
        <div className="animate-pulse space-y-2 py-2">
          <div className="h-4 rounded bg-[var(--c9-surface)]" />
          <div className="h-4 w-3/4 rounded bg-[var(--c9-surface)]" />
        </div>
      ) : null}

      {!loading && keys.length === 0 ? (
        <p className="py-4 text-center text-xs text-[var(--c9-muted)]">
          No keys match this pattern
        </p>
      ) : null}

      <div className="flex min-h-0 flex-col gap-3 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-2 lg:max-w-[55%]">
          {keys.length > 0 ? (
            <div
              className={`max-h-48 overflow-y-auto rounded border border-[var(--c9-border)] ${loading ? 'animate-pulse opacity-80' : ''}`}
            >
              <table className="w-full min-w-max border-collapse text-left text-[10px]">
                <thead className="sticky top-0 z-[1] bg-[var(--c9-bg)]">
                  <tr className="border-b border-[var(--c9-border)] bg-[var(--c9-surface)]/50">
                    <th className="px-2 py-1.5 font-semibold text-[var(--c9-muted)]">Key</th>
                    <th className="px-2 py-1.5 font-semibold text-[var(--c9-muted)]">Type</th>
                    <th className="px-2 py-1.5 font-semibold text-[var(--c9-muted)]">TTL</th>
                    <th className="px-2 py-1.5 font-semibold text-[var(--c9-muted)]">Memory</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <tr
                      key={k.key}
                      role="button"
                      tabIndex={0}
                      onClick={() => void onSelectKey(k.key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          void onSelectKey(k.key)
                        }
                      }}
                      className={`cursor-pointer border-b border-[var(--c9-border)]/40 hover:bg-[var(--c9-surface)]/40 ${
                        selectedKey === k.key ? 'bg-[var(--c9-accent)]/10' : ''
                      }`}
                    >
                      <td className="max-w-[11rem] truncate px-2 py-1 font-mono text-[var(--c9-text)]">
                        {k.key}
                      </td>
                      <td className="px-2 py-1">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${typePillClass(k.type as RedisType)}`}
                        >
                          {k.type}
                        </span>
                      </td>
                      <td
                        className={`px-2 py-1 font-mono tabular-nums ${
                          k.ttl === -1 ? 'text-[var(--c9-muted)]' : 'text-[var(--c9-text)]'
                        }`}
                      >
                        {fmtTtl(k.ttl)}
                      </td>
                      <td className="px-2 py-1 font-mono text-[var(--c9-muted)]">
                        {fmtBytes(k.memory)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {nextCursor > 0 ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadMore()}
              className="w-full rounded border border-[var(--c9-border)] py-1.5 text-[11px] font-semibold text-[var(--c9-text)] hover:bg-[var(--c9-surface)] disabled:opacity-50"
            >
              Load more
            </button>
          ) : null}
        </div>

        <div className="min-h-[8rem] min-w-0 flex-1 rounded border border-[var(--c9-border)] bg-[var(--c9-bg)]/40 p-3">
          {!selectedKey ? (
            <p className="py-6 text-center text-xs text-[var(--c9-muted)]">Select a key</p>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[10px] font-semibold text-[var(--c9-muted)]">
                  <span className="text-[var(--c9-text)]">{selectedKey}</span>
                  {keyValue ? (
                    <span className="ml-2 text-[var(--c9-muted)]">
                      ({keyValue.type})
                    </span>
                  ) : null}
                </div>
                {timelineEligible ? (
                  <div
                    className="inline-flex rounded border border-[var(--c9-border)] p-0.5 text-[10px]"
                    role="group"
                    aria-label="Key value view mode"
                  >
                    {(
                      [
                        ['raw', 'Raw'],
                        ['timeline', 'Timeline'],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={detailView === id}
                        onClick={() => setDetailView(id)}
                        className={`rounded px-2 py-0.5 font-semibold transition-colors ${
                          detailView === id
                            ? 'bg-[var(--c9-accent)]/20 text-[var(--c9-text)]'
                            : 'text-[var(--c9-muted)] hover:text-[var(--c9-text)]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {detailLoading ? (
                <div className="animate-pulse space-y-2">
                  <div className="h-8 rounded bg-[var(--c9-surface)]" />
                </div>
              ) : keyValue ? (
                detailView === 'timeline' && timelineEligible ? (
                  <div className="space-y-2">
                    <div className="max-h-80 overflow-y-auto rounded border border-[var(--c9-border)]/60 bg-[var(--c9-bg)]/50">
                      {parseZsetRows(keyValue.value).map((row, i) => (
                        <TimelineCard
                          key={`${i}-${row.score}`}
                          member={row.member}
                          rank={i + 1}
                        />
                      ))}
                    </div>
                    <InlineDisclosure label="Why sorted sets?">
                      <p>
                        Redis sorted sets (ZSET) store timeline feeds ranked by timestamp.
                        Each user&apos;s feed is a separate key (timeline:{'{'}userId{'}'}),
                        giving O(1) reads for the most recent posts. This is the push model:
                        the fan-out worker pre-computes feeds at write time so reads are
                        instant.
                      </p>
                    </InlineDisclosure>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded border border-[var(--c9-border)]/60 bg-[var(--c9-bg)]/50 p-2">
                    <KeyValueView kv={keyValue} />
                  </div>
                )
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
