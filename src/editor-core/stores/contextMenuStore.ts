import { create } from 'zustand'

export type CanvasContextMenuState =
  | {
      kind: 'create'
      clientX: number
      clientY: number
      position: [number, number, number]
    }
  | {
      kind: 'node'
      clientX: number
      clientY: number
      nodeId: string
    }

interface ContextMenuStore {
  menu: CanvasContextMenuState | null
  openCreate: (args: {
    clientX: number
    clientY: number
    position: [number, number, number]
  }) => void
  openNode: (args: {
    clientX: number
    clientY: number
    nodeId: string
  }) => void
  close: () => void
}

export const useCanvasContextMenuStore = create<ContextMenuStore>((set) => ({
  menu: null,
  openCreate: ({ clientX, clientY, position }) =>
    set({ menu: { kind: 'create', clientX, clientY, position } }),
  openNode: ({ clientX, clientY, nodeId }) =>
    set({ menu: { kind: 'node', clientX, clientY, nodeId } }),
  close: () => set({ menu: null }),
}))
