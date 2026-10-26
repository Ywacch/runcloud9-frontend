export interface PhenomenonCost {
  readsAffected: number
  threadsAffected?: number
}

export interface PhenomenonBaseRate {
  perThousand: number
  denominator: string
  reads: number
}

export interface PhenomenonRateRange {
  minPerThousand: number
  maxPerThousand: number
}

export interface PhenomenonExample {
  requestId: string
  at: string
  detail?: Record<string, string>
}

export interface PhenomenonEntry {
  phenomenon: string
  runRole?: string
  fidelity: string
  cost: PhenomenonCost
  baseRate: PhenomenonBaseRate
  expected?: PhenomenonRateRange
  examples?: PhenomenonExample[]
  cause?: Record<string, unknown>
  sources: string[]
  detectionMayBeIncomplete?: boolean
}

export const PHENOMENON_REPLY_BEFORE_PARENT = 'reply_before_parent'
