import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  isCanvasEditMode,
  useCanvasKeyboard,
  useCanvasStore,
  useMetricsStore,
  useTemplateRegistryStore,
  useWalkthroughStore,
} from '../editor-core'
import {
  CanvasContextMenu,
  DesignToolStrip,
  InspectorPanel,
  LogPanel,
  RequestJourneyPanel,
  SessionSummary,
  Sidebar,
  WalkthroughOverlay,
} from '../editor-ui'
import { getTopologyFlags } from '../lib/componentRole'
import { getJourneys, journeyById } from '../lib/requestJourney'
import { dispatchSpawnAtScreen } from '../lib/spawnEvents'
import SvgDesignCanvas from '../svg-canvas/SvgDesignCanvas'
import type { CanvasNode } from '../editor-core/stores/canvasStore'
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
  const designTool = useCanvasStore((s) => s.designTool)
  const mode = session.mode
  const nodes = session.nodes
  const snapshotTemplateId = session.snapshotTemplateId
  const metrics = useMetricsStore((s) => s.metrics)
  const storytelling = useTemplateRegistryStore((s) =>
    snapshotTemplateId ? s.byId[snapshotTemplateId]?.storytelling : undefined,
  )
  const walkthroughActive = useWalkthroughStore((s) => s.activeJourneyId)
  const startWalkthrough = useWalkthroughStore((s) => s.startWalkthrough)

  const [designJourneyUi, setDesignJourneyUi] = useState<{
    open: boolean
    overview: boolean
    id: string | null
  }>({ open: false, overview: false, id: null })

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
    setDesignJourneyUi({ open: false, overview: false, id: null })
  }, [])

  useEffect(() => {
    setDesignJourneyUi({ open: false, overview: false, id: null })
  }, [snapshotTemplateId])

  const handleDesignStartWalkthrough = useCallback(
    (journeyId: string) => {
      startWalkthrough(journeyId)
      closeDesignJourney()
    },
    [startWalkthrough, closeDesignJourney],
  )

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--c9-bg)] text-[var(--c9-text)]">
      <SessionSummary />
      <Sidebar />
      <div
        className={`relative min-w-0 flex-1 ${
          placingNodeType ||
          (isCanvasEditMode(mode) && designTool === 'connect')
            ? 'cursor-crosshair'
            : ''
        }`}
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
        {import.meta.env.DEV ? (
          <div className="pointer-events-none absolute left-3 top-3 z-40">
            <Link
              to="/canvas-pixi"
              className="pointer-events-auto rounded-md border border-[var(--c9-border)] bg-[var(--c9-surface)]/95 px-2 py-1 text-[10px] font-medium text-[var(--c9-muted)] shadow backdrop-blur-sm hover:text-[var(--c9-text)]"
            >
              Pixi fallback
            </Link>
          </div>
        ) : null}

        <SvgDesignCanvas chromeMounted />
        <CanvasContextMenu />

        <CanvasSessionOverlays session={session}>
          {mode === 'design' && designJourneys.length > 0 && !walkthroughActive ? (
            <div
              className={`pointer-events-none absolute left-3 z-30 ${
                import.meta.env.DEV ? 'top-12' : 'top-3'
              }`}
            >
              <button
                type="button"
                className="pointer-events-auto rounded-lg border border-violet-500/40 bg-[var(--c9-surface)]/95 px-3 py-2 text-xs font-medium text-violet-200 shadow-lg backdrop-blur-sm hover:bg-violet-500/10"
                onClick={() =>
                  setDesignJourneyUi({ open: true, overview: true, id: null })
                }
              >
                Request journeys
              </button>
            </div>
          ) : null}
        </CanvasSessionOverlays>

        <LogPanel />
        <DesignToolStrip />
        <WalkthroughOverlay />
        {!walkthroughActive ? <InspectorPanel /> : null}
        {mode === 'design' ? (
          <RequestJourneyPanel
            open={designJourneyUi.open}
            overview={designJourneyUi.overview}
            journey={designActiveJourney}
            allJourneys={designJourneys}
            nodes={nodes}
            metrics={metrics}
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
    </div>
  )
}
