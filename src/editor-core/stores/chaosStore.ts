import { create } from 'zustand'
import {
  chaosOverlayTiming,
  type ChaosScenario,
  type ChaosTargetComponent,
} from '../../lib/chaos'

export interface ActiveChaosOverlay {
  scenario: ChaosScenario
  targetComponent: ChaosTargetComponent
  startedAt: number
  clearAfterMs: number
  minDisplayMs: number
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
}

export const useChaosStore = create<ChaosState>((set, get) => ({
  active: null,
  register: (scenario, targetComponent, startedAt = Date.now()) => {
    const { clearAfterMs, minDisplayMs } = chaosOverlayTiming(
      scenario,
      targetComponent,
    )
    set({
      active: {
        scenario,
        targetComponent,
        startedAt,
        clearAfterMs,
        minDisplayMs,
      },
    })
  },
  clear: () => set({ active: null }),
  tick: () => {
    const { active } = get()
    if (!active) return
    const elapsed = Date.now() - active.startedAt
    if (elapsed >= active.clearAfterMs) {
      set({ active: null })
    }
  },
  isTargetActive: (target) => {
    const { active } = get()
    if (!active || active.targetComponent !== target) return false
    const elapsed = Date.now() - active.startedAt
    return elapsed < active.clearAfterMs
  },
}))
