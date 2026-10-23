import { fmtInt } from './format'

export const MAX_ACTIVE_USERS = 10000

export function pressureLaneLabel(input: {
  rps: number
  identityCount: number | null
  conversationVUs: number | null
}): string {
  const count = input.identityCount
  if (count == null || count < 1) return ''
  const rps = Number.isFinite(input.rps) ? input.rps : 0
  let label = `${count} users at ${rps} RPS`
  const conv = input.conversationVUs
  if (conv != null && conv > 0) {
    label += ` · ${conv} in conversations`
  }
  return label
}

export function usersFieldHint(input: {
  running: boolean
  requested: number | null
  identityCount: number | null
  identitiesSeen: number | null
}): string | null {
  if (!input.running || input.identityCount == null) {
    return null
  }
  const parts: string[] = []
  const cap = input.identityCount
  const requested = input.requested
  if (requested != null && requested > cap) {
    parts.push(`Only ${fmtInt(cap)} users available`)
  }
  const seen = input.identitiesSeen
  if (seen != null && seen >= 0) {
    parts.push(`${fmtInt(seen)} of ${fmtInt(cap)} used so far`)
  }
  if (parts.length === 0) return null
  return parts.join(' · ')
}

export function identityPressureTooltip(input: {
  identityCount: number
  rps: number
}): string {
  const n = input.identityCount
  const x = Number.isFinite(input.rps) ? input.rps : 0
  return `Requests come from up to ${n} user ids. Total rate stays ${x} RPS. Reads follow the most recent poster, and users do not each send at their own pace yet. Conversations use the same ${n} users.`
}
