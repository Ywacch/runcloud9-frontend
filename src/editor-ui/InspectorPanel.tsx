import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getAvailableCacheStrategies,
  isProxyCacheStrategy,
} from '../lib/cacheTopologyStrategy'
import {
  defaultProxyResourceProfile,
  redisProfileFromConfig,
} from '../lib/cacheProxyResources'
import {
  REDIS_EVICTION_POLICIES,
  REDIS_EVICTION_POLICY_DESCRIPTION,
  REDIS_EVICTION_POLICY_LABEL,
  normalizeRedisEvictionPolicy,
} from '../lib/redisEvictionPolicy'
import {
  WRITE_BEHIND_INTERVAL_DEFAULT,
  WRITE_BEHIND_INTERVAL_MAX,
  WRITE_BEHIND_INTERVAL_MIN,
  WRITE_BEHIND_INTERVAL_VALIDATION,
  commitWriteBehindIntervalDraft,
  isValidWriteBehindInterval,
  normalizeWriteBehindIntervalSeconds,
  showsWriteBehindIntervalControl,
  templateSupportsWriteBehindInterval,
} from '../lib/writeBehindInterval'
import {
  CACHE_TTL_HELPER,
  CACHE_TTL_MAX,
  CACHE_TTL_MIN,
  CACHE_TTL_VALIDATION,
  VOLATILE_NO_EXPIRY_WARNING,
  commitTimedCacheTtlDraft,
  defaultCacheTtlSecondsForTemplate,
  isValidTimedCacheTtlSeconds,
  parseCacheTtlSeconds,
  showVolatileNoExpiryWarning,
} from '../lib/cacheTtl'
import { getTopologyFlags, resolveRole } from '../lib/componentRole'
import {
  APP_SERVER_REPLICA_MIN,
  clampAppServerReplicas,
} from '../lib/replicaConfig'
import { ensureLoadBalancerForReplicas } from '../lib/ensureLoadBalancerForReplicas'
import { maxAppServerReplicasForUser } from '../lib/userTier'
import { useAuthStore } from '../product/stores/authStore'
import { NODE_VISUAL } from '../lib/nodeVisual'
import { canvasToBackend } from '../lib/typeMapping'
import {
  useCanvasStore,
  type CanvasEdge,
  type CanvasNode,
} from '../editor-core/stores/canvasStore'
import { useTemplateRegistryStore } from '../editor-core/stores/templateRegistryStore'
import { CacheBrowser } from './CacheBrowser'
import { ComponentLogPanel } from './ComponentLogPanel'
import { DataBrowser } from './DataBrowser'
import { ChaosActions } from './ChaosActions'
import { LiveMetrics } from './LiveMetrics'
import { ResourceProfileFields } from './ResourceProfileFields'
import { getResourceProfilesCached } from '../lib/resourceProfileStore'
import {
  formatProvisionedShort,
  resolveProvisionedLimits,
} from '../lib/resolveProvisionedLimits'
import { trackEvent } from '../lib/analytics'

const fieldClass =
  'w-full rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-3 py-2 text-sm text-[var(--c9-text)] focus:border-[var(--c9-accent)] focus:outline-none'
const labelClass = 'mb-1 block text-xs uppercase tracking-wider text-[var(--c9-muted)]'
const badgeClass =
  'rounded border border-[var(--c9-border)] bg-[var(--c9-surface)] px-2 py-1 text-xs text-[var(--c9-muted)]'

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function provisionedBadge(node: CanvasNode): string | null {
  if (node.type === 'client') return null
  const catalog = getResourceProfilesCached()
  return formatProvisionedShort(resolveProvisionedLimits(node.type, node.config, catalog))
}

export function InspectorPanel() {
  const mode = useCanvasStore((s) => s.mode)
  const selectedId = useCanvasStore((s) => s.selectedId)
  const selectedIds = useCanvasStore((s) => s.selectedIds)
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const selectNode = useCanvasStore((s) => s.selectNode)
  const updateNodeConfig = useCanvasStore((s) => s.updateNodeConfig)
  const updateNodeLabel = useCanvasStore((s) => s.updateNodeLabel)
  const removeNode = useCanvasStore((s) => s.removeNode)
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)
  const deploymentId = useCanvasStore((s) => s.deploymentId)
  const templateInfo = useTemplateRegistryStore((s) =>
    snapshotTemplateId ? s.byId[snapshotTemplateId] : undefined,
  )
  const storytelling = templateInfo?.storytelling
  const cacheKeyPatterns = templateInfo?.introspection?.cache?.keyPatterns

  const inspectorNodeId =
    selectedIds.length === 1 ? selectedIds[0] : selectedId
  const node = inspectorNodeId ? (nodes[inspectorNodeId] ?? null) : null
  const roleLabel = useMemo(() => {
    if (!node) return ''
    return resolveRole(
      node.type,
      snapshotTemplateId,
      getTopologyFlags(nodes),
      storytelling,
    )
  }, [node, snapshotTemplateId, nodes, storytelling])
  const open = node !== null
  const liveMode = mode === 'live'
  const simulationMode = mode === 'simulate'
  const [liveTab, setLiveTab] = useState<'metrics' | 'logs' | 'config' | 'data'>(
    'metrics',
  )

  const prevInspectorNodeIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!node || (mode !== 'design' && mode !== 'live')) {
      prevInspectorNodeIdRef.current = null
      return
    }
    if (node.id === prevInspectorNodeIdRef.current) return
    prevInspectorNodeIdRef.current = node.id
    const template = useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
    trackEvent('component_inspector_opened', { template, componentType: node.type })
  }, [node, mode])

  useEffect(() => {
    if (!open) return
    setLiveTab('metrics')
  }, [open, selectedId])

  const onDelete = () => {
    if (!node) return
    removeNode(node.id)
    selectNode(null)
  }

  return (
    <aside
      className={`fixed top-0 right-0 z-30 flex h-full w-80 flex-col border-l border-[var(--c9-border)] bg-[var(--c9-bg)]/95 text-[var(--c9-text)] shadow-xl backdrop-blur-sm transition-transform duration-200 ease-out ${
        open ? 'translate-x-0' : 'pointer-events-none translate-x-full'
      }`}
      aria-hidden={!open}
    >
      {open && node ? (
        <>
          <header className="flex shrink-0 items-center gap-3 border-b border-[var(--c9-border)] p-4">
            <span
              className="h-10 w-10 shrink-0 rounded"
              style={{ backgroundColor: NODE_VISUAL[node.type].face }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <span className={labelClass}>Label</span>
              {!liveMode ? (
                <input
                  id="runcloud9-inspector-label"
                  type="text"
                  value={node.label}
                  onChange={(e) => updateNodeLabel(node.id, e.target.value)}
                  className={fieldClass}
                />
              ) : (
                <p className="truncate text-sm font-medium text-[var(--c9-text)]">
                  {node.label}
                </p>
              )}
              {roleLabel ? (
                <p className="mt-1 text-[10px] leading-tight text-[var(--c9-muted)]">
                  {roleLabel}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => selectNode(null)}
              className="shrink-0 rounded p-2 text-[var(--c9-muted)] transition-colors duration-200 hover:bg-[var(--c9-badge-bg)] hover:text-[var(--c9-text)]"
              aria-label="Close inspector"
            >
              ✕
            </button>
          </header>

          {liveMode ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="border-b border-[var(--c9-border)] px-4 pt-3">
                <div className="flex gap-1">
                  {(
                    [
                      ['metrics', 'Metrics'],
                      ['logs', 'Logs'],
                      ['config', 'Config'],
                      ...(node.type === 'database' || node.type === 'cache'
                        ? ([['data', 'Data']] as [string, string][])
                        : []),
                    ] as [string, string][]
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        setLiveTab(id as 'metrics' | 'logs' | 'config' | 'data')
                      }
                      className={`rounded-t-md border border-b-0 px-2.5 py-1 text-xs ${
                        liveTab === id
                          ? 'border-[var(--c9-border)] bg-[var(--c9-surface)] text-[var(--c9-text)]'
                          : 'border-transparent text-[var(--c9-muted)] hover:text-[var(--c9-text)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                {liveTab === 'metrics' ? (
                  <>
                    <ChaosActions node={node} />
                    <LiveMetrics node={node} />
                  </>
                ) : null}
                {liveTab === 'logs' ? <ComponentLogPanel key={node.id} node={node} /> : null}
                {liveTab === 'config' ? <ReadOnlyConfig node={node} /> : null}
                {liveTab === 'data' && deploymentId && node.type === 'database' ? (
                  <DataBrowser
                    deploymentId={deploymentId}
                    component={canvasToBackend[node.type]}
                  />
                ) : null}
                {liveTab === 'data' && deploymentId && node.type === 'cache' ? (
                  <CacheBrowser
                    deploymentId={deploymentId}
                    component={canvasToBackend[node.type]}
                    keyPatterns={cacheKeyPatterns}
                  />
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
                <TypeFields
                  node={node}
                  edges={edges}
                  nodes={nodes}
                  simulationMode={simulationMode}
                  updateConfig={(patch) => updateNodeConfig(node.id, patch)}
                  templateId={snapshotTemplateId}
                />
                {simulationMode ? <LiveMetrics node={node} /> : null}
              </div>
              <div className="shrink-0 border-t border-[var(--c9-border)] p-4">
                <button
                  type="button"
                  onClick={onDelete}
                  className="w-full rounded bg-red-900/80 px-4 py-2.5 text-sm font-medium text-red-100 transition-colors duration-200 hover:bg-red-800"
                >
                  Delete node
                </button>
              </div>
            </>
          )}
        </>
      ) : null}
    </aside>
  )
}

function ReadOnlyConfig({ node }: { node: CanvasNode }) {
  const c = node.config

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        Configuration
      </h3>
      <div className="flex flex-wrap gap-2">
        {node.type === 'compute' ? (
          <>
            <span className={badgeClass}>
              Replicas: {clampAppServerReplicas(c.replicas ?? 1)}
            </span>
            <span className={badgeClass}>
              Resource profile: {String(c.instanceSize ?? 'small')}
            </span>
            {provisionedBadge(node) ? (
              <span className={badgeClass}>{provisionedBadge(node)}</span>
            ) : null}
          </>
        ) : null}
        {node.type === 'database' ? (
          <>
            <span className={badgeClass}>Engine: PostgreSQL</span>
            {provisionedBadge(node) ? (
              <span className={badgeClass}>{provisionedBadge(node)}</span>
            ) : null}
          </>
        ) : null}
        {node.type === 'cache' ? (
          <>
            <span className={badgeClass}>
              Strategy: {String(c.cacheStrategy ?? 'cache-aside')}
            </span>
            {provisionedBadge(node) ? (
              <span className={badgeClass}>{provisionedBadge(node)}</span>
            ) : null}
          </>
        ) : null}
        {node.type === 'load_balancer' ? (
          <>
            <span className={badgeClass}>
              Algorithm: {String(c.algorithm ?? 'round-robin')}
            </span>
            {provisionedBadge(node) ? (
              <span className={badgeClass}>{provisionedBadge(node)}</span>
            ) : null}
          </>
        ) : null}
        {node.type === 'message_queue' ? (
          <>
            <span className={badgeClass}>Engine: RabbitMQ</span>
            {provisionedBadge(node) ? (
              <span className={badgeClass}>{provisionedBadge(node)}</span>
            ) : null}
          </>
        ) : null}
        {node.type === 'worker' ? (
          <>
            <span className={badgeClass}>
              Resource profile: {String(c.instanceSize ?? 'small')}
            </span>
            {provisionedBadge(node) ? (
              <span className={badgeClass}>{provisionedBadge(node)}</span>
            ) : null}
          </>
        ) : null}
        {node.type === 'client' ? (
          <span className={badgeClass}>External traffic source (load generator)</span>
        ) : null}
      </div>
    </div>
  )
}

const CACHE_STRATEGY_LABEL: Record<string, string> = {
  'cache-aside': 'cache-aside',
  'timeline-store': 'timeline-store',
  'write-through': 'write-through',
  'write-behind': 'write-behind',
  'read-through': 'read-through',
}

export function CacheNodeInspectorFields({
  node,
  nodes,
  edges,
  simulationMode,
  updateConfig,
  templateId,
}: {
  node: CanvasNode
  nodes: Record<string, CanvasNode>
  edges: Record<string, CanvasEdge>
  simulationMode: boolean
  updateConfig: (patch: Partial<CanvasNode['config']>) => void
  templateId?: string | null
}) {
  const c = node.config
  const strategy = String(c.cacheStrategy ?? 'cache-aside')
  const isPremiumUser = useAuthStore((s) => s.isPremium)

  const available = useMemo(
    () =>
      getAvailableCacheStrategies(node.id, nodes, edges, {
        allowProxyStrategies: isPremiumUser,
      }),
    [node.id, nodes, edges, isPremiumUser],
  )

  const ambiguousTopology = available.length === 0
  const selectValue = available.includes(strategy)
    ? strategy
    : available[0] ?? strategy
  const showProxyReadThroughNote = available.some((s) => isProxyCacheStrategy(s))
  const showProxySize = isProxyCacheStrategy(selectValue)
  const proxyInstanceSize = String(c.proxyInstanceSize ?? '').trim()
  const proxyResourceProfile = String(c.proxyResourceProfile ?? '').trim()
  const evictionPolicy = normalizeRedisEvictionPolicy(c.evictionPolicy)
  const showWriteBehindInterval = showsWriteBehindIntervalControl(
    templateId,
    selectValue,
  )
  const storedWriteBehindInterval = normalizeWriteBehindIntervalSeconds(
    c.writeBehindIntervalSeconds,
  )
  const [writeBehindDraft, setWriteBehindDraft] = useState(
    String(storedWriteBehindInterval),
  )
  const writeBehindDraftValid = isValidWriteBehindInterval(writeBehindDraft)

  const templateTtlDefault = defaultCacheTtlSecondsForTemplate(templateId)
  const storedCacheTtl = parseCacheTtlSeconds(c.cacheTtlSeconds)
  const noExpiry = storedCacheTtl === 0
  const initialPositiveTtl =
    storedCacheTtl != null && storedCacheTtl > 0
      ? storedCacheTtl
      : templateTtlDefault != null && templateTtlDefault > 0
        ? templateTtlDefault
        : 300
  const [ttlDraft, setTtlDraft] = useState(String(initialPositiveTtl))
  const [lastPositiveTtl, setLastPositiveTtl] = useState(initialPositiveTtl)
  const ttlDraftValid = isValidTimedCacheTtlSeconds(ttlDraft)
  const showVolatileWarning = showVolatileNoExpiryWarning(
    evictionPolicy,
    storedCacheTtl,
  )

  useEffect(() => {
    setWriteBehindDraft(String(storedWriteBehindInterval))
  }, [node.id, storedWriteBehindInterval])

  useEffect(() => {
    if (storedCacheTtl != null && storedCacheTtl > 0) {
      setTtlDraft(String(storedCacheTtl))
      setLastPositiveTtl(storedCacheTtl)
    } else if (storedCacheTtl === 0) {
      // Keep last positive draft while No expiry is on.
      setTtlDraft(String(lastPositiveTtl))
    } else if (templateTtlDefault != null && templateTtlDefault > 0) {
      setTtlDraft(String(templateTtlDefault))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lastPositiveTtl is intentional local memory
  }, [node.id, storedCacheTtl, templateTtlDefault])

  useEffect(() => {
    if (strategy === 'read-through') {
      useCanvasStore.getState().updateNodeConfig(node.id, {
        cacheStrategy: 'write-through',
        strategy: 'write-through',
      })
      return
    }
    if (available.length > 0 && !available.includes(strategy)) {
      useCanvasStore.getState().updateNodeConfig(node.id, {
        cacheStrategy: available[0],
        strategy: available[0],
      })
      return
    }
    // Seed proxy size when entering a proxy strategy with no explicit value.
    if (
      isProxyCacheStrategy(strategy) &&
      !proxyInstanceSize &&
      !proxyResourceProfile
    ) {
      const proxySize = defaultProxyResourceProfile(redisProfileFromConfig(c))
      useCanvasStore.getState().updateNodeConfig(node.id, {
        proxyInstanceSize: proxySize,
        proxyResourceProfile: proxySize,
      })
    }
    // Seed write-behind flush interval on URL shortener when missing.
    if (
      templateSupportsWriteBehindInterval(templateId) &&
      strategy === 'write-behind' &&
      c.writeBehindIntervalSeconds == null
    ) {
      useCanvasStore.getState().updateNodeConfig(node.id, {
        writeBehindIntervalSeconds: WRITE_BEHIND_INTERVAL_DEFAULT,
      })
    }
    // Seed cache TTL from the template default when missing.
    if (c.cacheTtlSeconds == null && templateTtlDefault != null) {
      useCanvasStore.getState().updateNodeConfig(node.id, {
        cacheTtlSeconds: templateTtlDefault,
      })
    }
  }, [
    available,
    node.id,
    strategy,
    proxyInstanceSize,
    proxyResourceProfile,
    c.instanceSize,
    c.resourceProfile,
    c.writeBehindIntervalSeconds,
    c.cacheTtlSeconds,
    templateId,
    templateTtlDefault,
  ])

  return (
    <>
      <div>
        <span className={labelClass}>Engine</span>
        <span className="inline-block rounded bg-gray-800 px-2 py-1.5 text-xs text-gray-300">
          Redis
        </span>
      </div>
      <div>
        <label className={labelClass} htmlFor="cache-strat">
          Cache strategy
        </label>
        <p className="mb-1 text-[10px] leading-snug text-[var(--c9-muted)]">
          Options follow the canvas: proxy paths (cache→database, no direct connector→database)
          vs cache-aside (connector→database, no cache→database).
        </p>
        <select
          id="cache-strat"
          className={fieldClass}
          value={selectValue}
          disabled={ambiguousTopology}
          onChange={(e) => {
            const prev = selectValue
            const next = e.target.value
            const patch: Partial<CanvasNode['config']> = {
              cacheStrategy: next,
              strategy: next,
            }
            if (isProxyCacheStrategy(next)) {
              if (!proxyInstanceSize && !proxyResourceProfile) {
                const proxySize = defaultProxyResourceProfile(
                  redisProfileFromConfig(c),
                )
                patch.proxyInstanceSize = proxySize
                patch.proxyResourceProfile = proxySize
              }
            } else {
              patch.proxyInstanceSize = undefined
              patch.proxyResourceProfile = undefined
            }
            if (
              templateSupportsWriteBehindInterval(templateId) &&
              next === 'write-behind' &&
              c.writeBehindIntervalSeconds == null
            ) {
              patch.writeBehindIntervalSeconds = WRITE_BEHIND_INTERVAL_DEFAULT
            }
            updateConfig(patch)
            const template = templateId ?? useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
            trackEvent('design_option_changed', {
              template,
              optionName: 'cache_strategy',
              previousCategory: prev,
              newCategory: next,
            })
          }}
        >
          {ambiguousTopology ? (
            <option value={strategy}>
              {CACHE_STRATEGY_LABEL[strategy] ?? strategy} (fix wiring)
            </option>
          ) : (
            available.map((v) => (
              <option key={v} value={v}>
                {CACHE_STRATEGY_LABEL[v] ?? v}
              </option>
            ))
          )}
        </select>
        {showProxyReadThroughNote ? (
          <div className="mt-2 rounded border border-[var(--c9-border)] bg-[var(--c9-bg)]/60 px-2.5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--c9-muted)]">
              Read-through (always on)
            </p>
            <p className="mt-1 text-[10px] leading-snug text-[var(--c9-muted)]">
              On a cache miss, the caching proxy loads from Postgres, refills Redis, and returns
              the value. Your app never talks to the database on reads. This applies to both
              write-through and write-behind.
            </p>
          </div>
        ) : null}
        {ambiguousTopology ? (
          <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-300">
            This wiring is invalid: a connector reaches this cache and the database while the cache
            also reaches the database. Remove either the direct connector→database link or the
            cache→database link, then pick a strategy again.
          </p>
        ) : null}
      </div>
      {showWriteBehindInterval ? (
        <div>
          <label className={labelClass} htmlFor="cache-write-behind-interval">
            Write-behind flush interval (seconds)
          </label>
          <p className="mb-1 text-[10px] leading-snug text-[var(--c9-muted)]">
            How often the proxy flushes pending writes to the database.
          </p>
          <p className="mb-1 text-[10px] leading-snug text-[var(--c9-muted)]">
            Shorter intervals reduce how long the cache can be ahead of the database. Longer
            intervals delay database writes for longer.
          </p>
          <input
            id="cache-write-behind-interval"
            type="number"
            min={WRITE_BEHIND_INTERVAL_MIN}
            max={WRITE_BEHIND_INTERVAL_MAX}
            step={1}
            className={fieldClass}
            value={writeBehindDraft}
            onChange={(e) => {
              const nextDraft = e.target.value
              setWriteBehindDraft(nextDraft)
              const commit = commitWriteBehindIntervalDraft(
                nextDraft,
                storedWriteBehindInterval,
              )
              if (!commit.ok || !commit.changed) return
              updateConfig({ writeBehindIntervalSeconds: commit.next })
              const template =
                templateId ??
                useCanvasStore.getState().snapshotTemplateId ??
                'unknown'
              trackEvent('design_option_changed', {
                template,
                optionName: 'write_behind_interval',
                previousCategory: String(storedWriteBehindInterval),
                newCategory: String(commit.next),
              })
            }}
          />
          {!writeBehindDraftValid ? (
            <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-300">
              {WRITE_BEHIND_INTERVAL_VALIDATION}
            </p>
          ) : null}
        </div>
      ) : null}
      <div>
        <label className={labelClass} htmlFor="cache-ttl">
          Cache TTL
        </label>
        <p className="mb-1 text-[10px] leading-snug text-[var(--c9-muted)]">
          {CACHE_TTL_HELPER}
        </p>
        <label className="mb-2 flex items-center gap-2 text-xs text-[var(--c9-text)]">
          <input
            id="cache-ttl-no-expiry"
            type="checkbox"
            className="rounded border-[var(--c9-border)]"
            checked={noExpiry}
            onChange={(e) => {
              const enableNoExpiry = e.target.checked
              const template =
                templateId ??
                useCanvasStore.getState().snapshotTemplateId ??
                'unknown'
              const prev = storedCacheTtl ?? templateTtlDefault ?? lastPositiveTtl
              if (enableNoExpiry) {
                if (storedCacheTtl != null && storedCacheTtl > 0) {
                  setLastPositiveTtl(storedCacheTtl)
                  setTtlDraft(String(storedCacheTtl))
                }
                updateConfig({ cacheTtlSeconds: 0 })
                if (prev !== 0) {
                  trackEvent('design_option_changed', {
                    template,
                    optionName: 'cache_ttl',
                    previousCategory: String(prev),
                    newCategory: '0',
                  })
                }
                return
              }
              const restored = lastPositiveTtl
              updateConfig({ cacheTtlSeconds: restored })
              setTtlDraft(String(restored))
              if (prev !== restored) {
                trackEvent('design_option_changed', {
                  template,
                  optionName: 'cache_ttl',
                  previousCategory: String(prev),
                  newCategory: String(restored),
                })
              }
            }}
          />
          No expiry
        </label>
        {!noExpiry ? (
          <>
            <input
              id="cache-ttl"
              type="number"
              min={CACHE_TTL_MIN}
              max={CACHE_TTL_MAX}
              step={1}
              className={fieldClass}
              value={ttlDraft}
              onChange={(e) => {
                const nextDraft = e.target.value
                setTtlDraft(nextDraft)
                const previous =
                  storedCacheTtl != null && storedCacheTtl > 0
                    ? storedCacheTtl
                    : lastPositiveTtl
                const commit = commitTimedCacheTtlDraft(nextDraft, previous)
                if (!commit.ok || !commit.changed) return
                setLastPositiveTtl(commit.next)
                updateConfig({ cacheTtlSeconds: commit.next })
                const template =
                  templateId ??
                  useCanvasStore.getState().snapshotTemplateId ??
                  'unknown'
                trackEvent('design_option_changed', {
                  template,
                  optionName: 'cache_ttl',
                  previousCategory: String(previous),
                  newCategory: String(commit.next),
                })
              }}
            />
            {!ttlDraftValid ? (
              <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-300">
                {CACHE_TTL_VALIDATION}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
      <div>
        <label className={labelClass} htmlFor="cache-eviction">
          Eviction policy
        </label>
        <p className="mb-1 text-[10px] leading-snug text-[var(--c9-muted)]">
          When Redis reaches its memory limit, this policy decides which keys it may remove to
          make room. TTL expiry is separate: a key disappears when its TTL ends even if memory is
          not full.
        </p>
        <select
          id="cache-eviction"
          className={fieldClass}
          value={evictionPolicy}
          title={REDIS_EVICTION_POLICY_DESCRIPTION[evictionPolicy]}
          onChange={(e) =>
            {
              const prev = normalizeRedisEvictionPolicy(c.evictionPolicy)
              const next = normalizeRedisEvictionPolicy(e.target.value)
              updateConfig({ evictionPolicy: next })
              const template = useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
              trackEvent('design_option_changed', {
                template,
                optionName: 'eviction_policy',
                previousCategory: prev,
                newCategory: next,
              })
            }
          }
        >
          {REDIS_EVICTION_POLICIES.map((p) => (
            <option
              key={p}
              value={p}
              title={REDIS_EVICTION_POLICY_DESCRIPTION[p]}
            >
              {REDIS_EVICTION_POLICY_LABEL[p]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[10px] leading-snug text-[var(--c9-muted)]">
          {REDIS_EVICTION_POLICY_DESCRIPTION[evictionPolicy]}
        </p>
        {showVolatileWarning ? (
          <p className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[10px] leading-snug text-amber-700 dark:text-amber-200">
            {VOLATILE_NO_EXPIRY_WARNING}
          </p>
        ) : null}
      </div>
      <ResourceProfileFields
        idPrefix="cache"
        nodeType="cache"
        config={c}
        label="Redis size"
        helperText="Sizes redis-internal. Memory limit for eviction comes from this profile."
        updateConfig={updateConfig}
      />
      {showProxySize ? (
        <ResourceProfileFields
          idPrefix="cache-proxy"
          nodeType="cache"
          config={c}
          label="Proxy size"
          configKey="proxyInstanceSize"
          updateConfig={updateConfig}
        />
      ) : null}
      {simulationMode ? (
        <>
          <div>
            <label className={labelClass} htmlFor="cache-cap">
              Capacity override (RPS, optional)
            </label>
            <input
              id="cache-cap"
              type="number"
              min={1}
              step={1}
              placeholder="Auto"
              className={fieldClass}
              value={
                Number.isFinite(Number(c.nodeCapacityRps)) &&
                Number(c.nodeCapacityRps) > 0
                  ? String(Number(c.nodeCapacityRps))
                  : ''
              }
              onChange={(e) => {
                const v = e.target.value.trim()
                if (!v) {
                  updateConfig({ nodeCapacityRps: undefined })
                  return
                }
                const n = Number(v)
                if (Number.isFinite(n) && n > 0) {
                  updateConfig({ nodeCapacityRps: n })
                }
              }}
            />
          </div>
        </>
      ) : null}
    </>
  )
}

function TypeFields({
  node,
  edges,
  nodes,
  simulationMode,
  updateConfig,
  templateId,
}: {
  node: CanvasNode
  edges: Record<string, CanvasEdge>
  nodes: Record<string, CanvasNode>
  simulationMode: boolean
  updateConfig: (patch: Partial<CanvasNode['config']>) => void
  templateId?: string | null
}) {
  const currentUser = useAuthStore((s) => s.currentUser)
  const userRecord = useAuthStore((s) => s.userRecord)
  const maxAppReplicas =
    currentUser?.limits.maxAppServerReplicas ??
    maxAppServerReplicasForUser(userRecord)
  const c = node.config

  switch (node.type) {
    case 'load_balancer':
      return (
        <div className="space-y-4">
          <div>
            <label className={labelClass} htmlFor="lb-algo">
              Algorithm
            </label>
            <select
              id="lb-algo"
              className={fieldClass}
              value={String(c.algorithm ?? c.lbAlgorithm ?? 'round-robin')}
              onChange={(e) => {
                const prev = String(c.algorithm ?? c.lbAlgorithm ?? 'round-robin')
                const v = e.target.value
                updateConfig({ algorithm: v, lbAlgorithm: v })
                const template = useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
                trackEvent('design_option_changed', {
                  template,
                  optionName: 'lb_algorithm',
                  previousCategory: prev,
                  newCategory: v,
                })
              }}
            >
              {simulationMode ? (
                <>
                  <option value="round-robin">round-robin</option>
                  <option value="weighted">weighted (use backend weights)</option>
                  <option value="least-connections">least-connections</option>
                  <option value="weighted-least-connections">
                    weighted-least-connections
                  </option>
                  <option value="ip-hash">ip-hash</option>
                  <option value="least-response-time">least-response-time</option>
                  <option value="random">random (seeded)</option>
                  <option value="least-bandwidth">least-bandwidth</option>
                </>
              ) : (
                <>
                  <option value="round-robin">round-robin</option>
                  <option value="least_conn">least_conn</option>
                  <option value="ip_hash">ip_hash</option>
                </>
              )}
            </select>
          </div>
          <ResourceProfileFields
            idPrefix="lb"
            nodeType="load_balancer"
            config={c}
            showDefaultOption
            updateConfig={updateConfig}
          />
          {simulationMode ? (
            <>
              <div>
                <label className={labelClass} htmlFor="lb-cap">
                  Capacity override (RPS, optional)
                </label>
                <input
                  id="lb-cap"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Auto"
                  className={fieldClass}
                  value={
                    Number.isFinite(Number(c.nodeCapacityRps)) &&
                    Number(c.nodeCapacityRps) > 0
                      ? String(Number(c.nodeCapacityRps))
                      : ''
                  }
                  onChange={(e) => {
                    const v = e.target.value.trim()
                    if (!v) {
                      updateConfig({ nodeCapacityRps: undefined })
                      return
                    }
                    const n = Number(v)
                    if (Number.isFinite(n) && n > 0) {
                      updateConfig({ nodeCapacityRps: n })
                    }
                  }}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="lb-weights">
                  Backend weights (JSON: node id → weight)
                </label>
                <textarea
                  id="lb-weights"
                  rows={3}
                  className={fieldClass}
                  placeholder='{"app-a":3,"app-b":1}'
                  defaultValue={
                    c.backendWeights &&
                    typeof c.backendWeights === 'object' &&
                    !Array.isArray(c.backendWeights)
                      ? JSON.stringify(c.backendWeights, null, 2)
                      : ''
                  }
                  key={JSON.stringify(c.backendWeights ?? null)}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (!v) {
                      updateConfig({ backendWeights: undefined })
                      return
                    }
                    try {
                      const parsed = JSON.parse(v) as unknown
                      if (
                        parsed &&
                        typeof parsed === 'object' &&
                        !Array.isArray(parsed)
                      ) {
                        updateConfig({
                          backendWeights: parsed as Record<string, number>,
                        })
                      }
                    } catch {
                      /* keep previous */
                    }
                  }}
                />
              </div>
            </>
          ) : null}
        </div>
      )

    case 'compute': {
      const replicas = clampAppServerReplicas(c.replicas ?? 1, maxAppReplicas)
      return (
        <>
          <div>
            <label className={labelClass} htmlFor="compute-replicas">
              Replicas
            </label>
            <p className="mb-1 text-[10px] leading-snug text-[var(--c9-muted)]">
              One app-server on the canvas; deploy scales Kubernetes pods (
              {APP_SERVER_REPLICA_MIN}–{maxAppReplicas}). Click an
              existing app server on the grid to add another replica slot.
            </p>
            <input
              id="compute-replicas"
              type="number"
              min={APP_SERVER_REPLICA_MIN}
              max={maxAppReplicas}
              step={1}
              className={fieldClass}
              value={replicas}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (!Number.isFinite(n)) return
                const prev = replicas
                const next = clampAppServerReplicas(n, maxAppReplicas)
                updateConfig({ replicas: next })
                if (next > 1) {
                  ensureLoadBalancerForReplicas()
                }
                const template = useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
                trackEvent('design_option_changed', {
                  template,
                  optionName: 'replicas',
                  previousCategory: String(prev),
                  newCategory: String(next),
                })
              }}
            />
          </div>
          <ResourceProfileFields
            idPrefix="compute"
            nodeType="compute"
            config={c}
            updateConfig={updateConfig}
          />
          {simulationMode ? (
            <div>
              <label className={labelClass} htmlFor="compute-cap">
                Capacity override (RPS, optional)
              </label>
              <input
                id="compute-cap"
                type="number"
                min={1}
                step={1}
                placeholder="Auto"
                className={fieldClass}
                value={
                  Number.isFinite(Number(c.nodeCapacityRps)) &&
                  Number(c.nodeCapacityRps) > 0
                    ? String(Number(c.nodeCapacityRps))
                    : ''
                }
                onChange={(e) => {
                  const v = e.target.value.trim()
                  if (!v) {
                    updateConfig({ nodeCapacityRps: undefined })
                    return
                  }
                  const n = Number(v)
                  if (Number.isFinite(n) && n > 0) {
                    updateConfig({ nodeCapacityRps: n })
                  }
                }}
              />
            </div>
          ) : null}
        </>
      )
    }

    case 'database': {
      return (
        <>
          <div>
            <span className={labelClass}>Engine</span>
            <span className="inline-block rounded bg-gray-800 px-2 py-1.5 text-xs text-gray-300">
              PostgreSQL
            </span>
          </div>
          <ResourceProfileFields
            idPrefix="database"
            nodeType="database"
            config={c}
            updateConfig={updateConfig}
          />
          {simulationMode ? (
            <>
              <div>
                <label className={labelClass} htmlFor="db-cap">
                  Capacity override (RPS, optional)
                </label>
                <input
                  id="db-cap"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Auto"
                  className={fieldClass}
                  value={
                    Number.isFinite(Number(c.nodeCapacityRps)) &&
                    Number(c.nodeCapacityRps) > 0
                      ? String(Number(c.nodeCapacityRps))
                      : ''
                  }
                  onChange={(e) => {
                    const v = e.target.value.trim()
                    if (!v) {
                      updateConfig({ nodeCapacityRps: undefined })
                      return
                    }
                    const n = Number(v)
                    if (Number.isFinite(n) && n > 0) {
                      updateConfig({ nodeCapacityRps: n })
                    }
                  }}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="db-replicas">
                  Read replicas
                </label>
                <input
                  id="db-replicas"
                  type="number"
                  min={0}
                  max={10}
                  className={fieldClass}
                  value={Number(c.readReplicas ?? 0)}
                  onChange={(e) =>
                    updateConfig({
                      readReplicas: clamp(Number(e.target.value) || 0, 0, 10),
                    })
                  }
                />
              </div>
            </>
          ) : null}
        </>
      )
    }

    case 'cache':
      return (
        <CacheNodeInspectorFields
          node={node}
          nodes={nodes}
          edges={edges}
          simulationMode={simulationMode}
          updateConfig={updateConfig}
          templateId={templateId}
        />
      )

    case 'message_queue':
      return (
        <>
          <div>
            <span className={labelClass}>Engine</span>
            <span className="inline-block rounded bg-gray-800 px-2 py-1.5 text-xs text-gray-300">
              RabbitMQ
            </span>
          </div>
          <ResourceProfileFields
            idPrefix="mq"
            nodeType="message_queue"
            config={c}
            showDefaultOption
            updateConfig={updateConfig}
          />
          {simulationMode ? (
            <>
              <div>
                <label className={labelClass} htmlFor="mq-parts">
                  Partitions
                </label>
                <input
                  id="mq-parts"
                  type="number"
                  min={1}
                  max={32}
                  className={fieldClass}
                  value={Number(c.partitions ?? 1)}
                  onChange={(e) =>
                    updateConfig({
                      partitions: clamp(Number(e.target.value) || 1, 1, 32),
                    })
                  }
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="mq-cap">
                  Capacity override (RPS, optional)
                </label>
                <input
                  id="mq-cap"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Auto"
                  className={fieldClass}
                  value={
                    Number.isFinite(Number(c.nodeCapacityRps)) &&
                    Number(c.nodeCapacityRps) > 0
                      ? String(Number(c.nodeCapacityRps))
                      : ''
                  }
                  onChange={(e) => {
                    const v = e.target.value.trim()
                    if (!v) {
                      updateConfig({ nodeCapacityRps: undefined })
                      return
                    }
                    const n = Number(v)
                    if (Number.isFinite(n) && n > 0) {
                      updateConfig({ nodeCapacityRps: n })
                    }
                  }}
                />
              </div>
            </>
          ) : null}
        </>
      )

    case 'worker': {
      return (
        <>
          <ResourceProfileFields
            idPrefix="worker"
            nodeType="worker"
            config={c}
            updateConfig={updateConfig}
          />
          {simulationMode ? (
            <div>
              <label className={labelClass} htmlFor="worker-cap">
                Capacity override (RPS, optional)
              </label>
              <input
                id="worker-cap"
                type="number"
                min={1}
                step={1}
                placeholder="Auto"
                className={fieldClass}
                value={
                  Number.isFinite(Number(c.nodeCapacityRps)) &&
                  Number(c.nodeCapacityRps) > 0
                    ? String(Number(c.nodeCapacityRps))
                    : ''
                }
                onChange={(e) => {
                  const v = e.target.value.trim()
                  if (!v) {
                    updateConfig({ nodeCapacityRps: undefined })
                    return
                  }
                  const n = Number(v)
                  if (Number.isFinite(n) && n > 0) {
                    updateConfig({ nodeCapacityRps: n })
                  }
                }}
              />
            </div>
          ) : null}
        </>
      )
    }

    default:
      return null
  }
}
