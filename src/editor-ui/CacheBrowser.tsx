import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchKeyValue, fetchKeys, type KeyInfo } from '../lib/introspectApi'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { trackEvent } from '../lib/analytics'
import { SlSecHead } from './stacklabPanePrimitives'
import { SlDataError, SlDataHead, SlKeyCard } from './stacklabDataPanels'

const DATA_POLL_MS = 8000
const SCAN_PAGE_SIZE = 50

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
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [valueLoading, setValueLoading] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const selectedKeyRef = useRef<string | null>(null)
  selectedKeyRef.current = selectedKey

  useEffect(() => {
    setPattern((current) =>
      patterns.includes(current) ? current : (patterns[0] ?? '*'),
    )
  }, [patterns])

  const loadValues = useCallback(
    async (keyList: KeyInfo[]) => {
      const loadingMap: Record<string, boolean> = {}
      keyList.forEach((k) => {
        loadingMap[k.key] = true
      })
      setValueLoading((prev) => ({ ...prev, ...loadingMap }))
      await Promise.all(
        keyList.map(async (k) => {
          try {
            const kv = await fetchKeyValue(deploymentId, component, k.key)
            setValues((prev) => ({ ...prev, [k.key]: kv.value }))
          } catch {
            setValues((prev) => ({ ...prev, [k.key]: null }))
          } finally {
            setValueLoading((prev) => ({ ...prev, [k.key]: false }))
          }
        }),
      )
    },
    [deploymentId, component],
  )

  const reloadSelectedKey = useCallback(
    async (key: string) => {
      setValueLoading((prev) => ({ ...prev, [key]: true }))
      try {
        const kv = await fetchKeyValue(deploymentId, component, key)
        setValues((prev) => ({ ...prev, [key]: kv.value }))
      } catch {
        setValues((prev) => ({ ...prev, [key]: null }))
      } finally {
        setValueLoading((prev) => ({ ...prev, [key]: false }))
      }
    },
    [deploymentId, component],
  )

  const scanFromStart = useCallback(
    async (pat: string, opts?: { soft?: boolean }) => {
      const selection = selectedKeyRef.current
      setError(null)
      if (opts?.soft) setRefreshing(true)
      else setLoading(true)
      try {
        const res = await fetchKeys(deploymentId, component, pat, 0, SCAN_PAGE_SIZE)
        setKeys(res.keys)
        setNextCursor(res.cursor)
        setKeyCount(Number.isFinite(res.keyCount) ? Number(res.keyCount) : null)
        if (!opts?.soft) {
          const template = useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
          trackEvent('data_inspector_used', {
            template,
            componentType: component,
            operationCategory: 'scan_keys',
          })
        }
        if (selection && !res.keys.some((k) => k.key === selection)) {
          setSelectedKey(null)
        }
        void loadValues(res.keys)
        if (selection && res.keys.some((k) => k.key === selection)) {
          void reloadSelectedKey(selection)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to scan keys')
        if (!opts?.soft) setKeys([])
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [deploymentId, component, loadValues, reloadSelectedKey],
  )

  useEffect(() => {
    void scanFromStart(pattern)
  }, [deploymentId, component, pattern, scanFromStart])

  useEffect(() => {
    const id = window.setInterval(() => {
      void scanFromStart(pattern, { soft: true })
    }, DATA_POLL_MS)
    return () => window.clearInterval(id)
  }, [pattern, scanFromStart])

  const loadMore = useCallback(async () => {
    if (nextCursor <= 0) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetchKeys(deploymentId, component, pattern, nextCursor, SCAN_PAGE_SIZE)
      setKeys((k) => [...k, ...res.keys])
      setNextCursor(res.cursor)
      if (Number.isFinite(res.keyCount)) {
        setKeyCount(Number(res.keyCount))
      }
      void loadValues(res.keys)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more keys')
    } finally {
      setLoading(false)
    }
  }, [deploymentId, component, pattern, nextCursor, loadValues])

  const refresh = () => void scanFromStart(pattern, { soft: true })

  const stringKeys = keys.filter((k) => {
    const t = k.type.toLowerCase()
    return t === 'string' || t === 'none'
  })
  const complexKeys = keys.filter((k) => {
    const t = k.type.toLowerCase()
    return t !== 'string' && t !== 'none'
  })
  const noExpiryKeys = keys.filter((k) => k.ttl === -1)

  const renderKeyCard = (k: KeyInfo) => (
    <SlKeyCard
      key={k.key}
      name={k.key}
      type={k.type}
      sizeBytes={k.memory}
      ttl={k.ttl}
      value={values[k.key]}
      loading={valueLoading[k.key]}
      selected={selectedKey === k.key}
      onSelect={() => setSelectedKey(k.key)}
    />
  )

  return (
    <>
      <SlDataHead
        subtitle="Keys, sizes, and TTLs. Values are app-side mappings."
        onRefresh={refresh}
        refreshing={refreshing}
      />

      {patterns.length > 1 ? (
        <div className="seg" role="group" aria-label="Key pattern" style={{ marginBottom: 12 }}>
          {patterns.map((p) => (
            <button
              key={p}
              type="button"
              className={pattern === p ? 'is-on' : ''}
              onClick={() => setPattern(p)}
            >
              {p}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <SlDataError message={error} onRetry={refresh} /> : null}

      {loading && keys.length === 0 ? (
        <p className="note">
          <b>i</b>Scanning keys…
        </p>
      ) : null}

      {!loading && keys.length === 0 ? (
        <p className="note">
          <b>i</b>No keys match this pattern.
        </p>
      ) : null}

      {stringKeys.length > 0 ? (
        <div className="keyset">
          {stringKeys.map((k) => renderKeyCard(k))}
        </div>
      ) : null}

      {nextCursor > 0 ? (
        <div className="pager">
          <span className="pager-lab">
            {keys.length.toLocaleString()}
            {keyCount != null ? ` of ${keyCount.toLocaleString()}` : ''} shown
          </span>
          <button type="button" className="btn ghost" disabled={loading} onClick={() => void loadMore()}>
            Next →
          </button>
        </div>
      ) : null}

      {noExpiryKeys.length > 0 ? (
        <p className="note">
          <b>i</b>
          {noExpiryKeys.map((k) => k.key).join(', ')}
          {noExpiryKeys.length === 1 ? ' is' : ' are'} written without an expiry, so no TTL is
          shown.
        </p>
      ) : null}

      {complexKeys.length > 0 ? (
        <>
          <SlSecHead
            index="E"
            title="Large values"
            subtitle="Complex types collapse to a head line. Expand for a truncated preview."
          />
          <div className="keyset">
            {complexKeys.map((k) => renderKeyCard(k))}
          </div>
          <p className="note">
            <b>i</b>
            Values above a short head collapse to a summary line — type, entry count, and the head
            of the value. Expand reveals a truncated preview, never the full payload. The same
            pattern holds for sets, hashes, and lists.
          </p>
        </>
      ) : null}
    </>
  )
}
