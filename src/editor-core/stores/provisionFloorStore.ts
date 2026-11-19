import { create } from 'zustand'
import type { ParsedProvisionMetrics } from '../../lib/provisionMetrics'

export type ProvisionFloorState = {
  active: boolean
  preview: boolean
  submitting: boolean
  parsed: ParsedProvisionMetrics | null
  elapsedSeconds: number
  isQueued: boolean
  isTerminating: boolean
  queuePosition: number | null
  estimatedWaitSeconds: number | null
  error: string | null
}

const EMPTY: ProvisionFloorState = {
  active: false,
  preview: false,
  submitting: false,
  parsed: null,
  elapsedSeconds: 0,
  isQueued: false,
  isTerminating: false,
  queuePosition: null,
  estimatedWaitSeconds: null,
  error: null,
}

type Store = ProvisionFloorState & {
  patch: (next: Partial<ProvisionFloorState>) => void
  clear: () => void
}

export const useProvisionFloorStore = create<Store>((set) => ({
  ...EMPTY,
  patch: (next) => set(next),
  clear: () => set({ ...EMPTY }),
}))
