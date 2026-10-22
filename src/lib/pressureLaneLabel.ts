export const MAX_ACTIVE_USERS = 10000

export function pressureLaneLabel(input: {
  rps: number
  activeUsers: number | null
  conversationVUs: number | null
}): string {
  const users = input.activeUsers
  if (users == null || users < 1) return ''
  const rps = Number.isFinite(input.rps) ? input.rps : 0
  let label = `${users} users at ${rps} RPS`
  const conv = input.conversationVUs
  if (conv != null && conv > 0) {
    label += ` · ${conv} in conversations`
  }
  return label
}

export function activeUsersPressureTooltip(input: {
  activeUsers: number
  rps: number
}): string {
  const n = input.activeUsers
  const x = Number.isFinite(input.rps) ? input.rps : 0
  return `Requests are spread across ${n} user identities. Total rate stays ${x} RPS. Users do not each send at their own pace yet. This also caps conversation identities.`
}
