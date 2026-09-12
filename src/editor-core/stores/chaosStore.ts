import { create } from 'zustand'
import {
  chaosOverlayTiming,
  isPartitionChaosScenario,
  type ChaosScenario,
  type ChaosTargetComponent,
} from '../../lib/chaos'

export interface ActiveChaosOverlay {
  scenario: ChaosScenario
  targetComponent: ChaosTargetComponent
  startedAt: number
  clearAfterMs: number
  minDisplayMs: number
  /** Partition scenarios stay until Heal or chaos_heal. */
  stateful: boolean
}

interface ChaosState {
  active: ActiveChaosOverlay | null
  register: (
    scenario: ChaosScenario,
    targetComponent: ChaosTargetComponent,
    startedAt?: number,
  ) => void
  clear: () => void
  tick: () => void
  isTargetActive: (target: ChaosTargetComponent) => boolean
  hasActivePartition: () => boolean
}

export const useChaosStore = create<ChaosState>((set, get) => ({
  active: null,
  register: (scenario, targetComponent, startedAt = Date.now()) => {
    const { clearAfterMs, minDisplayMs } = chaosOverlayTiming(
      scenario,
      targetComponent,
    )
    const stateful = isPartitionChaosScenario(scenario)
    set({
      active: {
        scenario,
        targetComponent,
        startedAt,
        clearAfterMs,
        minDisplayMs,
        stateful,
      },
    })
  },
  clear: () => set({ active: null }),
  tick: () => {
    const { active } = get()
    if (!active || active.stateful) return
    const elapsed = Date.now() - active.startedAt
    if (elapsed >= active.clearAfterMs) {
      set({ active: null })
    }
  },
  isTargetActive: (target) => {
    const { active } = get()
    if (!active || active.targetComponent !== target) return false
    if (active.stateful) return true
    const elapsed = Date.now() - active.startedAt
    return elapsed < active.clearAfterMs
  },
  hasActivePartition: () => {
    const { active } = get()
    return Boolean(active?.stateful)
  },
}))
