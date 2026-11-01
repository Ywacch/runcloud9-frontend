import type { LoadgenConfigView, LoadgenPhaseSpec } from './api'
import { MAX_ACTIVE_USERS } from './pressureLaneLabel'

const STORAGE_KEY = 'runcloud9_load_session_prefs'

export interface LoadSessionPrefs {
  rps: number
  scheduleId?: string
  actorParams?: Record<string, number>
  distribution?: Record<string, number>
  conversations?: boolean
  activeUsers?: number
}

/** Drops invalid activeUsers while keeping the rest of a stored row. */
export function normalizeStoredActiveUsers(value: unknown): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    return undefined
  }
  if (value < 1) return undefined
  if (value > MAX_ACTIVE_USERS) return MAX_ACTIVE_USERS
  return value
}

function sanitizePrefsRow(row: LoadSessionPrefs): LoadSessionPrefs {
  const activeUsers = normalizeStoredActiveUsers(row.activeUsers)
  const out: LoadSessionPrefs = {
    rps: row.rps,
    scheduleId: row.scheduleId,
    actorParams: row.actorParams,
    distribution: row.distribution,
    conversations: row.conversations,
  }
  if (activeUsers !== undefined) {
    out.activeUsers = activeUsers
  }
  return out
}

type PersistedMap = Record<string, LoadSessionPrefs>

function readMap(): PersistedMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as PersistedMap
  } catch {
    return {}
  }
}

export function readLoadSessionPrefs(deploymentId: string): LoadSessionPrefs | null {
  if (!deploymentId.trim()) return null
  const row = readMap()[deploymentId]
  if (!row || !Number.isFinite(row.rps) || row.rps < 1) return null
  return sanitizePrefsRow(row)
}

export function writeLoadSessionPrefs(
  deploymentId: string,
  prefs: LoadSessionPrefs,
): void {
  if (!deploymentId.trim()) return
  try {
    const map = readMap()
    map[deploymentId] = prefs
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* quota / private mode */
  }
}

export function defaultScheduleId(config: LoadgenConfigView | null | undefined): string {
  const schedules = config?.schedules ?? []
  if (schedules.length === 0) return ''
  const steady = schedules.find((s) => s.id === 'steady')
  if (steady) return steady.id
  return ''
}

/** Maps stored or empty schedule id to a valid template schedule (prefers steady). */
export function normalizeScheduleId(
  scheduleId: string | undefined,
  config: LoadgenConfigView | null | undefined,
): string {
  if (!scheduleId?.trim()) return defaultScheduleId(config)
  const ids = new Set((config?.schedules ?? []).map((s) => s.id))
  if (ids.has(scheduleId)) return scheduleId
  return defaultScheduleId(config)
}

export function defaultActorParams(
  config: LoadgenConfigView | null | undefined,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const param of config?.params ?? []) {
    if (param.key === 'tier') continue
    out[param.key] = param.default
  }
  return out
}

export function formatActorParamLabel(key: string): string {
  const spaced = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()
  if (!spaced) return key
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

export function formatSchedulePhaseSummary(phases: LoadgenPhaseSpec[] | undefined): string {
  if (!phases?.length) return ''
  return phases
    .map((p) => {
      const dur = p.durationSeconds <= 0 ? '∞' : `${p.durationSeconds}s`
      const mult = Number.isInteger(p.rpsMultiplier)
        ? String(p.rpsMultiplier)
        : String(p.rpsMultiplier)
      return `${dur} ×${mult}`
    })
    .join(' · ')
}

/** DEV design preview fixture (social-feed schedules + actor params). */
export const DEV_LOADGEN_CONFIG: LoadgenConfigView = {
  defaultRps: 50,
  endpoints: [
    { method: 'GET', pathTemplate: '/feed/{userId}', weight: 60 },
    { method: 'POST', pathTemplate: '/post', weight: 30 },
    { method: 'GET', pathTemplate: '/users/{userId}', weight: 10 },
  ],
  schedules: [
    {
      id: 'steady',
      label: 'Steady load',
      phases: [{ durationSeconds: 0, rpsMultiplier: 1 }],
    },
    {
      id: 'world_cup_goal',
      label: 'Celebrity post storm',
      phases: [
        { durationSeconds: 60, rpsMultiplier: 1, note: 'baseline' },
        { durationSeconds: 30, rpsMultiplier: 4 },
        { durationSeconds: 45, rpsMultiplier: 2 },
      ],
    },
  ],
  params: [
    { key: 'celebrityPostPct', type: 'percent', default: 5, min: 0, max: 100 },
    { key: 'readAfterPostBoost', type: 'float', default: 1, min: 1, max: 5 },
  ],
  identity: { param: 'userId' },
}
