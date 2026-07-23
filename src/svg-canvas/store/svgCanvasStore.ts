import { create } from 'zustand'
import { HALF_H, HALF_W, isoToScreen, snapWorld } from '../math/iso'
import {
  clearSvgHistory,
  popSvgRedo,
  popSvgUndo,
  pushSvgHistory,
  type SvgHistorySnapshot,
} from './svgHistory'
import {
  cloneSvgNode,
  emptyConfig,
  type Archetype,
  type SvgNode,
} from './svgTypes'

export type { Archetype, SvgNode } from './svgTypes'

/** In-memory clipboard — deep clones including `config` for future inspector fields. */
let clipboard: SvgNode[] = []

type SvgCanvasState = {
  nodes: SvgNode[]
  selectedIds: string[]
  placingArchetype: Archetype | null
  labelSeq: number
  setPlacingArchetype: (a: Archetype | null) => void
  togglePlacingArchetype: (a: Archetype) => void
  placeNodeAt: (x: number, y: number) => void
  selectOnly: (id: string | null) => void
  toggleInSelection: (id: string) => void
  selectAllNodes: () => void
  setSelectedIds: (ids: string[]) => void
  moveNodes: (updates: { id: string; x: number; y: number }[]) => void
  removeSelected: () => void
  copySelected: () => void
  pasteClipboard: () => void
  clearPlacementAndSelection: () => void
  undo: () => void
  redo: () => void
}

function nextLabel(seq: number): { label: string; labelSeq: number } {
  return { label: `T${seq}`, labelSeq: seq + 1 }
}

function snapshotOf(s: { nodes: SvgNode[]; labelSeq: number }): SvgHistorySnapshot {
  return { nodes: s.nodes, labelSeq: s.labelSeq }
}

const seedPos = isoToScreen(0.5, -0.5)
const seed = nextLabel(2)

clearSvgHistory()
clipboard = []

export const useSvgCanvasStore = create<SvgCanvasState>((set, get) => ({
  nodes: [
    {
      id: crypto.randomUUID(),
      archetype: 'app-server',
      x: seedPos.x,
      y: seedPos.y,
      label: seed.label,
      config: emptyConfig(),
    },
  ],
  selectedIds: [],
  placingArchetype: null,
  labelSeq: seed.labelSeq,

  setPlacingArchetype: (placingArchetype) => set({ placingArchetype }),

  togglePlacingArchetype: (a) =>
    set((s) => ({
      placingArchetype: s.placingArchetype === a ? null : a,
    })),

  placeNodeAt: (x, y) => {
    const state = get()
    if (!state.placingArchetype) return
    pushSvgHistory(snapshotOf(state))
    const snapped = snapWorld(x, y)
    const { label, labelSeq: next } = nextLabel(state.labelSeq)
    const node: SvgNode = {
      id: crypto.randomUUID(),
      archetype: state.placingArchetype,
      x: snapped.x,
      y: snapped.y,
      label,
      config: emptyConfig(),
    }
    set({
      nodes: [...state.nodes, node],
      selectedIds: [node.id],
      labelSeq: next,
    })
  },

  selectOnly: (id) => set({ selectedIds: id ? [id] : [] }),

  toggleInSelection: (id) =>
    set((s) => {
      const has = s.selectedIds.includes(id)
      return {
        selectedIds: has
          ? s.selectedIds.filter((sid) => sid !== id)
          : [...s.selectedIds, id],
      }
    }),

  selectAllNodes: () =>
    set((s) => {
      if (s.nodes.length === 0) return s
      return { selectedIds: s.nodes.map((n) => n.id) }
    }),

  setSelectedIds: (selectedIds) => set({ selectedIds }),

  moveNodes: (updates) => {
    if (updates.length === 0) return
    const state = get()
    pushSvgHistory(snapshotOf(state))
    const byId = new Map(
      updates.map((u) => {
        const snapped = snapWorld(u.x, u.y)
        return [u.id, snapped] as const
      }),
    )
    set({
      nodes: state.nodes.map((n) => {
        const next = byId.get(n.id)
        return next ? { ...n, x: next.x, y: next.y } : n
      }),
    })
  },

  removeSelected: () => {
    const state = get()
    if (state.selectedIds.length === 0) return
    const remove = new Set(state.selectedIds)
    pushSvgHistory(snapshotOf(state))
    set({
      nodes: state.nodes.filter((n) => !remove.has(n.id)),
      selectedIds: [],
    })
  },

  copySelected: () => {
    const state = get()
    if (state.selectedIds.length === 0) return
    const selected = new Set(state.selectedIds)
    clipboard = state.nodes.filter((n) => selected.has(n.id)).map(cloneSvgNode)
  },

  pasteClipboard: () => {
    if (clipboard.length === 0) return
    const state = get()
    pushSvgHistory(snapshotOf(state))
    // Offset by one half-cell so pastes don't stack on the source.
    const ox = HALF_W
    const oy = HALF_H
    let seq = state.labelSeq
    const created: SvgNode[] = []
    for (const src of clipboard) {
      const { label, labelSeq: next } = nextLabel(seq)
      seq = next
      const snapped = snapWorld(src.x + ox, src.y + oy)
      created.push({
        ...cloneSvgNode(src),
        id: crypto.randomUUID(),
        x: snapped.x,
        y: snapped.y,
        label,
      })
    }
    // Next paste stacks further if clipboard unchanged — bump clipboard positions
    // so repeated Ctrl+V keeps stepping (Cloudcraft-like).
    clipboard = clipboard.map((n) => ({
      ...cloneSvgNode(n),
      x: n.x + ox,
      y: n.y + oy,
    }))
    set({
      nodes: [...state.nodes, ...created],
      selectedIds: created.map((n) => n.id),
      labelSeq: seq,
    })
  },

  clearPlacementAndSelection: () =>
    set({ placingArchetype: null, selectedIds: [] }),

  undo: () => {
    const state = get()
    const prev = popSvgUndo(snapshotOf(state))
    if (!prev) return
    set({
      nodes: prev.nodes.map(cloneSvgNode),
      labelSeq: prev.labelSeq,
      selectedIds: [],
    })
  },

  redo: () => {
    const state = get()
    const next = popSvgRedo(snapshotOf(state))
    if (!next) return
    set({
      nodes: next.nodes.map(cloneSvgNode),
      labelSeq: next.labelSeq,
      selectedIds: [],
    })
  },
}))
