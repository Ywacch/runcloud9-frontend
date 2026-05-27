import { create } from 'zustand'
import type { TemplateInfo } from '../../lib/api'

interface TemplateRegistryState {
  byId: Record<string, TemplateInfo>
  mergeTemplates: (rows: TemplateInfo[]) => void
}

export const useTemplateRegistryStore = create<TemplateRegistryState>((set) => ({
  byId: {},
  mergeTemplates: (rows) =>
    set((s) => {
      const next = { ...s.byId }
      for (const t of rows) next[t.id] = t
      return { byId: next }
    }),
}))

export function templateInfoForId(id: string | null | undefined): TemplateInfo | undefined {
  if (!id) return undefined
  return useTemplateRegistryStore.getState().byId[id]
}
