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
  REPLICATION_MODES,
  SYNC_COMMIT_LEVELS,
  clampAppServerReplicas,
  clampReadReplicas,
  lbAlgorithmForDeploy,
  replicationModeFromConfig,
  requiresSynchronousReplication,
  syncCommitLevelFromConfig,
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
import { maxAppServerReplicasForUser, maxInstanceSizeForUser, quotaTierFromAuth, resolveEffectiveTier, topologyLimitsForTier, type InstanceSize } from '../lib/userTier'
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
} from '../lib/billingCopy'
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
  dbReplicaLayerIds,
  instanceTabsForNode,
  usesPodReplicaScope,
} from '../lib/dbInstanceScope'
import { devInspectorDeploymentId } from '../lib/devInspectorFixtures'
import { useDevInspectorMode } from '../lib/devInspectorMode'
import { devInstanceScopePreviewEnabled } from '../lib/devInstanceScopePreview'
import { useMetricsStore } from '../editor-core/stores/metricsStore'
import { useLogStore } from '../editor-core/stores/logStore'
import { isEngineerPreviewLocked } from '../lib/engineerLockedVisual'
import { CacheBrowser } from './CacheBrowser'
import { StacklabLogPanel, stacklabLogCountForNode } from './StacklabLogPanel'
import { DataBrowser } from './DataBrowser'
import { EngineerLockedInspectorNotice } from './EngineerLockedInspectorNotice'
import { QueueBrowser } from './QueueBrowser'
import { ChaosActions } from './ChaosActions'
import { CacheStrategyBanner } from './cacheInspectorSections'
import { DevInspectorModeToggle } from './DevInspectorModeToggle'
import {
  PcfgChk,
  PcfgField,
  PcfgNum,
  PcfgOptions,
  PcfgStepper,
} from './stacklabConfigControls'
import { StacklabDeployedConfig } from './stacklabDeployedConfig'
import { SlHint } from './stacklabPanePrimitives'
import { LiveMetrics } from './LiveMetrics'
import { ResourceProfileFields } from './ResourceProfileFields'
import { InstanceSizeCopyFields } from './InstanceSizeCopyFields'
import { WorkerInspectorFields } from './WorkerInspectorFields'
import { getResourceProfilesCached } from '../lib/resourceProfileStore'
import {
  formatProvisionedShort,
  resolveProvisionedLimits,
} from '../lib/resolveProvisionedLimits'
import { trackEvent } from '../lib/analytics'
import { resolveCacheCanvasFocus } from '../lib/cacheCanvasFocus'
import {
  readLatencyQuantile,
  writeLatencyQuantile,
} from '../lib/latencyQuantile'
import {
  PanelViewControls,
  stacklabNodeKind,
  type PanelViewState,
} from './inspectorPanelUi'
import { InspectorBreadcrumbNav } from './InspectorBreadcrumbNav'
import {
  defaultMetricGroupId,
  metricGroupsForNode,
  panelViewVisibilityForGroup,
  resolveMetricGroupId,
  type InspectorMetricGroupId,
} from '../lib/inspectorMetricGroups'
import {
  filterStrategiesForVariation,
  variationCacheStrategyMode,
} from '../lib/variationTopologyLock'
import { isVariationTopologyLocked } from '../lib/variationTopologyLock'

const INSPECTOR_MIN_W = 400
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
  const currentUser = useAuthStore((s) => s.currentUser)
  const userRecord = useAuthStore((s) => s.userRecord)
  const session = useAuthStore((s) => s.session)
  const quotaTier = quotaTierFromAuth(
    currentUser,
    userRecord,
    Boolean(session),
  )
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
  const replicaLayerIds = useMemo(
    () => (nodeMetrics ? dbReplicaLayerIds(nodeMetrics.layers) : []),
    [nodeMetrics],
  )
  const showInstanceTabs = instanceTabs.length > 0

  useEffect(() => {
    if (!selectedInstanceId || selectedInstanceId === 'cluster') return
    const tabIds = instanceTabs.map((tab) => tab.id)
    if (!tabIds.includes(selectedInstanceId)) {
      setSelectedInstanceId('cluster')
    }
  }, [instanceTabs, selectedInstanceId, setSelectedInstanceId])
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
  const engineerPreviewLocked =
    node != null &&
    isEngineerPreviewLocked({
      nodeType: node.type,
      isFreeUser: currentUser
        ? currentUser.effectiveTier === 'free'
        : !session,
      mode: templatePresetMode,
    })
  useDevInspectorMode()
  const devMetricsPreview = devInstanceScopePreviewEnabled(mode)
  const inspectorLiveChrome = liveMode || devMetricsPreview
  const inspectorDeployment = devInspectorDeploymentId(
    liveMode,
    devMetricsPreview,
    deploymentId,
  )
  const variationTopologyLocked = isVariationTopologyLocked(loadedVariationId)
  const quotaDisplay = useMemo(() => {
    if (liveMode || simulationMode || !snapshotTemplateId || !quotaTier) return null
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
  const metricGroupByTypeRef = useRef<Record<string, InspectorMetricGroupId>>({})
  const [metricGroupId, setMetricGroupId] = useState<InspectorMetricGroupId>(() =>
    node ? defaultMetricGroupId(node) : 'health',
  )
  const prevMetricNodeTypeRef = useRef<string | null>(null)
  useEffect(() => {
    if (!node) return
    if (prevMetricNodeTypeRef.current !== node.type) {
      prevMetricNodeTypeRef.current = node.type
      const stored = metricGroupByTypeRef.current[node.type]
      setMetricGroupId(resolveMetricGroupId(node, stored, nodeMetrics))
      return
    }
    setMetricGroupId((current) =>
      resolveMetricGroupId(node, current, nodeMetrics),
    )
  }, [node, nodeMetrics])
  const selectMetricGroup = useCallback(
    (id: InspectorMetricGroupId) => {
      if (!node) return
      metricGroupByTypeRef.current[node.type] = id
      setMetricGroupId(id)
    },
    [node],
  )
  const panelViewVisibility = panelViewVisibilityForGroup(metricGroupId)
  const cacheStrategyLabel =
    node?.type === 'cache'
      ? (nodeMetrics?.cacheStrategy ?? '').trim() ||
        String(node.config.cacheStrategy ?? 'cache-aside')
      : null
  const showMetricBreadcrumb =
    liveTab === 'metrics' && node != null && node.type !== 'client'
  const showLiveInstanceTabs =
    showInstanceTabs &&
    (liveTab === 'metrics' || liveTab === 'logs') &&
    (node?.type === 'database' || (node != null && usesPodReplicaScope(node)))
  const showPodScopeToggle =
    Boolean(node) &&
    usesPodReplicaScope(node) &&
    instanceTabs.some((tab) => tab.id !== 'cluster')
  const showLiveMetricsControls = liveTab === 'metrics' && node?.type !== 'client'
  const showLiveStickyChrome =
    showLiveInstanceTabs ||
    (showDbDataInstanceTabs && liveTab === 'data') ||
    showLiveMetricsControls
  const inspectorTabNonce = useLogStore((s) => s.inspectorTabNonce)
  const allLogs = useLogStore((s) => s.logs)
  const logTabCount = node ? stacklabLogCountForNode(node, allLogs) : 0
  const clientInert = node?.type === 'client'
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
    trackEvent('component_inspector_opened', {
      template,
      componentType: node.type,
      componentId: node.id,
      context: mode === 'live' ? 'live' : 'design',
    })
  }, [node, mode])

  useEffect(() => {
    if (!open) return
    const pending = useLogStore.getState().takePendingInspectorTab()
    setLiveTab(pending ?? 'metrics')
  }, [open, selectedId, inspectorTabNonce])

  const cacheFocusNodeId = useRef<string | null>(null)
  const cacheFocusPending = useRef(false)
  useEffect(() => {
    if (!node) {
      cacheFocusNodeId.current = null
      cacheFocusPending.current = false
      return
    }
    if (cacheFocusNodeId.current !== node.id) {
      cacheFocusNodeId.current = node.id
      cacheFocusPending.current = node.type === 'cache'
    }
    if (!cacheFocusPending.current || !nodeMetrics) return
    cacheFocusPending.current = false
    const focus = resolveCacheCanvasFocus(nodeMetrics)
    if (
      !focus?.metricGroup ||
      (focus.severity !== 'warning' && focus.severity !== 'error')
    ) {
      return
    }
    metricGroupByTypeRef.current.cache = focus.metricGroup
    setMetricGroupId(focus.metricGroup)
    setLiveTab('metrics')
  }, [node, nodeMetrics])

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
      className={`sl-inspector inspector${open ? '' : ' pointer-events-none'}`}
      style={
        open
          ? { width: dockWidth, flex: `0 0 ${dockWidth}px` }
          : { width: 0, flex: '0 0 0', overflow: 'hidden', border: 0 }
      }
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
          <header className="ins-head">
            <div className="ins-head-top">
              <span className="kind">
                {stacklabNodeKind(node.type)}
                {inspectorLiveChrome ? '' : ' · PREDEPLOY'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {import.meta.env.DEV && mode === 'design' ? (
                  <DevInspectorModeToggle compact />
                ) : null}
                <button
                  type="button"
                  onClick={() => selectNode(null)}
                  className="close"
                  aria-label="Close inspector"
                >
                  <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden>
                    <path
                      d="M0.5 0.5 L8.5 8.5 M8.5 0.5 L0.5 8.5"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                  </svg>
                </button>
              </div>
            </div>
            {!inspectorLiveChrome &&
            !engineerPreviewLocked &&
            !variationTopologyLocked &&
            !deploymentId ? (
              <>
                <label className="sr-only" htmlFor="runcloud9-inspector-label">
                  Label
                </label>
                <input
                  id="runcloud9-inspector-label"
                  type="text"
                  value={node.label}
                  onChange={(e) => updateNodeLabel(node.id, e.target.value)}
                  style={{
                    fontFamily: 'var(--disp)',
                    fontSize: 19,
                    fontWeight: 600,
                    letterSpacing: '-0.015em',
                    marginTop: 9,
                    width: '100%',
                    background: 'transparent',
                    border: 0,
                    color: 'var(--ink)',
                  }}
                />
              </>
            ) : (
              <h1>{node.label}</h1>
            )}
            {roleLabel ? <p className="role">{roleLabel}</p> : null}
            {inspectorLiveChrome && (provisionedBadge(node) || inspectorDeployment) ? (
              <div className="head-meta">
                {provisionedBadge(node) ? <span>{provisionedBadge(node)}</span> : null}
                {inspectorDeployment ? (
                  <>
                    {provisionedBadge(node) ? (
                      <span style={{ color: 'var(--ink-4)' }}>/</span>
                    ) : null}
                    <span>deploy {inspectorDeployment.slice(0, 8)}</span>
                  </>
                ) : null}
              </div>
            ) : null}
            {!inspectorLiveChrome ? (
              <div className="head-meta">
                <span>draft</span>
                <span style={{ color: 'var(--ink-4)' }}>/</span>
                <span>ns·prod</span>
                <span style={{ color: 'var(--ink-4)' }}>/</span>
                <span>not deployed</span>
              </div>
            ) : null}
          </header>

          {inspectorLiveChrome ? (
            <>
              {!clientInert ? (
                <nav className="tabs" aria-label="Inspector panels">
                  {(
                    [
                      ['metrics', 'metrics'],
                      ['logs', 'logs'],
                      ['config', 'config'],
                      ...(node.type === 'database' ||
                      node.type === 'cache' ||
                      node.type === 'message_queue'
                        ? ([['data', 'data']] as [string, string][])
                        : []),
                    ] as [string, string][]
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`tab ${liveTab === id ? 'is-on' : ''}`}
                      onClick={() =>
                        setLiveTab(id as 'metrics' | 'logs' | 'config' | 'data')
                      }
                    >
                      {label}
                      {id === 'metrics' ? (
                        <span className="tab-count">
                          {metricGroupsForNode(node, nodeMetrics).length}
                        </span>
                      ) : null}
                      {id === 'logs' && logTabCount > 0 ? (
                        <span className="tab-count">{logTabCount}</span>
                      ) : null}
                    </button>
                  ))}
                </nav>
              ) : null}
              {showLiveStickyChrome ? (
                <div className="shrink-0">
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
                      showScope={showPodScopeToggle}
                      scopeValue={
                        !selectedInstanceId || selectedInstanceId === 'cluster'
                          ? 'cluster'
                          : 'instance'
                      }
                      scopeOptions={['cluster', 'instance']}
                      onScopeChange={(scope) => {
                        if (scope === 'cluster') {
                          setSelectedInstanceId('cluster')
                          return
                        }
                        const firstPod = instanceTabs.find((tab) => tab.id !== 'cluster')
                        if (firstPod) setSelectedInstanceId(firstPod.id)
                      }}
                      showTimeframe={panelViewVisibility.showTimeframe}
                      showGraphsToggle={panelViewVisibility.showGraphs}
                    />
                  ) : null}
                  {liveTab === 'metrics' && node.type !== 'client' ? (
                    <ChaosActions
                      node={node}
                      previewMode={devMetricsPreview && !liveMode}
                    />
                  ) : null}
                  {liveTab === 'metrics' && cacheStrategyLabel ? (
                    <CacheStrategyBanner strategy={cacheStrategyLabel} />
                  ) : null}
                  {showMetricBreadcrumb ? (
                    <InspectorBreadcrumbNav
                      node={node}
                      m={nodeMetrics}
                      activeGroupId={metricGroupId}
                      onSelectGroup={selectMetricGroup}
                      title={node.label}
                    />
                  ) : null}
                </div>
              ) : null}
              <div className="body">
                {clientInert ? (
                  <section className="sec">
                    <p className="note">
                      <b>i</b>Client is an external traffic source. Select a deployed component
                      on the canvas to inspect metrics.
                    </p>
                  </section>
                ) : null}
                {!clientInert && liveTab === 'metrics' ? (
                  <>
                    <LiveMetrics
                      node={node}
                      hideControls
                      displayMode={devMetricsPreview && !liveMode ? 'live' : undefined}
                      metricsPreviewActive={devMetricsPreview && !liveMode}
                      panelView={metricsPanelView}
                      onPanelViewChange={patchMetricsPanelView}
                      metricGroup={metricGroupId}
                      onSelectMetricGroup={selectMetricGroup}
                      onOpenDataTab={() => setLiveTab('data')}
                      showLatencyControls={panelViewVisibility.showLatency}
                    />
                  </>
                ) : null}
                {!clientInert && liveTab === 'logs' ? (
                  <StacklabLogPanel
                    key={node.id}
                    node={node}
                    instanceId={selectedInstanceId}
                    replicaLayerIds={
                      node.type === 'database' ? replicaLayerIds : undefined
                    }
                    onOpenMetrics={() => setLiveTab('metrics')}
                  />
                ) : null}
                {!clientInert && liveTab === 'config' ? (
                  <section className="sec">
                    <StacklabDeployedConfig
                      node={node}
                      nodes={nodes}
                      edges={edges}
                      metrics={nodeMetrics}
                    />
                    <SlHint direction="forward" onClick={() => setLiveTab('metrics')}>
                      Limits feed <b>Metrics</b>
                    </SlHint>
                  </section>
                ) : null}
                {!clientInert && liveTab === 'data' && inspectorDeployment && node.type === 'database' ? (
                  <section className="sec">
                    <DataBrowser
                      deploymentId={inspectorDeployment}
                      component={canvasToBackend[node.type]}
                      readReplicaCount={clampReadReplicas(node.config.readReplicas)}
                      instanceId={showDbDataInstanceTabs ? selectedInstanceId : null}
                      hideTargetToggle={showDbDataInstanceTabs}
                    />
                  </section>
                ) : null}
                {!clientInert && liveTab === 'data' && inspectorDeployment && node.type === 'cache' ? (
                  <section className="sec">
                    <CacheBrowser
                      deploymentId={inspectorDeployment}
                      component={canvasToBackend[node.type]}
                      keyPatterns={cacheKeyPatterns}
                    />
                  </section>
                ) : null}
                {!clientInert &&
                liveTab === 'data' &&
                inspectorDeployment &&
                node.type === 'message_queue' ? (
                  <section className="sec">
                    <QueueBrowser
                      deploymentId={inspectorDeployment}
                      component={canvasToBackend[node.type]}
                      queueName={String(node.config.queueName ?? 'orders').trim() || 'orders'}
                    />
                  </section>
                ) : null}
              </div>
              <div className="panel-foot">
                <span>
                  <span className={`live-sq${liveMode ? '' : ' paused'}`} />
                  <span>
                    {liveMode ? 'LIVE' : 'PREVIEW'} ·{' '}
                    {metricsPanelView.timeframe === 'session' ? 'SESSION · AGGREGATE' : '10s WINDOW'}
                    {!clientInert ? (
                      <>
                        {' '}
                        ·{' '}
                        {!selectedInstanceId || selectedInstanceId === 'cluster'
                          ? 'cluster'
                          : 'instance'}
                      </>
                    ) : null}
                  </span>
                </span>
                <span>{node.label}</span>
              </div>
            </>
          ) : (
            <>
              <div className="body">
                <section className="sec">
                  {engineerPreviewLocked ? <EngineerLockedInspectorNotice /> : null}
                  <div className="pcfg-stack">
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
                  </div>
                  {quotaDisplay ? (
                    <p className="note amber">
                      <b>!</b>
                      This design is {quotaDisplay.requested.cpu} / {quotaDisplay.requested.memory},
                      but {displayQuotaTierLabel(quotaTier)} allows {quotaDisplay.cap.cpu} /{' '}
                      {quotaDisplay.cap.memory} on the canvas. Downsize nodes or replicas to deploy.
                    </p>
                  ) : null}
                  {simulationMode ? <LiveMetrics node={node} /> : null}
                </section>
                {!variationTopologyLocked && !deploymentId ? (
                  <section className="sec">
                    <button
                      type="button"
                      className="btn danger"
                      style={{ display: 'block', width: '100%', textAlign: 'center' }}
                      onClick={onDelete}
                    >
                      Delete node
                    </button>
                  </section>
                ) : null}
              </div>
              <div className="panel-foot">
                <span>
                  <span className="live-sq paused" />
                  DRAFT · NOT DEPLOYED
                </span>
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

  const strategyOptions =
    strategyReadOnly || ambiguousTopology
      ? [
          {
            value: strategy,
            label: `${CACHE_STRATEGY_LABEL[strategy] ?? strategy}${
              !strategyReadOnly && ambiguousTopology ? ' (fix wiring)' : ''
            }`,
          },
        ]
      : available.map((v) => ({ value: v, label: CACHE_STRATEGY_LABEL[v] ?? v }))

  const applyStrategy = (next: string) => {
    if (strategyReadOnly) return
    const prev = selectValue
    const patch: Partial<CanvasNode['config']> = {
      cacheStrategy: next,
      strategy: next,
    }
    if (isProxyCacheStrategy(next)) {
      if (!proxyInstanceSize && !proxyResourceProfile) {
        const proxySize = defaultProxyResourceProfile(redisProfileFromConfig(c))
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
  }

  return (
    <>
      <PcfgField
        label="Strategy"
        sub={
          showProxyReadThroughNote
            ? 'Proxy needs cache-to-database. Read-through refills Redis on miss.'
            : 'Whether writes go through the cache or are written to the store first.'
        }
      >
        <PcfgOptions
          variant="seg"
          label="Strategy"
          value={selectValue}
          disabled={strategyReadOnly || ambiguousTopology}
          options={strategyOptions}
          segWrap
          segTight
          onChange={applyStrategy}
        />
      </PcfgField>
      {!strategyReadOnly && ambiguousTopology ? (
        <p className="note amber">
          <b>!</b>
          Invalid wiring: remove either the connector→database link or the cache→database link,
          then pick a strategy again.
        </p>
      ) : null}
      {showWriteBehindInterval ? (
        <PcfgField
          label="Flush interval"
          htmlFor="cache-write-behind-interval"
          sub="How often the proxy flushes writes to the database."
        >
          <PcfgNum
            id="cache-write-behind-interval"
            value={writeBehindDraft}
            unit="s"
            min={WRITE_BEHIND_INTERVAL_MIN}
            max={WRITE_BEHIND_INTERVAL_MAX}
            disabled={readOnly}
            onChange={(nextDraft) => {
              if (readOnly) return
              setWriteBehindDraft(nextDraft)
              const commit = commitWriteBehindIntervalDraft(
                nextDraft,
                storedWriteBehindInterval,
              )
              if (!commit.ok || !commit.changed) return
              updateConfig({ writeBehindIntervalSeconds: commit.next })
              const template =
                templateId ?? useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
              trackEvent('design_option_changed', {
                template,
                optionName: 'write_behind_interval',
                previousCategory: String(storedWriteBehindInterval),
                newCategory: String(commit.next),
              })
            }}
          />
          {!writeBehindDraftValid ? (
            <p className="note amber" style={{ marginTop: 8 }}>
              <b>!</b>
              {WRITE_BEHIND_INTERVAL_VALIDATION}
            </p>
          ) : null}
        </PcfgField>
      ) : null}
      <PcfgField
        label="Default TTL"
        sub="Seconds a value survives before it is evicted."
      >
        <PcfgChk
          id="cache-ttl-no-expiry"
          label="No expiry"
          checked={noExpiry}
          disabled={readOnly}
          onChange={(enableNoExpiry) => {
            if (readOnly) return
            const template =
              templateId ?? useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
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
        {!noExpiry ? (
          <PcfgNum
            id="cache-ttl"
            value={ttlDraft}
            unit="s"
            min={CACHE_TTL_MIN}
            max={CACHE_TTL_MAX}
            disabled={readOnly}
            onChange={(nextDraft) => {
              if (readOnly) return
              setTtlDraft(nextDraft)
              const previous =
                storedCacheTtl != null && storedCacheTtl > 0 ? storedCacheTtl : lastPositiveTtl
              const commit = commitTimedCacheTtlDraft(nextDraft, previous)
              if (!commit.ok || !commit.changed) return
              setLastPositiveTtl(commit.next)
              updateConfig({ cacheTtlSeconds: commit.next })
              const template =
                templateId ?? useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
              trackEvent('design_option_changed', {
                template,
                optionName: 'cache_ttl',
                previousCategory: String(previous),
                newCategory: String(commit.next),
              })
            }}
          />
        ) : null}
        {!noExpiry && !ttlDraftValid ? (
          <p className="note amber" style={{ marginTop: 8 }}>
            <b>!</b>
            {CACHE_TTL_VALIDATION}
          </p>
        ) : null}
      </PcfgField>
      <PcfgField
        label="Eviction policy"
        sub={REDIS_EVICTION_POLICY_DESCRIPTION[evictionPolicy]}
      >
        <PcfgOptions
          variant="dd"
          id="cache-eviction"
          label="Eviction policy"
          value={evictionPolicy}
          disabled={readOnly}
          options={REDIS_EVICTION_POLICIES.map((p) => ({
            value: p,
            label: p,
          }))}
          onChange={(next) => {
            if (readOnly) return
            const prev = normalizeRedisEvictionPolicy(c.evictionPolicy)
            const normalized = normalizeRedisEvictionPolicy(next)
            updateConfig({ evictionPolicy: normalized })
            const template = useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
            trackEvent('design_option_changed', {
              template,
              optionName: 'eviction_policy',
              previousCategory: prev,
              newCategory: normalized,
            })
          }}
        />
        {showVolatileWarning ? (
          <p className="note amber" style={{ marginTop: 8 }}>
            <b>!</b>
            {VOLATILE_NO_EXPIRY_WARNING}
          </p>
        ) : null}
      </PcfgField>
      <ResourceProfileFields
        idPrefix="cache"
        nodeType="cache"
        config={c}
        updateConfig={updateConfig}
        readOnly={readOnly}
        maxInstanceSize={maxInstanceSize}
      />
      {showProxySize ? (
        <ResourceProfileFields
          idPrefix="cache-proxy"
          nodeType="cache"
          config={c}
          label="Proxy profile"
          configKey="proxyInstanceSize"
          updateConfig={updateConfig}
          readOnly={readOnly}
          maxInstanceSize={maxInstanceSize}
        />
      ) : null}
      {simulationMode ? (
        <PcfgField
          label="Capacity override"
          htmlFor="cache-cap"
          sub="Optional RPS ceiling. Empty leaves capacity on automatic."
        >
          <PcfgNum
            id="cache-cap"
            value={
              Number.isFinite(Number(c.nodeCapacityRps)) && Number(c.nodeCapacityRps) > 0
                ? String(Number(c.nodeCapacityRps))
                : ''
            }
            unit="rps"
            min={1}
            placeholder="Auto"
            onChange={(raw) => {
              if (!raw) {
                updateConfig({ nodeCapacityRps: undefined })
                return
              }
              const n = Number(raw)
              if (Number.isFinite(n) && n > 0) updateConfig({ nodeCapacityRps: n })
            }}
          />
        </PcfgField>
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
      const algoValue = simulationMode ? rawAlgo : liveAlgo
      const algoOptions = simulationMode
        ? [
            { value: 'round-robin', label: 'Round-robin' },
            { value: 'weighted', label: 'Weighted' },
            { value: 'least-connections', label: 'Least connections' },
            { value: 'weighted-least-connections', label: 'Weighted least connections' },
            { value: 'ip-hash', label: 'IP hash' },
            { value: 'least-response-time', label: 'Least response time' },
            { value: 'random', label: 'Random' },
            { value: 'least-bandwidth', label: 'Least bandwidth' },
          ]
        : LIVE_LB_ALGORITHMS.map((algo) => ({ value: algo, label: algo }))
      return (
        <>
          <PcfgField
            label="Algorithm"
            sub="How new connections are assigned across the backend pool."
          >
            <PcfgOptions
              variant="dd"
              id="lb-algo"
              label="Algorithm"
              value={algoValue}
              disabled={readOnly}
              options={algoOptions}
              onChange={(v) => {
                if (readOnly) return
                const prev = algoValue
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
            />
          </PcfgField>
          {!simulationMode ? (
            <>
              <PcfgField
                label="Weight by instance size"
                sub="Off: equal share per pod. On: small 1, medium 2, large 4."
              >
                <PcfgOptions
                  variant="seg"
                  label="Weight by instance size"
                  value={c.weightByInstanceSize ? 'on' : 'off'}
                  disabled={readOnly}
                  options={[
                    { value: 'off', label: 'Off' },
                    { value: 'on', label: 'On' },
                  ]}
                  onChange={(v) => {
                    if (readOnly) return
                    updateConfig({ weightByInstanceSize: v === 'on' })
                  }}
                />
              </PcfgField>
              <PcfgField
                label="Per-IP request limit"
                htmlFor="lb-rate-limit-per-ip"
                sub="Cap on requests from any single client IP before the router sheds load. 0 turns the cap off."
              >
                <PcfgNum
                  id="lb-rate-limit-per-ip"
                  value={Number(c.rateLimitPerIp ?? 0)}
                  unit="rps"
                  min={0}
                  max={100}
                  disabled={readOnly}
                  onChange={(raw) => {
                    if (readOnly) return
                    const next = Math.min(100, Math.max(0, Math.floor(Number(raw) || 0)))
                    updateConfig({ rateLimitPerIp: next })
                  }}
                />
              </PcfgField>
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
              <PcfgField
                label="Capacity override"
                htmlFor="lb-cap"
                sub="Optional RPS ceiling. Empty leaves capacity on automatic."
              >
                <PcfgNum
                  id="lb-cap"
                  value={
                    Number.isFinite(Number(c.nodeCapacityRps)) &&
                    Number(c.nodeCapacityRps) > 0
                      ? String(Number(c.nodeCapacityRps))
                      : ''
                  }
                  unit="rps"
                  min={1}
                  placeholder="Auto"
                  onChange={(raw) => {
                    if (!raw) {
                      updateConfig({ nodeCapacityRps: undefined })
                      return
                    }
                    const n = Number(raw)
                    if (Number.isFinite(n) && n > 0) updateConfig({ nodeCapacityRps: n })
                  }}
                />
              </PcfgField>
              <PcfgField
                label="Backend weights"
                htmlFor="lb-weights"
                sub="JSON map of node id to weight."
              >
                <div className="numfld">
                  <textarea
                    id="lb-weights"
                    rows={3}
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
              </PcfgField>
            </>
          ) : null}
        </>
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
          <PcfgField
            label="Replicas"
            sub={
              replicasLocked
                ? REPLICAS_HELP_FREE
                : 'Number of identical app-server instances to run behind the load balancer.'
            }
          >
            <PcfgStepper
              label="Replicas"
              value={replicas}
              min={APP_SERVER_REPLICA_MIN}
              max={maxAppReplicas}
              disabled={replicasDisabled}
              onChange={(n) => {
                if (replicasDisabled) return
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
          </PcfgField>
          {replicas > 1 ? (
            <InstanceSizeCopyFields
              idPrefix="compute"
              nodeType="compute"
              config={c}
              replicaCount={replicas}
              updateConfig={updateConfig}
              readOnly={readOnly}
              maxInstanceSize={maxInstanceSize}
              labelForIndex={(i) => `Replica ${i + 1} size`}
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
            <PcfgField label="Purchase mode" sub={PURCHASE_MODE_HELP}>
              <PcfgOptions
                variant="seg"
                label="Purchase mode"
                value={purchaseMode}
                disabled={readOnly}
                options={[
                  { value: 'unsafe', label: 'unsafe' },
                  { value: 'safe', label: 'row-lock' },
                  { value: 'optimistic', label: 'optimistic' },
                ]}
                segTight
                onChange={(next) => {
                  if (readOnly) return
                  const prev = purchaseMode
                  const normalized = normalizePurchaseMode(next)
                  updateConfig({ purchaseMode: normalized })
                  const template =
                    templateId ?? useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
                  trackEvent('design_option_changed', {
                    template,
                    optionName: 'purchase_mode',
                    previousCategory: prev,
                    newCategory: normalized,
                  })
                }}
              />
              <p className="pcfg-sub" style={{ marginTop: 8 }}>
                {pathInfo.layer} · {pathInfo.sql.join(' ')} {pathInfo.underDrop}
              </p>
            </PcfgField>
          ) : null}
          {showPurchaseMode ? (
            <>
              <PcfgField label="Event name" htmlFor="compute-seed-event-name">
                <div className="numfld">
                  <input
                    id="compute-seed-event-name"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    value={seedName}
                    disabled={readOnly}
                    onChange={(e) => {
                      if (readOnly) return
                      updateConfig({ seedEventName: e.target.value })
                    }}
                  />
                </div>
              </PcfgField>
              <PcfgField label="Ticket capacity" htmlFor="compute-seed-event-capacity">
                <PcfgNum
                  id="compute-seed-event-capacity"
                  value={seedCapacity}
                  min={SEED_EVENT_CAPACITY_MIN}
                  max={SEED_EVENT_CAPACITY_MAX}
                  disabled={readOnly}
                  onChange={(raw) => {
                    if (readOnly) return
                    const n = Number(raw)
                    if (!Number.isFinite(n)) return
                    updateConfig({ seedEventCapacity: Math.floor(n) })
                  }}
                />
              </PcfgField>
            </>
          ) : null}
          {simulationMode ? (
            <PcfgField
              label="Capacity override"
              htmlFor="compute-cap"
              sub="Optional RPS ceiling. Empty leaves capacity on automatic."
            >
              <PcfgNum
                id="compute-cap"
                value={
                  Number.isFinite(Number(c.nodeCapacityRps)) &&
                  Number(c.nodeCapacityRps) > 0
                    ? String(Number(c.nodeCapacityRps))
                    : ''
                }
                unit="rps"
                min={1}
                placeholder="Auto"
                onChange={(raw) => {
                  if (!raw) {
                    updateConfig({ nodeCapacityRps: undefined })
                    return
                  }
                  const n = Number(raw)
                  if (Number.isFinite(n) && n > 0) updateConfig({ nodeCapacityRps: n })
                }}
              />
            </PcfgField>
          ) : null}
        </>
      )
    }

    case 'database': {
      const readReplicas = clampReadReplicas(c.readReplicas)
      const dbInstanceCount = 1 + readReplicas
      const replicationMode = replicationModeFromConfig(c.replicationMode)
      const syncCommitLevel = syncCommitLevelFromConfig(c.syncCommitLevel)
      const showSyncCommitLevel = requiresSynchronousReplication(replicationMode)
      const readConsistency = readConsistencyFromConfig(c.readConsistency)
      const showReadConsistencyClampHint =
        readConsistencyRequiresMultipleReplicas(readConsistency) &&
        readReplicas < 2
      return (
        <>
          <PcfgField
            label="Read replicas"
            sub="Standby copies that serve read traffic and can be promoted on failover."
          >
            <PcfgStepper
              label="Read replicas"
              value={readReplicas}
              min={0}
              max={2}
              disabled={readOnly}
              onChange={(next) => {
                if (readOnly) return
                const clamped = clampReadReplicas(next)
                const sizeCount = 1 + clamped
                const sizes = normalizeInstanceSizes(c, sizeCount)
                updateConfig({
                  readReplicas: clamped,
                  instanceSizes: sizes,
                  instanceSize: sizes[0],
                  replicationMode:
                    clamped === 0 ? 'async' : String(c.replicationMode ?? 'async'),
                })
              }}
            />
          </PcfgField>
          {readReplicas >= 1 ? (
            <InstanceSizeCopyFields
              idPrefix="database"
              nodeType="database"
              config={c}
              replicaCount={dbInstanceCount}
              updateConfig={updateConfig}
              readOnly={readOnly}
              maxInstanceSize={maxInstanceSize}
              labelForIndex={(i) => (i === 0 ? 'Primary size' : `Replica ${i} size`)}
            />
          ) : (
            <ResourceProfileFields
              idPrefix="database"
              nodeType="database"
              config={c}
              label="Resource profile"
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
          {readReplicas >= 1 ? (
            <>
              <PcfgField
                label="Read consistency"
                sub={READ_CONSISTENCY_HELP[readConsistency]}
              >
                <PcfgOptions
                  variant="dd"
                  id="db-read-consistency"
                  label="Read consistency"
                  value={readConsistency}
                  disabled={readOnly}
                  options={READ_CONSISTENCY_POLICIES.map((policy) => ({
                    value: policy,
                    label: READ_CONSISTENCY_LABEL[policy],
                    disabled: !readOnly && readConsistencyOptionDisabled(policy, readReplicas),
                  }))}
                  onChange={(next) => {
                    if (readOnly) return
                    const prev = readConsistency
                    const normalized = readConsistencyFromConfig(next)
                    updateConfig({ readConsistency: normalized })
                    const template =
                      useCanvasStore.getState().snapshotTemplateId ?? 'unknown'
                    trackEvent('design_option_changed', {
                      template,
                      optionName: 'read_consistency',
                      previousCategory: prev,
                      newCategory: normalized,
                    })
                  }}
                />
                {showReadConsistencyClampHint ? (
                  <p className="note amber" style={{ marginTop: 8 }}>
                    <b>!</b>
                    {READ_CONSISTENCY_CLAMP_HINT}
                  </p>
                ) : null}
              </PcfgField>
              <PcfgField
                label="Replication mode"
                sub="Async: replica may lag. Semi-sync: commit waits for one standby. Sync: all standbys."
              >
                <PcfgOptions
                  variant="dd"
                  id="db-replication-mode"
                  label="Replication mode"
                  value={replicationMode}
                  disabled={readOnly}
                  options={REPLICATION_MODES.map((mode) => ({
                    value: mode,
                    label:
                      mode === 'async'
                        ? 'Async'
                        : mode === 'semi-sync'
                          ? 'Semi-sync'
                          : 'Sync',
                  }))}
                  onChange={(next) => {
                    if (readOnly) return
                    const normalized = replicationModeFromConfig(next)
                    const patch: Record<string, unknown> = {
                      replicationMode: normalized,
                    }
                    if (!requiresSynchronousReplication(normalized)) {
                      patch.syncCommitLevel = undefined
                    }
                    updateConfig(patch)
                  }}
                />
              </PcfgField>
              {showSyncCommitLevel ? (
                <PcfgField
                  label="Synchronous commit"
                  sub="Postgres synchronous_commit level."
                >
                  <PcfgOptions
                    variant="dd"
                    id="db-sync-commit-level"
                    label="Synchronous commit"
                    value={syncCommitLevel}
                    disabled={readOnly}
                    options={SYNC_COMMIT_LEVELS.map((level) => ({
                      value: level,
                      label:
                        level === 'remote_write'
                          ? 'Remote write'
                          : level === 'remote_apply'
                            ? 'Remote apply'
                            : 'On (default)',
                    }))}
                    onChange={(next) => {
                      if (readOnly) return
                      updateConfig({
                        syncCommitLevel: syncCommitLevelFromConfig(next),
                      })
                    }}
                  />
                </PcfgField>
              ) : null}
            </>
          ) : null}
          {simulationMode ? (
            <PcfgField
              label="Capacity override"
              htmlFor="db-cap"
              sub="Optional RPS ceiling. Empty leaves capacity on automatic."
            >
              <PcfgNum
                id="db-cap"
                value={
                  Number.isFinite(Number(c.nodeCapacityRps)) &&
                  Number(c.nodeCapacityRps) > 0
                    ? String(Number(c.nodeCapacityRps))
                    : ''
                }
                unit="rps"
                min={1}
                placeholder="Auto"
                onChange={(raw) => {
                  if (!raw) {
                    updateConfig({ nodeCapacityRps: undefined })
                    return
                  }
                  const n = Number(raw)
                  if (Number.isFinite(n) && n > 0) updateConfig({ nodeCapacityRps: n })
                }}
              />
            </PcfgField>
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
              <PcfgField label="Partitions" htmlFor="mq-parts">
                <PcfgNum
                  id="mq-parts"
                  value={Number(c.partitions ?? 1)}
                  min={1}
                  max={32}
                  onChange={(raw) =>
                    updateConfig({
                      partitions: clamp(Number(raw) || 1, 1, 32),
                    })
                  }
                />
              </PcfgField>
              <PcfgField
                label="Capacity override"
                htmlFor="mq-cap"
                sub="Optional RPS ceiling. Empty leaves capacity on automatic."
              >
                <PcfgNum
                  id="mq-cap"
                  value={
                    Number.isFinite(Number(c.nodeCapacityRps)) &&
                    Number(c.nodeCapacityRps) > 0
                      ? String(Number(c.nodeCapacityRps))
                      : ''
                  }
                  unit="rps"
                  min={1}
                  placeholder="Auto"
                  onChange={(raw) => {
                    if (!raw) {
                      updateConfig({ nodeCapacityRps: undefined })
                      return
                    }
                    const n = Number(raw)
                    if (Number.isFinite(n) && n > 0) updateConfig({ nodeCapacityRps: n })
                  }}
                />
              </PcfgField>
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
        <p className="note">
          <b>i</b>External traffic source (load generator). Not inspectable on the canvas.
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
