import { create } from 'zustand'
import { getTopologyFlags } from '../lib/componentRole'
import { getJourneys, type JourneySpec } from '../lib/requestJourney'
import {
  buildJourneyWalkthroughPath,
  type JourneyWalkthroughPath,
} from '../lib/walkthroughPath'
import { useCanvasStore } from './canvasStore'
import { useTemplateRegistryStore } from './templateRegistryStore'

export type WalkthroughSpeed = 0.5 | 1 | 1.5 | 2

interface WalkthroughState {
  activeJourneyId: string | null
  journey: JourneySpec | null
  path: JourneyWalkthroughPath | null
  currentStepIndex: number
  playing: boolean
  speed: WalkthroughSpeed

  startWalkthrough: (journeyId: string) => void
  stop: () => void
  nextStep: () => void
  prevStep: () => void
  goToStep: (index: number) => void
  setPlaying: (playing: boolean) => void
  setSpeed: (speed: WalkthroughSpeed) => void
}

function applyStepToCanvas(
  journey: JourneySpec,
  path: JourneyWalkthroughPath,
  stepIndex: number,
): void {
  const canvas = useCanvasStore.getState()
  for (const eid of canvas.walkthroughHighlightedEdgeIds) {
    canvas.setEdgeAnimated(eid, false)
  }

  const steps = journey.steps
  const clamped = Math.max(0, Math.min(stepIndex, steps.length - 1))
  const activeId = path.stepNodeIds[clamped] ?? null
  const visited: string[] = []
  if (path.clientNodeId && clamped >= 0) {
    visited.push(path.clientNodeId)
  }
  for (let i = 0; i < clamped; i++) {
    const nid = path.stepNodeIds[i]
    if (nid && nid !== activeId) visited.push(nid)
  }

  const edgeId = path.edgeIntoStep[clamped] ?? null
  const edgeIds = edgeId ? [edgeId] : []

  useCanvasStore.getState().setWalkthroughHighlights({
    activeNodeId: activeId,
    visitedNodeIds: visited.filter((id) => id !== activeId),
    highlightedEdgeIds: edgeIds,
    participatingNodeIds: path.participatingNodeIds,
  })

  for (const eid of edgeIds) {
    useCanvasStore.getState().setEdgeAnimated(eid, true)
  }
}

function clearWalkthroughCanvas(): void {
  const st = useCanvasStore.getState()
  const edgeIds = [...st.walkthroughHighlightedEdgeIds]
  st.clearWalkthrough()
  for (const eid of edgeIds) {
    st.setEdgeAnimated(eid, false)
  }
}

export const useWalkthroughStore = create<WalkthroughState>((set, get) => ({
  activeJourneyId: null,
  journey: null,
  path: null,
  currentStepIndex: 0,
  playing: false,
  speed: 1,

  startWalkthrough: (journeyId) => {
    const canvas = useCanvasStore.getState()
    if (canvas.mode !== 'design') return

    const templateId = canvas.snapshotTemplateId
    const storytelling = templateId
      ? useTemplateRegistryStore.getState().byId[templateId]?.storytelling
      : undefined
    const topology = getTopologyFlags(canvas.nodes)
    const journey = getJourneys(templateId, topology, storytelling).find(
      (j) => j.id === journeyId,
    )
    if (!journey || journey.steps.length === 0) return

    clearWalkthroughCanvas()
    canvas.setNarrativeHighlightNodeIds([])
    canvas.setMovementLocked(true)
    canvas.selectNode(null)

    const path = buildJourneyWalkthroughPath(
      journey.steps,
      canvas.nodes,
      canvas.edges,
    )

    set({
      activeJourneyId: journeyId,
      journey,
      path,
      currentStepIndex: 0,
      playing: false,
      speed: 1,
    })
    applyStepToCanvas(journey, path, 0)
  },

  stop: () => {
    clearWalkthroughCanvas()
    useCanvasStore.getState().setMovementLocked(false)
    set({
      activeJourneyId: null,
      journey: null,
      path: null,
      currentStepIndex: 0,
      playing: false,
    })
  },

  nextStep: () => {
    const { journey, path, currentStepIndex, playing } = get()
    if (!journey || !path) return
    const max = journey.steps.length - 1
    if (currentStepIndex >= max) {
      if (playing) set({ playing: false })
      return
    }
    const next = currentStepIndex + 1
    set({ currentStepIndex: next })
    applyStepToCanvas(journey, path, next)
  },

  prevStep: () => {
    const { journey, path, currentStepIndex } = get()
    if (!journey || !path) return
    const prev = Math.max(0, currentStepIndex - 1)
    set({ currentStepIndex: prev, playing: false })
    applyStepToCanvas(journey, path, prev)
  },

  goToStep: (index) => {
    const { journey, path } = get()
    if (!journey || !path) return
    const clamped = Math.max(0, Math.min(index, journey.steps.length - 1))
    set({ currentStepIndex: clamped })
    applyStepToCanvas(journey, path, clamped)
  },

  setPlaying: (playing) => set({ playing }),

  setSpeed: (speed) => set({ speed }),
}))
