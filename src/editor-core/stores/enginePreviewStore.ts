import { create } from 'zustand'
import type { EngineChangePreview } from '../../lib/engines/engineChangePreview'

interface EnginePreviewStore {
  preview: EngineChangePreview | null
  setPreview: (preview: EngineChangePreview | null) => void
}

export const useEnginePreviewStore = create<EnginePreviewStore>((set) => ({
  preview: null,
  setPreview: (preview) => set({ preview }),
}))
