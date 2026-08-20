import type { CurrentUserLimits } from './api'

const STORAGE_KEY = 'runcloud9_session_minutes_pref'

export const DEFAULT_SESSION_MINUTES = 9

export function sessionLengthLimits(
  limits: Pick<CurrentUserLimits, 'sessionDefaultMins' | 'sessionCapMins'> | null | undefined,
): { defaultMins: number; capMins: number } {
  const defaultMins = limits?.sessionDefaultMins ?? DEFAULT_SESSION_MINUTES
  const capMins = limits?.sessionCapMins ?? defaultMins
  return { defaultMins, capMins }
}

/** True when the tier allows choosing a length above the default (Engineer / Internal). */
export function canPickSessionLength(
  limits: Pick<CurrentUserLimits, 'sessionDefaultMins' | 'sessionCapMins'> | null | undefined,
): boolean {
  const { defaultMins, capMins } = sessionLengthLimits(limits)
  return capMins > defaultMins
}

export function clampSessionMinutes(
  minutes: number,
  limits: Pick<CurrentUserLimits, 'sessionDefaultMins' | 'sessionCapMins'> | null | undefined,
): number {
  const { defaultMins, capMins } = sessionLengthLimits(limits)
  const n = Math.floor(Number(minutes))
  if (!Number.isFinite(n)) return defaultMins
  if (n < defaultMins) return defaultMins
  if (n > capMins) return capMins
  return n
}

/** Returns minutes for the deploy wire, or undefined when free tier (backend ignores requests). */
export function resolveDeploySessionMinutes(
  requested: number,
  limits: Pick<CurrentUserLimits, 'sessionDefaultMins' | 'sessionCapMins'> | null | undefined,
): number | undefined {
  if (!canPickSessionLength(limits)) return undefined
  return clampSessionMinutes(requested, limits)
}

export function readSessionMinutesPref(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null) return null
    const n = parseInt(raw, 10)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

export function writeSessionMinutesPref(minutes: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(minutes))
  } catch {
    /* ignore quota / private mode */
  }
}

export function parseRunningAtMs(
  metricsSummary: Record<string, unknown> | null | undefined,
): number | null {
  if (!metricsSummary) return null
  const raw = metricsSummary.running_at
  if (typeof raw !== 'string') return null
  const ms = Date.parse(raw)
  return Number.isFinite(ms) ? ms : null
}
