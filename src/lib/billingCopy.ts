/** Billing UI copy helpers — no Supabase/auth imports (safe for unit tests in CI). */

export const UPGRADE_TO_ENGINEER_LABEL = 'Upgrade to Engineer'

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
