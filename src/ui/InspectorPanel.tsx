import { useEffect, useMemo, useState } from 'react'
import {
  getAvailableCacheStrategies,
} from '../lib/cacheTopologyStrategy'
import { getTopologyFlags, resolveRole } from '../lib/componentRole'
import { NODE_VISUAL } from '../lib/nodeVisual'
import { getRelevantTemplateMetrics } from '../lib/templateMetricsFilter'
import { canvasToBackend } from '../lib/typeMapping'
import {
  useCanvasStore,
  type CanvasEdge,
  type CanvasNode,
} from '../store/canvasStore'
import { useTemplateRegistryStore } from '../store/templateRegistryStore'
import { useMetricsStore } from '../store/metricsStore'
import { CacheBrowser } from './CacheBrowser'
import { ComponentLogPanel } from './ComponentLogPanel'
import { DataBrowser } from './DataBrowser'
import { LiveMetrics } from './LiveMetrics'
import { TemplateMetricsSnippet } from './TemplateMetricsSnippet'

const fieldClass =
  'w-full rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-3 py-2 text-sm text-[var(--c9-text)] focus:border-[var(--c9-accent)] focus:outline-none'
const labelClass = 'mb-1 block text-xs uppercase tracking-wider text-[var(--c9-muted)]'
const badgeClass =
  'rounded border border-[var(--c9-border)] bg-[var(--c9-surface)] px-2 py-1 text-xs text-[var(--c9-muted)]'

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function InspectorPanel() {
  const mode = useCanvasStore((s) => s.mode)
  const selectedId = useCanvasStore((s) => s.selectedId)
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const selectNode = useCanvasStore((s) => s.selectNode)
  const updateNodeConfig = useCanvasStore((s) => s.updateNodeConfig)
  const updateNodeLabel = useCanvasStore((s) => s.updateNodeLabel)
  const removeNode = useCanvasStore((s) => s.removeNode)
  const templateMetrics = useMetricsStore((s) => s.templateMetrics)
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)
  const deploymentId = useCanvasStore((s) => s.deploymentId)
  const storytelling = useTemplateRegistryStore((s) =>
    snapshotTemplateId ? s.byId[snapshotTemplateId]?.storytelling : undefined,
  )

  const node = selectedId ? (nodes[selectedId] ?? null) : null
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
  const componentType = node ? canvasToBackend[node.type] : ''
  const relevantTemplateMetrics =
    node && liveMode
      ? getRelevantTemplateMetrics(templateMetrics, componentType)
      : {}
  const [liveTab, setLiveTab] = useState<'metrics' | 'logs' | 'config' | 'data'>(
    'metrics',
  )

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
                    <TemplateMetricsSnippet templateMetrics={relevantTemplateMetrics} />
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
              Resource profile: {String(c.instanceSize ?? 'small')}
            </span>
          </>
        ) : null}
        {node.type === 'database' ? (
          <>
            <span className={badgeClass}>Engine: PostgreSQL</span>
          </>
        ) : null}
        {node.type === 'cache' ? (
          <>
            <span className={badgeClass}>
              Strategy: {String(c.cacheStrategy ?? 'cache-aside')}
            </span>
          </>
        ) : null}
        {node.type === 'load_balancer' ? (
          <span className={badgeClass}>
            Algorithm: {String(c.algorithm ?? 'round-robin')}
          </span>
        ) : null}
        {node.type === 'message_queue' ? (
          <>
            <span className={badgeClass}>Engine: RabbitMQ</span>
          </>
        ) : null}
        {node.type === 'worker' ? (
          <>
            <span className={badgeClass}>
              Resource profile: {String(c.instanceSize ?? 'small')}
            </span>
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

function CacheNodeInspectorFields({
  node,
  nodes,
  edges,
  simulationMode,
  updateConfig,
}: {
  node: CanvasNode
  nodes: Record<string, CanvasNode>
  edges: Record<string, CanvasEdge>
  simulationMode: boolean
  updateConfig: (patch: Partial<CanvasNode['config']>) => void
}) {
  const c = node.config
  const strategy = String(c.cacheStrategy ?? 'cache-aside')

  const available = useMemo(
    () => getAvailableCacheStrategies(node.id, nodes, edges),
    [node.id, nodes, edges],
  )

  useEffect(() => {
    if (available.length > 0 && !available.includes(strategy)) {
      useCanvasStore.getState().updateNodeConfig(node.id, {
        cacheStrategy: available[0],
      })
    }
  }, [available, node.id, strategy])

  const ambiguousTopology = available.length === 0
  const selectValue = available.includes(strategy)
    ? strategy
    : available[0] ?? strategy

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
          onChange={(e) => updateConfig({ cacheStrategy: e.target.value })}
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
        {ambiguousTopology ? (
          <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-300">
            This wiring is invalid: a connector reaches this cache and the database while the cache
            also reaches the database. Remove either the direct connector→database link or the
            cache→database link, then pick a strategy again.
          </p>
        ) : null}
      </div>
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
}: {
  node: CanvasNode
  edges: Record<string, CanvasEdge>
  nodes: Record<string, CanvasNode>
  simulationMode: boolean
  updateConfig: (patch: Partial<CanvasNode['config']>) => void
}) {
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
              value={String(c.algorithm ?? 'round-robin')}
              onChange={(e) => updateConfig({ algorithm: e.target.value })}
            >
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
            </select>
          </div>
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
      const instanceSize = String(c.instanceSize ?? 'small')
      return (
        <>
          <div>
            <label className={labelClass} htmlFor="compute-size">
              Resource profile
            </label>
            <p className="mb-1 text-[10px] leading-snug text-[var(--c9-muted)]">
              Adjusts Kubernetes CPU/memory reservations; performance impact depends on
              workload bottlenecks.
            </p>
            <select
              id="compute-size"
              className={fieldClass}
              value={instanceSize}
              onChange={(e) => updateConfig({ instanceSize: e.target.value })}
            >
              <option value="small">small</option>
              <option value="medium">medium</option>
              <option value="large">large</option>
            </select>
          </div>
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
      const instanceSize = String(c.instanceSize ?? 'small')
      return (
        <>
          <div>
            <label className={labelClass} htmlFor="worker-size">
              Resource profile
            </label>
            <p className="mb-1 text-[10px] leading-snug text-[var(--c9-muted)]">
              Adjusts Kubernetes CPU/memory reservations; performance impact depends on
              workload bottlenecks.
            </p>
            <select
              id="worker-size"
              className={fieldClass}
              value={instanceSize}
              onChange={(e) => updateConfig({ instanceSize: e.target.value })}
            >
              <option value="small">small</option>
              <option value="medium">medium</option>
              <option value="large">large</option>
            </select>
          </div>
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
