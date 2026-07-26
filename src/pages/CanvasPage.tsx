import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  isCanvasEditMode,
  useCanvasKeyboard,
  useCanvasStore,
  useMetricsStore,
  useTemplateRegistryStore,
  useWalkthroughStore,
  type CanvasNode,
  CanvasRoot,
} from '../editor-core'
import {
  CanvasErrorBoundary,
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

export default function CanvasPage() {
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
    return journeyById(snapshotTemplateId, designJourneyUi.id, topology, storytelling)
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
    <div className="flex h-screen w-screen overflow-hidden">
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
        <CanvasErrorBoundary resetKey={mode}>
          <CanvasRoot />
        </CanvasErrorBoundary>
        <CanvasSessionOverlays session={session}>
          {mode === 'design' && designJourneys.length > 0 && !walkthroughActive ? (
            <div className="pointer-events-none absolute left-3 top-3 z-30">
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
