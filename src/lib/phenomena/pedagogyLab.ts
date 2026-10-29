import {
  PHENOMENON_REPLY_BEFORE_PARENT,
  type PhenomenonEntry,
} from './types'

/** Whether pre-deploy predictions anticipated this phenomenon (slice scenarios). */
export function labPredictionCorrect(
  predictedRuleIds: readonly string[],
  phenomenon: string,
): boolean {
  if (phenomenon === PHENOMENON_REPLY_BEFORE_PARENT) {
    return predictedRuleIds.includes('monotonic_violation')
  }
  return false
}

export function phenomenonHasViolation(entry: PhenomenonEntry): boolean {
  return entry.cost.readsAffected > 0
}
