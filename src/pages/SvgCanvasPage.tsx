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
  DesignToolStrip,
  InspectorPanel,
  LogPanel,
  RequestJourneyPanel,
  SessionSummary,
  Sidebar,
  WalkthroughOverlay,
} from '../editor-ui'
import { getJourneys, journeyById } from '../lib/requestJourney'
import { dispatchSpawnAtScreen } from '../lib/spawnEvents'
import SvgDesignCanvas from '../svg-canvas/SvgDesignCanvas'
import type { CanvasNode } from '../editor-core/stores/canvasStore'

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
 * SVG design host with product React chrome mounted (sidebar, inspector, journeys).
 * Pixi `/canvas` stays production; this page dogfoods the store-bridged SVG scene.
 */
export default function SvgCanvasPage() {
  useCanvasKeyboard()

  const placingNodeType = useCanvasStore((s) => s.placingNodeType)
  const designTool = useCanvasStore((s) => s.designTool)
  const mode = useCanvasStore((s) => s.mode)
  const nodes = useCanvasStore((s) => s.nodes)
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)
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

  useEffect(() => {
    const st = useCanvasStore.getState()
    if (!st.deploymentId && st.mode !== 'design') {
      st.setMode('design')
    }
  }, [])

  const designJourneys = useMemo(
    () => getJourneys(storytelling),
    [storytelling],
  )
  const designActiveJourney = useMemo(
    () =>
      designJourneyUi.id
        ? journeyById(designJourneys, designJourneyUi.id)
        : null,
    [designJourneyUi.id, designJourneys],
  )

  const closeDesignJourney = useCallback(() => {
    setDesignJourneyUi({ open: false, overview: false, id: null })
  }, [])

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
        <div className="pointer-events-none absolute left-3 top-3 z-40 flex items-center gap-2">
          <Link
            to="/canvas"
            className="pointer-events-auto rounded-md border border-[var(--c9-border)] bg-[var(--c9-surface)]/95 px-2 py-1 text-[10px] font-medium text-[var(--c9-muted)] shadow backdrop-blur-sm hover:text-[var(--c9-text)]"
          >
            Pixi canvas
          </Link>
          <span className="rounded-md border border-[var(--c9-border)] bg-[var(--c9-surface)]/95 px-2 py-1 text-[10px] text-[var(--c9-muted)] shadow backdrop-blur-sm">
            SVG host
          </span>
        </div>

        <SvgDesignCanvas chromeMounted />

        {mode === 'design' && designJourneys.length > 0 && !walkthroughActive ? (
          <div className="pointer-events-none absolute left-3 top-12 z-30">
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
