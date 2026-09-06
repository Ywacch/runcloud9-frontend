import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  normalizePurchaseMode,
  purchaseModeFromConfig,
  PURCHASE_MODE_HELP,
  purchasePathInfo,
  seedEventCapacityFromConfig,
  seedEventNameFromConfig,
  SEED_EVENT_CAPACITY_MAX,
  SEED_EVENT_CAPACITY_MIN,
  templateSupportsPurchaseMode,
} from '../lib/purchaseMode'
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
  LIVE_LB_ALGORITHMS,
  clampAppServerReplicas,
  clampReadReplicas,
  lbAlgorithmForDeploy,
} from '../lib/replicaConfig'
import {
  READ_CONSISTENCY_CLAMP_HINT,
  READ_CONSISTENCY_HELP,
  READ_CONSISTENCY_LABEL,
  READ_CONSISTENCY_POLICIES,
  readConsistencyFromConfig,
  readConsistencyOptionDisabled,
  readConsistencyRequiresMultipleReplicas,
} from '../lib/readConsistency'
import { syncAutoLoadBalancerForReplicas } from '../lib/ensureLoadBalancerForReplicas'
import { normalizeInstanceSizes } from '../lib/instanceSizes'
import { maxAppServerReplicasForUser, maxInstanceSizeForUser, resolveEffectiveTier, resourceQuotaTier, topologyLimitsForTier, type InstanceSize } from '../lib/userTier'
import { snapshotToDeploymentDesign } from '../lib/deployPayload'
import {
  canvasQuotaForDisplay,
  designExceedsResourceQuota,
  displayQuotaTierLabel,
  toResourceBudgetErrorResponse,
} from '../lib/sumDesignBudget'
import { useAuthStore } from '../product/stores/authStore'
import {
  REPLICAS_HELP_FREE,
  replicasHelpPaid,
  UPGRADE_TO_SCALE_REPLICAS_TOOLTIP,
} from '../lib/billingCopy'
import { NODE_VISUAL } from '../lib/nodeVisual'
import { canvasToBackend } from '../lib/typeMapping'
import {
  useCanvasStore,
  type CanvasEdge,
  type CanvasNode,
} from '../editor-core/stores/canvasStore'
import { useTemplateRegistryStore } from '../editor-core/stores/templateRegistryStore'
import { DbInstanceTabBar } from './DbInstanceTabBar'
import {
  dbHasReplicaLayers,
  instanceTabsForNode,
} from '../lib/dbInstanceScope'
import { devInstanceScopePreviewEnabled } from '../lib/devInstanceScopePreview'
import { useMetricsStore } from '../editor-core/stores/metricsStore'
import { useLogStore } from '../editor-core/stores/logStore'
import { isEngineerPreviewLocked } from '../lib/engineerLockedVisual'
import { CacheBrowser } from './CacheBrowser'
import { ComponentLogPanel } from './ComponentLogPanel'
import { DataBrowser } from './DataBrowser'
import { EngineerLockedInspectorNotice } from './EngineerLockedInspectorNotice'
import { QueueBrowser } from './QueueBrowser'
import { ChaosActions } from './ChaosActions'
import { LiveMetrics } from './LiveMetrics'
import { ResourceProfileFields } from './ResourceProfileFields'
import { InstanceSizeCopyFields } from './InstanceSizeCopyFields'
import { InfoTooltip } from './InfoTooltip'
import { InlineDisclosure } from './InlineDisclosure'
import { WorkerInspectorFields } from './WorkerInspectorFields'
import { getResourceProfilesCached } from '../lib/resourceProfileStore'
import {
  formatProvisionedShort,
  resolveProvisionedLimits,
} from '../lib/resolveProvisionedLimits'
import { trackEvent } from '../lib/analytics'
import {
  readLatencyQuantile,
  writeLatencyQuantile,
} from '../lib/latencyQuantile'
import {
  PanelViewControls,
  type PanelViewState,
} from './inspectorPanelUi'
import {
  filterStrategiesForVariation,
  variationCacheStrategyMode,
} from '../lib/variationTopologyLock'
import { isVariationTopologyLocked } from '../lib/variationTopologyLock'

const fieldClass =
  'w-full rounded border border-[var(--c9-border)] bg-[var(--c9-bg)] px-3 py-2 text-sm text-[var(--c9-text)] focus:border-[var(--c9-accent)] focus:outline-none'
const labelClass = 'mb-1 block text-xs uppercase tracking-wider text-[var(--c9-muted)]'
const badgeClass =
  'rounded border border-[var(--c9-border)] bg-[var(--c9-surface)] px-2 py-1 text-xs text-[var(--c9-muted)]'

const INSPECTOR_MIN_W = 420
const INSPECTOR_MAX_W = 900

function clampInspectorWidth(px: number): number {
  const cap = Math.min(INSPECTOR_MAX_W, Math.round(window.innerWidth * 0.55))
  return Math.min(cap, Math.max(INSPECTOR_MIN_W, Math.round(px)))
}

function defaultInspectorWidth(): number {
  return clampInspectorWidth(INSPECTOR_MIN_W)
}

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
  const loadedVariationId = useCanvasStore((s) => s.loadedVariationId)
  const templatePresetMode = useCanvasStore((s) => s.templatePresetMode)
  const deploymentId = useCanvasStore((s) => s.deploymentId)
  const selectedInstanceId = useCanvasStore((s) => s.selectedInstanceId)
  const setSelectedInstanceId = useCanvasStore((s) => s.setSelectedInstanceId)
  const isPremiumUser = useAuthStore((s) => s.isPremium)
  const currentUser = useAuthStore((s) => s.currentUser)
  const userRecord = useAuthStore((s) => s.userRecord)
  const effectiveTier =
    currentUser?.effectiveTier ?? resolveEffectiveTier(userRecord)
  const quotaTier = currentUser?.quotaTier ?? resourceQuotaTier(effectiveTier)
  const templateInfo = useTemplateRegistryStore((s) =>
    snapshotTemplateId ? s.byId[snapshotTemplateId] : undefined,
  )
  const storytelling = templateInfo?.storytelling
  const cacheKeyPatterns = templateInfo?.introspection?.cache?.keyPatterns

  const inspectorNodeId =
    selectedIds.length === 1 ? selectedIds[0] : selectedId
  const node = inspectorNodeId ? (nodes[inspectorNodeId] ?? null) : null
  const nodeMetrics = useMetricsStore((s) =>
    node ? s.metrics[node.id] : undefined,
  )
  const instanceTabs = instanceTabsForNode(node, nodeMetrics)
  const showInstanceTabs = instanceTabs.length > 0
  const showDbDataInstanceTabs =
    node?.type === 'database' &&
    nodeMetrics != null &&
    dbHasReplicaLayers(nodeMetrics.layers)
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
  const devInstanceScopePreview = devInstanceScopePreviewEnabled(mode)
  const engineerPreviewLocked =
    node != null &&
    isEngineerPreviewLocked({
      nodeType: node.type,
      isFreeUser: !isPremiumUser,
      mode: templatePresetMode,
    })
  const variationTopologyLocked = isVariationTopologyLocked(loadedVariationId)
  const quotaDisplay = useMemo(() => {
    if (liveMode || simulationMode || !snapshotTemplateId) return null
    try {
      const design = snapshotToDeploymentDesign(
        useCanvasStore.getState().exportJSON(),
        { mutateCanvas: false },
      )
      const over = designExceedsResourceQuota(design, quotaTier)
      return over
        ? canvasQuotaForDisplay(toResourceBudgetErrorResponse(over), quotaTier)
        : null
    } catch {
      return null
    }
  }, [liveMode, simulationMode, snapshotTemplateId, nodes, edges, quotaTier])
  const [liveTab, setLiveTab] = useState<'metrics' | 'logs' | 'config' | 'data'>(
    'metrics',
  )
  const [metricsPanelView, setMetricsPanelView] = useState<PanelViewState>(() => ({
    timeframe: 'live',
    showGraphs: true,
    latencyQuantile: readLatencyQuantile(),
  }))
  const patchMetricsPanelView = useCallback((patch: Partial<PanelViewState>) => {
    setMetricsPanelView((view) => {
      const next = { ...view, ...patch }
      if (patch.latencyQuantile) {
        writeLatencyQuantile(patch.latencyQuantile)
      }
      return next
    })
  }, [])
  const showLiveInstanceTabs =
    showInstanceTabs && (liveTab === 'metrics' || liveTab === 'logs')
  const showLiveMetricsControls = liveTab === 'metrics' && node?.type !== 'client'
  const showLiveStickyChrome =
    showLiveInstanceTabs ||
    (showDbDataInstanceTabs && liveTab === 'data') ||
    showLiveMetricsControls
  const inspectorTabNonce = useLogStore((s) => s.inspectorTabNonce)
  const [dockWidth, setDockWidth] = useState(defaultInspectorWidth)
  const resizeDragRef = useRef<{ startX: number; startW: number } | null>(null)

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
    const pending = useLogStore.getState().takePendingInspectorTab()
    setLiveTab(pending ?? 'metrics')
  }, [open, selectedId, inspectorTabNonce])

  useEffect(() => {
    const onResize = () => setDockWidth((w) => clampInspectorWidth(w))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = resizeDragRef.current
      if (!drag) return
      const delta = drag.startX - e.clientX
      setDockWidth(clampInspectorWidth(drag.startW + delta))
    }
    const onUp = () => {
      resizeDragRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  const onDelete = () => {
    if (!node || variationTopologyLocked) return
    removeNode(node.id)
    selectNode(null)
  }

  return (
    <aside
      className={`relative flex h-full shrink-0 flex-col overflow-hidden bg-[var(--c9-bg)]/95 text-[var(--c9-text)] transition-[width] duration-200 ease-out ${
        open
          ? 'border-l border-[var(--c9-border)]'
          : 'pointer-events-none w-0 border-0'
      }`}
      style={open ? { width: dockWidth } : undefined}
      aria-hidden={!open}
    >
      {open ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize inspector"
          className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize hover:bg-[var(--c9-accent)]/40"
          onPointerDown={(e) => {
            e.preventDefault()
            resizeDragRef.current = { startX: e.clientX, startW: dockWidth }
          }}
        />
      ) : null}
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
              {!liveMode &&
              !engineerPreviewLocked &&
              !variationTopologyLocked &&
              !deploymentId ? (
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
              <span aria-hidden className="text-sm font-medium">
                X
              </span>
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
                      ...(node.type === 'database' ||
                      node.type === 'cache' ||
                      node.type === 'message_queue'
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
              {showLiveStickyChrome ? (
                <div className="shrink-0 space-y-2 border-b border-[var(--c9-border)] bg-[var(--c9-bg)]/95 px-4 py-2">
                  {showLiveInstanceTabs ? (
                    <DbInstanceTabBar
                      tabs={instanceTabs}
                      selectedId={selectedInstanceId}
                      onSelect={setSelectedInstanceId}
                    />
                  ) : null}
                  {showDbDataInstanceTabs && liveTab === 'data' ? (
                    <DbInstanceTabBar
                      tabs={instanceTabs}
                      selectedId={selectedInstanceId}
                      onSelect={setSelectedInstanceId}
                    />
                  ) : null}
                  {showLiveMetricsControls ? (
                    <PanelViewControls
                      view={metricsPanelView}
                      onChange={patchMetricsPanelView}
                    />
                  ) : null}
                </div>
              ) : null}
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                {liveTab === 'metrics' ? (
                  <>
                    <ChaosActions node={node} />
                    <LiveMetrics
                      node={node}
                      hideControls
                      panelView={metricsPanelView}
                      onPanelViewChange={patchMetricsPanelView}
                    />
                  </>
                ) : null}
                {liveTab === 'logs' ? (
                  <ComponentLogPanel
                    key={node.id}
                    node={node}
                    instanceId={selectedInstanceId}
                  />
                ) : null}
                {liveTab === 'config' ? (
                  <div className="space-y-4">
                    <TypeFields
                      node={node}
                      edges={edges}
                      nodes={nodes}
                      simulationMode={false}
                      readOnly
                      updateConfig={() => {}}
                      templateId={snapshotTemplateId}
                    />
                    {provisionedBadge(node) ? (
                      <p className={`${badgeClass} inline-block`}>
                        Provisioned: {provisionedBadge(node)}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {liveTab === 'data' && deploymentId && node.type === 'database' ? (
                  <DataBrowser
                    deploymentId={deploymentId}
                    component={canvasToBackend[node.type]}
                    readReplicaCount={clampReadReplicas(node.config.readReplicas)}
                    instanceId={showDbDataInstanceTabs ? selectedInstanceId : null}
                    hideTargetToggle={showDbDataInstanceTabs}
                  />
                ) : null}
                {liveTab === 'data' && deploymentId && node.type === 'cache' ? (
                  <CacheBrowser
                    deploymentId={deploymentId}
                    component={canvasToBackend[node.type]}
                    keyPatterns={cacheKeyPatterns}
                  />
                ) : null}
                {liveTab === 'data' &&
                deploymentId &&
                node.type === 'message_queue' ? (
                  <QueueBrowser
                    deploymentId={deploymentId}
                    component={canvasToBackend[node.type]}
                  />
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
                {engineerPreviewLocked ? <EngineerLockedInspectorNotice /> : null}
                <TypeFields
                  node={node}
                  edges={edges}
                  nodes={nodes}
                  simulationMode={simulationMode}
                  readOnly={engineerPreviewLocked || Boolean(deploymentId)}
                  loadedVariationId={loadedVariationId}
                  updateConfig={
                    engineerPreviewLocked || deploymentId
                      ? () => {}
                      : (patch) => updateNodeConfig(node.id, patch)
                  }
                  templateId={snapshotTemplateId}
                />
                {quotaDisplay ? (
                  <p className="text-[11px] leading-snug text-amber-300/90">
                    This design is {quotaDisplay.requested.cpu} /{' '}
                    {quotaDisplay.requested.memory}, but{' '}
                    {displayQuotaTierLabel(quotaTier)} allows {quotaDisplay.cap.cpu} /{' '}
                    {quotaDisplay.cap.memory} on the canvas. Downsize nodes or replicas to
                    deploy.
                  </p>
                ) : null}
                {simulationMode ? <LiveMetrics node={node} /> : null}
                {devInstanceScopePreview ? (
                  <div className="space-y-4 border-t border-[var(--c9-border)] pt-4">
                    <p className="text-[10px] uppercase tracking-wide text-amber-400/90">
                      DEV instance-scope preview
                    </p>
                    {showInstanceTabs ? (
                      <DbInstanceTabBar
                        tabs={instanceTabs}
                        selectedId={selectedInstanceId}
                        onSelect={setSelectedInstanceId}
                      />
                    ) : null}
                    <LiveMetrics node={node} />
                  </div>
                ) : null}
              </div>
              <div className="shrink-0 border-t border-[var(--c9-border)] p-4">
                {!variationTopologyLocked && !deploymentId ? (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="w-full rounded bg-red-900/80 px-4 py-2.5 text-sm font-medium text-red-100 transition-colors duration-200 hover:bg-red-800"
                  >
                    Delete node
                  </button>
                ) : null}
              </div>
            </>
          )}
        </>
      ) : null}
    </aside>
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
  readOnly = false,
  loadedVariationId = null,
  maxInstanceSize = 'large',
}: {
  node: CanvasNode
  nodes: Record<string, CanvasNode>
  edges: Record<string, CanvasEdge>
  simulationMode: boolean
  updateConfig: (patch: Partial<CanvasNode['config']>) => void
  templateId?: string | null
  readOnly?: boolean
  loadedVariationId?: string | null
  maxInstanceSize?: InstanceSize
}) {
  const c = node.config
  const currentUser = useAuthStore((s) => s.currentUser)
  const userRecord = useAuthStore((s) => s.userRecord)
  const allowProxyStrategies =
    currentUser?.limits.allowProxyCache ??
    topologyLimitsForTier(resolveEffectiveTier(userRecord)).allowProxyCache
  const strategyMode = variationCacheStrategyMode(loadedVariationId)
  const strategyLocked = strategyMode === 'frozen'

  const available = useMemo(
    () =>
      filterStrategiesForVariation(
        getAvailableCacheStrategies(node.id, nodes, edges, {
          allowProxyStrategies,
        }),
        loadedVariationId,
      ),
    [node.id, nodes, edges, allowProxyStrategies, loadedVariationId],
  )

  const strategy = String(c.cacheStrategy ?? 'cache-aside')

  const ambiguousTopology = available.length === 0
  const strategyReadOnly = readOnly || strategyLocked
  const selectValue = strategyReadOnly
    ? strategy
    : available.includes(strategy)
      ? strategy
      : available[0] ?? strategy
  const showProxyReadThroughNote = strategyReadOnly
    ? isProxyCacheStrategy(strategy)
    : available.some((s) => isProxyCacheStrategy(s))
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
    if (readOnly) return
    if (strategyLocked) return
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
    readOnly,
    strategyLocked,
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
        <select
          id="cache-strat"
          className={`${fieldClass}${strategyReadOnly || ambiguousTopology ? ' cursor-not-allowed opacity-60' : ''}`}
          value={selectValue}
          disabled={strategyReadOnly || ambiguousTopology}
          onChange={(e) => {
            if (strategyReadOnly) return
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
          {strategyReadOnly || ambiguousTopology ? (
            <option value={strategy}>
              {CACHE_STRATEGY_LABEL[strategy] ?? strategy}
              {!strategyReadOnly && ambiguousTopology ? ' (fix wiring)' : ''}
            </option>
          ) : (
            available.map((v) => (
              <option key={v} value={v}>
                {CACHE_STRATEGY_LABEL[v] ?? v}
              </option>
            ))
          )}
        </select>
        <InlineDisclosure label="How strategies differ">
          Proxy needs cache-to-database. Cache-aside needs the app talking to the
          database.
        </InlineDisclosure>
        {showProxyReadThroughNote ? (
          <InlineDisclosure label="Read-through (always on)">
            On miss, the proxy loads from Postgres and refills Redis. The app does
            not read the database.
          </InlineDisclosure>
        ) : null}
        {!strategyReadOnly && ambiguousTopology ? (
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
            <span className="inline-flex items-center gap-1">
              Write-behind flush interval (seconds)
              <InfoTooltip text="How often the proxy flushes writes to the database." />
            </span>
          </label>
          <input
            id="cache-write-behind-interval"
            type="number"
            min={WRITE_BEHIND_INTERVAL_MIN}
            max={WRITE_BEHIND_INTERVAL_MAX}
            step={1}
            className={`${fieldClass}${readOnly ? ' cursor-not-allowed opacity-60' : ''}`}
            value={writeBehindDraft}
            disabled={readOnly}
            title="Shorter keeps cache and database closer. Longer delays durable writes."
            onChange={(e) => {
              if (readOnly) return
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
          <span className="inline-flex items-center gap-1">
            Cache TTL
            <InfoTooltip text={CACHE_TTL_HELPER} />
          </span>
        </label>
        <label className="mb-2 flex items-center gap-2 text-xs text-[var(--c9-text)]">
          <input
            id="cache-ttl-no-expiry"
            type="checkbox"
            className="rounded border-[var(--c9-border)]"
            checked={noExpiry}
            disabled={readOnly}
            onChange={(e) => {
              if (readOnly) return
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
              className={`${fieldClass}${readOnly ? ' cursor-not-allowed opacity-60' : ''}`}
              value={ttlDraft}
              disabled={readOnly}
              onChange={(e) => {
                if (readOnly) return
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
        <InlineDisclosure label="TTL vs eviction">
          TTL is a per-key timer set when the key is written. Eviction is a
          memory-pressure policy that removes keys when maxmemory is reached.
          Both can remove the same key, but they operate independently.
        </InlineDisclosure>
      </div>
      <div>
        <label className={labelClass} htmlFor="cache-eviction">
          <span className="inline-flex items-center gap-1">
            Eviction policy
            <InfoTooltip text="How Redis frees memory when full. TTL expiry is independent." />
          </span>
        </label>
        <select
          id="cache-eviction"
          className={`${fieldClass}${readOnly ? ' cursor-not-allowed opacity-60' : ''}`}
          value={evictionPolicy}
          disabled={readOnly}
          onChange={(e) =>
            {
              if (readOnly) return
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
        <InlineDisclosure label="What this means">
          {REDIS_EVICTION_POLICY_DESCRIPTION[evictionPolicy]}
        </InlineDisclosure>
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
        readOnly={readOnly}
        maxInstanceSize={maxInstanceSize}
      />
      {showProxySize ? (
        <ResourceProfileFields
          idPrefix="cache-proxy"
          nodeType="cache"
          config={c}
          label="Proxy size"
          configKey="proxyInstanceSize"
          updateConfig={updateConfig}
          readOnly={readOnly}
        maxInstanceSize={maxInstanceSize}
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
  readOnly = false,
  loadedVariationId = null,
}: {
  node: CanvasNode
  edges: Record<string, CanvasEdge>
  nodes: Record<string, CanvasNode>
  simulationMode: boolean
  updateConfig: (patch: Partial<CanvasNode['config']>) => void
  templateId?: string | null
  readOnly?: boolean
  loadedVariationId?: string | null
}) {
  const currentUser = useAuthStore((s) => s.currentUser)
  const userRecord = useAuthStore((s) => s.userRecord)
  const maxAppReplicas =
    currentUser?.limits.maxAppServerReplicas ??
    maxAppServerReplicasForUser(userRecord)
  const maxInstanceSize = maxInstanceSizeForUser(
    userRecord,
    currentUser?.limits,
  )
  const c = node.config

  switch (node.type) {
    case 'load_balancer': {
      const rawAlgo = String(c.algorithm ?? c.lbAlgorithm ?? 'round-robin')
      const liveAlgo = lbAlgorithmForDeploy(rawAlgo)
      return (
        <div className="space-y-4">
          <div>
            <label className={labelClass} htmlFor="lb-algo">
              Algorithm
            </label>
            <select
              id="lb-algo"
              className={`${fieldClass}${readOnly ? ' cursor-not-allowed opacity-60' : ''}`}
              value={simulationMode ? rawAlgo : liveAlgo}
              disabled={readOnly}
              onChange={(e) => {
                if (readOnly) return
                const prev = simulationMode ? rawAlgo : liveAlgo
                const v = e.target.value
                const next = simulationMode ? v : lbAlgorithmForDeploy(v)
                updateConfig({ algorithm: next, lbAlgorithm: next })
                const template = useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
                trackEvent('design_option_changed', {
                  template,
                  optionName: 'lb_algorithm',
                  previousCategory: prev,
                  newCategory: next,
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
                LIVE_LB_ALGORITHMS.map((algo) => (
                  <option key={algo} value={algo}>
                    {algo}
                  </option>
                ))
              )}
            </select>
          </div>
          {!simulationMode ? (
            <>
              <div>
                <label className={`${labelClass} flex items-center gap-2 normal-case`}>
                  <input
                    id="lb-weight-by-size"
                    type="checkbox"
                    className={readOnly ? 'cursor-not-allowed opacity-60' : ''}
                    checked={Boolean(c.weightByInstanceSize)}
                    disabled={readOnly}
                    onChange={(e) => {
                      if (readOnly) return
                      updateConfig({ weightByInstanceSize: e.target.checked })
                    }}
                  />
                  <span className="inline-flex items-center gap-1">
                    Weight by instance size
                    <InfoTooltip text="Off: equal share per pod. On: small 1, medium 2, large 4." />
                  </span>
                </label>
              </div>
              <div>
                <label className={labelClass} htmlFor="lb-rate-limit-per-ip">
                  <span className="inline-flex items-center gap-1">
                    Per-IP request limit (RPS)
                    <InfoTooltip text="0 = off. Nginx 429s that virtual client above this RPS." />
                  </span>
                </label>
                <input
                  id="lb-rate-limit-per-ip"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  className={`${fieldClass}${readOnly ? ' cursor-not-allowed opacity-60' : ''}`}
                  value={Number(c.rateLimitPerIp ?? 0)}
                  disabled={readOnly}
                  onChange={(e) => {
                    if (readOnly) return
                    const next = Math.min(
                      100,
                      Math.max(0, Math.floor(Number(e.target.value) || 0)),
                    )
                    updateConfig({ rateLimitPerIp: next })
                  }}
                />
              </div>
            </>
          ) : null}
          <ResourceProfileFields
            idPrefix="lb"
            nodeType="load_balancer"
            config={c}
            showDefaultOption
            updateConfig={updateConfig}
            readOnly={readOnly}
        maxInstanceSize={maxInstanceSize}
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
    }

    case 'compute': {
      const replicas = clampAppServerReplicas(c.replicas ?? 1, maxAppReplicas)
      const replicasLocked = maxAppReplicas <= 1
      const replicasDisabled = readOnly || replicasLocked
      const purchaseMode = purchaseModeFromConfig(c)
      const showPurchaseMode = templateSupportsPurchaseMode(templateId)
      const pathInfo = purchasePathInfo(purchaseMode)
      const seedName = seedEventNameFromConfig(c)
      const seedCapacity = seedEventCapacityFromConfig(c)
      return (
        <>
          <div>
            <label className={labelClass} htmlFor="compute-replicas">
              <span className="inline-flex items-center gap-1">
                Replicas
                <InfoTooltip
                  text={
                    replicasLocked
                      ? REPLICAS_HELP_FREE
                      : replicasHelpPaid(maxAppReplicas)
                  }
                />
              </span>
            </label>
            <input
              id="compute-replicas"
              type="number"
              min={APP_SERVER_REPLICA_MIN}
              max={maxAppReplicas}
              step={1}
              className={`${fieldClass}${replicasDisabled ? ' cursor-not-allowed opacity-60' : ''}`}
              value={replicas}
              readOnly={replicasDisabled}
              disabled={replicasDisabled}
              title={
                !readOnly && replicasLocked
                  ? UPGRADE_TO_SCALE_REPLICAS_TOOLTIP
                  : undefined
              }
              onChange={(e) => {
                if (replicasDisabled) return
                const n = Number(e.target.value)
                if (!Number.isFinite(n)) return
                const prev = replicas
                const next = clampAppServerReplicas(n, maxAppReplicas)
                const sizes = normalizeInstanceSizes(c, next)
                updateConfig({
                  replicas: next,
                  instanceSizes: sizes,
                  instanceSize: sizes[0],
                })
                syncAutoLoadBalancerForReplicas()
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
          {replicas > 1 ? (
            <InstanceSizeCopyFields
              idPrefix="compute"
              config={c}
              replicaCount={replicas}
              updateConfig={updateConfig}
              readOnly={readOnly}
        maxInstanceSize={maxInstanceSize}
            />
          ) : (
            <ResourceProfileFields
              idPrefix="compute"
              nodeType="compute"
              config={c}
              updateConfig={(patch) => {
                const size = String(patch.instanceSize ?? c.instanceSize ?? 'small')
                updateConfig({
                  ...patch,
                  instanceSizes: [size],
                  instanceSize: size,
                })
              }}
              readOnly={readOnly}
        maxInstanceSize={maxInstanceSize}
            />
          )}
          {showPurchaseMode ? (
            <div>
              <label className={labelClass} htmlFor="compute-purchase-mode">
                <span className="inline-flex items-center gap-1">
                  Purchase mode
                  <InfoTooltip text={PURCHASE_MODE_HELP} />
                </span>
              </label>
              <select
                id="compute-purchase-mode"
                className={`${fieldClass}${readOnly ? ' cursor-not-allowed opacity-60' : ''}`}
                value={purchaseMode}
                disabled={readOnly}
                onChange={(e) => {
                  if (readOnly) return
                  const prev = purchaseMode
                  const next = normalizePurchaseMode(e.target.value)
                  updateConfig({ purchaseMode: next })
                  const template =
                    templateId ?? useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
                  trackEvent('design_option_changed', {
                    template,
                    optionName: 'purchase_mode',
                    previousCategory: prev,
                    newCategory: next,
                  })
                }}
              >
                <option value="unsafe">Unsafe (app read-then-write)</option>
                <option value="safe">Row lock (FOR UPDATE)</option>
                <option value="optimistic">Conditional UPDATE</option>
              </select>
              <div className="mt-2 rounded-md border border-[var(--c9-border)]/80 bg-[var(--c9-bg)]/60 px-2.5 py-2">
                <p className="text-[10px] font-medium text-[var(--c9-text)]">
                  {pathInfo.layer}
                </p>
                <ul className="mt-1.5 space-y-1 font-mono text-[10px] leading-relaxed text-[var(--c9-muted)]">
                  {pathInfo.sql.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <p className="mt-2 text-[10px] leading-relaxed text-[var(--c9-muted)]">
                  {pathInfo.underDrop}
                </p>
              </div>
            </div>
          ) : null}
          {showPurchaseMode ? (
            <>
              <div>
                <label className={labelClass} htmlFor="compute-seed-event-name">
                  Event name
                </label>
                <input
                  id="compute-seed-event-name"
                  type="text"
                  className={`${fieldClass}${readOnly ? ' cursor-not-allowed opacity-60' : ''}`}
                  value={seedName}
                  readOnly={readOnly}
                  disabled={readOnly}
                  onChange={(e) => {
                    if (readOnly) return
                    updateConfig({ seedEventName: e.target.value })
                  }}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="compute-seed-event-capacity">
                  Ticket capacity
                </label>
                <input
                  id="compute-seed-event-capacity"
                  type="number"
                  min={SEED_EVENT_CAPACITY_MIN}
                  max={SEED_EVENT_CAPACITY_MAX}
                  step={1}
                  className={`${fieldClass}${readOnly ? ' cursor-not-allowed opacity-60' : ''}`}
                  value={seedCapacity}
                  readOnly={readOnly}
                  disabled={readOnly}
                  onChange={(e) => {
                    if (readOnly) return
                    const n = Number(e.target.value)
                    if (!Number.isFinite(n)) return
                    updateConfig({ seedEventCapacity: Math.floor(n) })
                  }}
                />
              </div>
            </>
          ) : null}
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
      const readReplicas = clampReadReplicas(c.readReplicas)
      const dbInstanceCount = 1 + readReplicas
      const readConsistency = readConsistencyFromConfig(c.readConsistency)
      const showReadConsistencyClampHint =
        readConsistencyRequiresMultipleReplicas(readConsistency) &&
        readReplicas < 2
      return (
        <>
          <div>
            <span className={labelClass}>Engine</span>
            <span className="inline-block rounded bg-gray-800 px-2 py-1.5 text-xs text-gray-300">
              PostgreSQL
            </span>
          </div>
          {readReplicas >= 1 ? (
            <InstanceSizeCopyFields
              idPrefix="database"
              config={c}
              replicaCount={dbInstanceCount}
              updateConfig={updateConfig}
              readOnly={readOnly}
        maxInstanceSize={maxInstanceSize}
              labelForIndex={(i) =>
                i === 0 ? 'Primary size' : `Replica ${i} size`
              }
            />
          ) : (
            <ResourceProfileFields
              idPrefix="database"
              nodeType="database"
              config={c}
              updateConfig={(patch) => {
                const size = String(patch.instanceSize ?? c.instanceSize ?? 'small')
                updateConfig({
                  ...patch,
                  instanceSizes: [size],
                  instanceSize: size,
                })
              }}
              readOnly={readOnly}
        maxInstanceSize={maxInstanceSize}
            />
          )}
          <div>
            <label className={labelClass} htmlFor="db-read-replicas">
              Read replicas
            </label>
            <input
              id="db-read-replicas"
              type="number"
              min={0}
              max={2}
              step={1}
              className={`${fieldClass}${readOnly ? ' cursor-not-allowed opacity-60' : ''}`}
              value={readReplicas}
              readOnly={readOnly}
              disabled={readOnly}
              onChange={(e) => {
                if (readOnly) return
                const next = clampReadReplicas(Number(e.target.value))
                const sizeCount = 1 + next
                const sizes = normalizeInstanceSizes(c, sizeCount)
                updateConfig({
                  readReplicas: next,
                  instanceSizes: sizes,
                  instanceSize: sizes[0],
                  replicationMode:
                    next === 0
                      ? 'async'
                      : String(c.replicationMode ?? 'async'),
                })
              }}
            />
          </div>
          {readReplicas >= 1 ? (
            <>
              <div>
                <label className={labelClass} htmlFor="db-read-consistency">
                  <span className="inline-flex items-center gap-1">
                    Read consistency
                    <InfoTooltip text="How app reads are routed when read replicas are provisioned." />
                  </span>
                </label>
                <select
                  id="db-read-consistency"
                  className={`${fieldClass}${readOnly ? ' cursor-not-allowed opacity-60' : ''}`}
                  value={readConsistency}
                  disabled={readOnly}
                  onChange={(e) => {
                    if (readOnly) return
                    const prev = readConsistency
                    const next = readConsistencyFromConfig(e.target.value)
                    updateConfig({ readConsistency: next })
                    const template =
                      useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
                    trackEvent('design_option_changed', {
                      template,
                      optionName: 'read_consistency',
                      previousCategory: prev,
                      newCategory: next,
                    })
                  }}
                >
                  {READ_CONSISTENCY_POLICIES.map((policy) => (
                    <option
                      key={policy}
                      value={policy}
                      disabled={
                        !readOnly &&
                        readConsistencyOptionDisabled(policy, readReplicas)
                      }
                      title={READ_CONSISTENCY_HELP[policy]}
                    >
                      {READ_CONSISTENCY_LABEL[policy]}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {READ_CONSISTENCY_HELP[readConsistency]}
                </p>
                {showReadConsistencyClampHint ? (
                  <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-300">
                    {READ_CONSISTENCY_CLAMP_HINT}
                  </p>
                ) : null}
              </div>
              <div>
                <label className={labelClass} htmlFor="db-replication-mode">
                  Replication
                </label>
                <select
                  id="db-replication-mode"
                  className={`${fieldClass}${readOnly ? ' cursor-not-allowed opacity-60' : ''}`}
                  value={
                    String(c.replicationMode ?? 'async') === 'sync'
                      ? 'sync'
                      : 'async'
                  }
                  disabled={readOnly}
                  onChange={(e) => {
                    if (readOnly) return
                    updateConfig({ replicationMode: e.target.value })
                  }}
                >
                  <option value="async">Async</option>
                  <option value="sync">Sync</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Async: replica may lag. Sync: commits wait for standby.
                </p>
              </div>
            </>
          ) : null}
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
          readOnly={readOnly}
          loadedVariationId={loadedVariationId}
        maxInstanceSize={maxInstanceSize}
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
            readOnly={readOnly}
        maxInstanceSize={maxInstanceSize}
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

    case 'worker':
      return (
        <WorkerInspectorFields
          config={c}
          updateConfig={updateConfig}
          readOnly={readOnly}
        maxInstanceSize={maxInstanceSize}
          simulationMode={simulationMode}
        />
      )

    case 'client':
      return (
        <p className="text-xs text-[var(--c9-muted)]">
          External traffic source (load generator)
        </p>
      )

    default:
      return null
  }
}

/** Test and story helper for database TypeFields. */
export function DatabaseNodeInspectorFields({
  node,
  nodes,
  edges,
  simulationMode = false,
  updateConfig,
  readOnly = false,
}: {
  node: CanvasNode
  nodes: Record<string, CanvasNode>
  edges: Record<string, CanvasEdge>
  simulationMode?: boolean
  updateConfig: (patch: Partial<CanvasNode['config']>) => void
  readOnly?: boolean
}) {
  return TypeFields({
    node: { ...node, type: 'database' },
    nodes,
    edges,
    simulationMode,
    updateConfig,
    readOnly,
  })
}
