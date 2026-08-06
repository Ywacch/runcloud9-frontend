import { create } from 'zustand'
import {
  ALERT_AUTO_DISMISS_MS,
  ALERT_COOLDOWN_MS,
  ALERT_MAX_VISIBLE,
  evaluateInspectorAlerts,
  mergeAlertCandidates,
  type InspectorAlertCandidate,
} from '../../lib/inspectorAlerts'
import type { CanvasNode } from './canvasStore'
import type { MetricsBucket } from './metricsStore'

export type ActiveInspectorAlert = InspectorAlertCandidate & {
  shownAt: number
}

interface InspectorAlertState {
  active: ActiveInspectorAlert[]
  cooldownUntil: Record<string, number>
  syncFromMetrics: (
    nodes: Record<string, CanvasNode>,
    metrics: Record<string, MetricsBucket>,
    now?: number,
  ) => void
  dismiss: (id: string, now?: number) => void
  clear: () => void
}

export const useInspectorAlertStore = create<InspectorAlertState>((set, get) => ({
  active: [],
  cooldownUntil: {},

  syncFromMetrics: (nodes, metrics, now = Date.now()) => {
    const candidates = evaluateInspectorAlerts(nodes, metrics)
    const { active, cooldownUntil } = get()
    const next = mergeAlertCandidates({
      candidates,
      activeIds: active.map((a) => a.id),
      cooldownUntil,
      now,
      maxVisible: ALERT_MAX_VISIBLE,
    })

    const byId = new Map(active.map((a) => [a.id, a]))
    const merged: ActiveInspectorAlert[] = next.map((c) => {
      const prev = byId.get(c.id)
      if (prev) {
        return { ...prev, ...c }
      }
      return { ...c, shownAt: now }
    })

    const changed =
      merged.length !== active.length ||
      merged.some((a, i) => a.id !== active[i]?.id || a.body !== active[i]?.body)
    if (!changed) return
    set({ active: merged })
  },

  dismiss: (id, now = Date.now()) => {
    set((s) => ({
      active: s.active.filter((a) => a.id !== id),
      cooldownUntil: {
        ...s.cooldownUntil,
        [id]: now + ALERT_COOLDOWN_MS,
      },
    }))
  },

  clear: () => set({ active: [], cooldownUntil: {} }),
}))

export { ALERT_AUTO_DISMISS_MS }
