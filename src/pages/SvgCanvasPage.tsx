import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useCanvasKeyboard,
  useCanvasStore,
  useMetricsStore,
  useTemplateRegistryStore,
  useWalkthroughStore,
} from '../editor-core'
import {
  CanvasContextMenu,
  InspectorPanel,
  InspectorChatDrawer,
  LiveMetricsDrawer,
  LiveSessionStrip,
  DevProvisionPreviewToggle,
  LogPanel,
  RequestJourneyPanel,
  SessionSummary,
  Sidebar,
  WalkthroughOverlay,
} from '../editor-ui'
import { CanvasHelpModal } from '../editor-ui/CanvasHelpModal'
import { useDevDebugExtrasVisible } from '../lib/devCanvasTools'
import {
  getDevInspectorMode,
  setDevInspectorMode,
  useDevInspectorMode,
} from '../lib/devInspectorMode'
import { useDevInstanceScopePreview } from '../lib/devInstanceScopePreview'
import {
  runcloud9PickerPhase,
  runcloud9PlacedDesignPhase,
} from '../lib/runcloud9DesignChrome'
import { getTopologyFlags } from '../lib/componentRole'
import { getJourneys, journeyById } from '../lib/requestJourney'
import { dispatchSpawnAtScreen } from '../lib/spawnEvents'
import { trackEvent } from '../lib/analytics'
import SvgDesignCanvas from '../svg-canvas/SvgDesignCanvas'
import { useTemplateFloorPreviewStore } from '../editor-core/stores/templateFloorPreviewStore'
import { useProvisionFloorStore } from '../editor-core/stores/provisionFloorStore'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'

const EMPTY_METRICS: Record<string, MetricsBucket> = {}
import { CanvasSessionOverlays } from './CanvasSessionOverlays'
import { useCanvasSessionLifecycle } from './useCanvasSessionLifecycle'

const VALID_TYPES: CanvasNode['type'][] = [
  'load_balancer',
  'compute',
  'database',
  'cache',
  'message_queue',
  'worker',
]

function isNodeType(raw: string): raw is CanvasNode['type'] {
  return (VALID_TYPES as string[]).includes(raw)
}

/**
 * Production canvas host: SVG design scene + product React chrome
 * (sidebar, inspector, journeys, live/sim overlays).
 * Pixi fallback remains at `/canvas-pixi` (internal / DEV).
 */
export default function SvgCanvasPage() {
  const session = useCanvasSessionLifecycle()
  useCanvasKeyboard()

  const placingNodeType = useCanvasStore((s) => s.placingNodeType)
  const mode = session.mode
  const nodes = session.nodes
  const snapshotTemplateId = session.snapshotTemplateId
  const designMetrics = useMetricsStore((s) =>
    mode === 'design' ? s.metrics : EMPTY_METRICS,
  )
  const storytelling = useTemplateRegistryStore((s) =>
    snapshotTemplateId ? s.byId[snapshotTemplateId]?.storytelling : undefined,
  )
  const walkthroughActive = useWalkthroughStore((s) => s.activeJourneyId)
  const startWalkthrough = useWalkthroughStore((s) => s.startWalkthrough)
  const templatePreviewActive = useTemplateFloorPreviewStore(
    (s) => s.snapshot != null,
  )
  const provisionFloorActive = useProvisionFloorStore((s) => s.active)

  const [designJourneyUi, setDesignJourneyUi] = useState<{
    open: boolean
    overview: boolean
    id: string | null
  }>({ open: false, overview: false, id: null })
  const [helpOpen, setHelpOpen] = useState(false)
  const debugExtrasVisible = useDevDebugExtrasVisible()
  const nodeCount = Object.keys(nodes).length
  const labPlaced = nodeCount > 0 && Boolean(snapshotTemplateId)
  const runcloud9PickerChrome = runcloud9PickerPhase(
    mode,
    session.deploymentId,
    nodeCount,
    snapshotTemplateId,
  )
  const cvPopDesign = runcloud9PlacedDesignPhase(
    mode,
    session.deploymentId,
    nodeCount,
    snapshotTemplateId,
  )
  const devInspectorMode = useDevInspectorMode()
  const devLiveInspector =
    import.meta.env.DEV && devInspectorMode === 'live'
  const devFixtureMetrics = devLiveInspector && !runcloud9PickerChrome
  useDevInstanceScopePreview(mode, nodes, devFixtureMetrics)

  const topology = useMemo(() => getTopologyFlags(nodes), [nodes])
  const designJourneys = useMemo(
    () => getJourneys(snapshotTemplateId, topology, storytelling),
    [snapshotTemplateId, topology, storytelling],
  )
  const designActiveJourney = useMemo(() => {
    if (!designJourneyUi.open || designJourneyUi.overview || !designJourneyUi.id) {
      return null
    }
    return journeyById(
      snapshotTemplateId,
      designJourneyUi.id,
      topology,
      storytelling,
    )
  }, [designJourneyUi, snapshotTemplateId, topology, storytelling])

  const closeDesignJourney = useCallback(() => {
    setDesignJourneyUi((prev) => {
      if (prev.open) {
        trackEvent('journey_panel_closed', {
          template: useCanvasStore.getState().snapshotTemplateId ?? 'unknown',
          context: 'design',
          selected: Boolean(prev.id),
          ...(prev.id ? { journeyId: prev.id } : {}),
        })
      }
      return { open: false, overview: false, id: null }
    })
  }, [])

  useEffect(() => {
    setDesignJourneyUi({ open: false, overview: false, id: null })
  }, [snapshotTemplateId])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    if (!runcloud9PickerChrome) return
    if (getDevInspectorMode() === 'live') {
      setDevInspectorMode('config')
    }
  }, [runcloud9PickerChrome])

  const handleDesignStartWalkthrough = useCallback(
    (journeyId: string) => {
      startWalkthrough(journeyId)
      closeDesignJourney()
    },
    [startWalkthrough, closeDesignJourney],
  )

  return (
    <div className="cv-chrome cv-app-frame cv-dock flex">
      <SessionSummary />
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <LiveSessionStrip />
        <div className="flex min-h-0 min-w-0 flex-1">
        <div
          className={`canvas cv-canvas relative min-h-0 min-w-0 flex-1 overflow-hidden${
            templatePreviewActive ? ' ghosting' : ''
          }${placingNodeType ? ' cursor-crosshair' : ''}`}
          data-state={labPlaced ? 'placed' : 'empty'}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            if (useCanvasStore.getState().mode === 'live') return
            const raw = e.dataTransfer.getData('application/runcloud9-node-type')
            if (!isNodeType(raw)) return
            dispatchSpawnAtScreen({
              clientX: e.clientX,
              clientY: e.clientY,
              nodeType: raw,
            })
          }}
        >
        {debugExtrasVisible ? (
          <div className="pointer-events-none absolute left-3 top-3 z-40 flex items-center gap-1.5">
            <Link
              to="/canvas-pixi"
              className="pointer-events-auto rounded-md border border-[var(--c9-border)] bg-[var(--c9-surface)]/95 px-2 py-1 text-[10px] font-medium text-[var(--c9-muted)] shadow backdrop-blur-sm hover:text-[var(--c9-text)]"
            >
              Pixi fallback
            </Link>
            {import.meta.env.DEV ? <DevProvisionPreviewToggle /> : null}
          </div>
        ) : null}

        {!runcloud9PickerChrome ? (
          <button
            type="button"
            aria-label="Canvas help"
            title="How the canvas works"
            onClick={() => {
              setHelpOpen(true)
              trackEvent('canvas_help_opened', {})
            }}
            className={`absolute right-3 z-40 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--c9-border)] bg-[var(--c9-surface)]/95 text-sm font-semibold text-[var(--c9-muted)] shadow backdrop-blur-sm transition-colors hover:border-[var(--c9-accent)] hover:text-[var(--c9-text)] ${
              debugExtrasVisible
                ? 'top-12'
                : provisionFloorActive
                  ? 'top-12'
                  : 'top-3'
            }`}
          >
            ?
          </button>
        ) : null}

        <SvgDesignCanvas chromeMounted />
        <CanvasContextMenu />
        <CanvasHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

        <CanvasSessionOverlays session={session}>
          {mode === 'design' && !runcloud9PickerChrome && !provisionFloorActive ? (
              <div
              className={`pointer-events-none absolute left-3 z-30 flex flex-col gap-2 ${
                debugExtrasVisible ? 'top-12' : 'top-3'
              }`}
            >
              {designJourneys.length > 0 && !walkthroughActive ? (
                <button
                  type="button"
                  className="pointer-events-auto rounded-lg border border-violet-500/40 bg-[var(--c9-surface)]/95 px-3 py-2 text-xs font-medium text-violet-200 shadow-lg backdrop-blur-sm hover:bg-violet-500/10"
                  onClick={() => {
                    trackEvent('journey_panel_opened', {
                      template: snapshotTemplateId ?? 'unknown',
                      context: 'design',
                    })
                    setDesignJourneyUi({ open: true, overview: true, id: null })
                  }}
                >
                  Request journeys
                </button>
              ) : null}
            </div>
          ) : null}
        </CanvasSessionOverlays>

        <LogPanel />
        <WalkthroughOverlay />
        {mode === 'design' ? (
          <RequestJourneyPanel
            open={designJourneyUi.open}
            overview={designJourneyUi.overview}
            journey={designActiveJourney}
            allJourneys={designJourneys}
            nodes={nodes}
            metrics={designMetrics}
            template={snapshotTemplateId ?? 'unknown'}
            context="design"
            onClose={closeDesignJourney}
            onSelectJourney={(id) => {
              if (id === '__overview__') {
                setDesignJourneyUi({ open: true, overview: true, id: null })
              } else {
                setDesignJourneyUi({ open: true, overview: false, id })
              }
            }}
            onStartWalkthrough={handleDesignStartWalkthrough}
          />
        ) : null}
        </div>
        <InspectorChatDrawer />
        <LiveMetricsDrawer />
        </div>
      </div>
      {!walkthroughActive &&
      !runcloud9PickerChrome &&
      (!cvPopDesign || devLiveInspector) &&
      (mode === 'live' ||
        mode === 'simulate' ||
        Boolean(session.deploymentId) ||
        devLiveInspector) ? (
        <InspectorPanel />
      ) : null}
    </div>
  )
}
