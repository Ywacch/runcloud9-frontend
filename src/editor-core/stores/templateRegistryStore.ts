import { create } from 'zustand'
import type { LoadgenConfigView, TemplateInfo } from '../../lib/api'

interface TemplateRegistryState {
  byId: Record<string, TemplateInfo>
  loadgenConfigById: Record<string, LoadgenConfigView>
  mergeTemplates: (rows: TemplateInfo[]) => void
  setLoadgenConfig: (templateId: string, config: LoadgenConfigView) => void
}

export const useTemplateRegistryStore = create<TemplateRegistryState>((set) => ({
  byId: {},
  loadgenConfigById: {},
  mergeTemplates: (rows) =>
    set((s) => {
      const next = { ...s.byId }
      for (const t of rows) next[t.id] = t
      return { byId: next }
    }),
  setLoadgenConfig: (templateId, config) =>
    set((s) => ({
      loadgenConfigById: { ...s.loadgenConfigById, [templateId]: config },
    })),
}))

export function templateInfoForId(id: string | null | undefined): TemplateInfo | undefined {
  if (!id) return undefined
  return useTemplateRegistryStore.getState().byId[id]
}
