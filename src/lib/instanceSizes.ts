export type InstanceSize = 'small' | 'medium' | 'large'

export function normalizeInstanceSize(raw: unknown): InstanceSize {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === 'medium' || s === 'large') return s
  return 'small'
}

export function normalizeInstanceSizes(
  config: Record<string, unknown>,
  replicaCount: number,
): string[] {
  const count = Math.max(1, Math.floor(replicaCount))
  const def = normalizeInstanceSize(config.instanceSize)
  const out = Array.from({ length: count }, () => def)
  const raw = config.instanceSizes
  if (!Array.isArray(raw)) return out
  for (let i = 0; i < count && i < raw.length; i++) {
    out[i] = normalizeInstanceSize(raw[i])
  }
  return out
}

export function sizesUniform(sizes: string[]): boolean {
  if (sizes.length === 0) return true
  const first = normalizeInstanceSize(sizes[0])
  for (let i = 1; i < sizes.length; i++) {
    if (normalizeInstanceSize(sizes[i]) !== first) return false
  }
  return true
}
