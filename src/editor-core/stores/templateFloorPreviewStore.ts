import { create } from 'zustand'
import type { CanvasSnapshot } from './canvasStore'

export type TemplatePreviewKey = `${string}:${string}`

type TemplateFloorPreviewState = {
  previewKey: TemplatePreviewKey | null
  snapshot: CanvasSnapshot | null
  setPreview: (key: TemplatePreviewKey | null, snapshot: CanvasSnapshot | null) => void
  clearPreview: () => void
}

export const useTemplateFloorPreviewStore = create<TemplateFloorPreviewState>(
  (set) => ({
    previewKey: null,
    snapshot: null,
    setPreview: (previewKey, snapshot) => set({ previewKey, snapshot }),
    clearPreview: () => set({ previewKey: null, snapshot: null }),
  }),
)