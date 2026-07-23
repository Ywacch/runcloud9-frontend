import { create } from 'zustand'
import { isoToScreen, snapWorld } from '../math/iso'

export type Archetype = 'app-server'

export type SvgNode = {
  id: string
  archetype: Archetype
  x: number
  y: number
  label: string
}

type SvgCanvasState = {
  nodes: SvgNode[]
  selectedId: string | null
  placingArchetype: Archetype | null
  labelSeq: number
  setPlacingArchetype: (a: Archetype | null) => void
  togglePlacingArchetype: (a: Archetype) => void
  placeNodeAt: (x: number, y: number) => void
  selectNode: (id: string | null) => void
  moveNode: (id: string, x: number, y: number) => void
  removeSelected: () => void
  clearPlacementAndSelection: () => void
}

function nextLabel(seq: number): { label: string; labelSeq: number } {
  return { label: `T${seq}`, labelSeq: seq + 1 }
}

const seedPos = isoToScreen(0.5, -0.5)
const seed = nextLabel(2)

export const useSvgCanvasStore = create<SvgCanvasState>((set, get) => ({
  nodes: [
    {
      id: crypto.randomUUID(),
      archetype: 'app-server',
      x: seedPos.x,
      y: seedPos.y,
      label: seed.label,
    },
  ],
  selectedId: null,
  placingArchetype: null,
  labelSeq: seed.labelSeq,

  setPlacingArchetype: (placingArchetype) => set({ placingArchetype }),

  togglePlacingArchetype: (a) =>
    set((s) => ({
      placingArchetype: s.placingArchetype === a ? null : a,
    })),

  placeNodeAt: (x, y) => {
    const { placingArchetype, labelSeq } = get()
    if (!placingArchetype) return
    const snapped = snapWorld(x, y)
    const { label, labelSeq: next } = nextLabel(labelSeq)
    const node: SvgNode = {
      id: crypto.randomUUID(),
      archetype: placingArchetype,
      x: snapped.x,
      y: snapped.y,
      label,
    }
    set((s) => ({
      nodes: [...s.nodes, node],
      selectedId: node.id,
      labelSeq: next,
      // stay armed for multi-place
    }))
  },

  selectNode: (selectedId) => set({ selectedId }),

  moveNode: (id, x, y) => {
    const snapped = snapWorld(x, y)
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, x: snapped.x, y: snapped.y } : n,
      ),
    }))
  },

  removeSelected: () => {
    const { selectedId } = get()
    if (!selectedId) return
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== selectedId),
      selectedId: null,
    }))
  },

  clearPlacementAndSelection: () =>
    set({ placingArchetype: null, selectedId: null }),
}))
