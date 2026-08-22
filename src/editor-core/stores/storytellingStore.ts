import { create } from 'zustand'
import { getTopologyFlags } from '../../lib/componentRole'
import {
  collectPredictions,
  consistencyInvariantPredictions,
  eventMatchesPrediction,
  loadPersistedPredictedRules,
  persistPredictedRules,
  predictionRuleIds,
} from '../../lib/storytellingPredictions'
import { useCanvasStore } from './canvasStore'
import { useTemplateRegistryStore } from './templateRegistryStore'

interface StorytellingState {
  predictedRuleIds: string[]
  setPredictedRuleIds: (ids: string[]) => void
  /** Recompute from active template + canvas topology; persists per template id. */
  syncPredictionsFromCanvas: () => void
  isPredicted: (event: { title?: string; rule?: string }) => boolean
  /** Restore predictions after refresh (e.g. before highlight reel). */
  restorePersistedPredictions: (templateId: string) => void
}

export const useStorytellingStore = create<StorytellingState>((set, get) => ({
  predictedRuleIds: [],

  setPredictedRuleIds: (ids) => set({ predictedRuleIds: [...ids] }),

  syncPredictionsFromCanvas: () => {
    const templateId = useCanvasStore.getState().snapshotTemplateId
    if (!templateId) {
      set({ predictedRuleIds: [] })
      return
    }
    const storytelling =
      useTemplateRegistryStore.getState().byId[templateId]?.storytelling
    const topology = getTopologyFlags(useCanvasStore.getState().nodes)
    const cards = [
      ...collectPredictions(storytelling, topology),
      ...consistencyInvariantPredictions(topology),
    ]
    const ids = predictionRuleIds(cards)
    persistPredictedRules(templateId, ids)
    set({ predictedRuleIds: ids })
  },

  isPredicted: (event) =>
    eventMatchesPrediction(new Set(get().predictedRuleIds), event),

  restorePersistedPredictions: (templateId) => {
    const ids = loadPersistedPredictedRules(templateId)
    set({ predictedRuleIds: ids })
  },
}))
