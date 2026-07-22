/** Billing UI copy helpers — no Supabase/auth imports (safe for unit tests in CI). */

export const UPGRADE_TO_ENGINEER_LABEL = 'Upgrade to Engineer'

export const UPGRADE_TO_UNLOCK_TOOLTIP = 'Upgrade to Engineer to unlock this'

export const UPGRADE_TO_SCALE_REPLICAS_TOOLTIP =
  'Upgrade to Engineer to scale replicas up to 2 extra instances'

export const RESOURCE_PROFILE_HELPER =
  'Adjust CPU and memory for this component.'

export const REPLICAS_HELP_FREE = 'Explorer runs one App Server pod.'

export function replicasHelpPaid(maxReplicas: number): string {
  return `Deploy runs this many App Server pods (1–${maxReplicas}). Click an App Server on the grid to add another.`
}

export function isChaosTrialUsedMessage(raw: string): boolean {
  return raw.toLowerCase().includes('chaos trial already used')
}

/** Profile / limits copy when monthly sessions are capped. */
export function formatSessionsLeftThisMonth(
  remaining: number,
  max: number,
): string {
  return `${remaining} of ${max} left`
}

/** Plan label for UI — never expose internal. */
export function displayPlanTierLabel(
  effectiveTier: string | null | undefined,
): string {
  switch (effectiveTier) {
    case 'engineer':
    case 'internal':
      return 'Engineer'
    case 'free':
      return 'Explorer'
    default:
      return 'Explorer'
  }
}
