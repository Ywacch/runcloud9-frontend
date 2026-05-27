export interface RequestArchetype {
  id: string
  label: string
  method: 'read' | 'write'
  /** Relative weight; normalized to sum to 1 in engine. */
  weight: number
  cacheKeyPattern?: string
  sampleIds: string[]
  sampleData?: { id: string; preview: string }[]
  dbLabel?: string
  mqLabel?: string
}

export interface WorkloadProfile {
  archetypes: RequestArchetype[]
  readLabel?: string
  writeLabel?: string
}

export function normalizeWorkloadWeights(profile: WorkloadProfile): WorkloadProfile {
  const sum = profile.archetypes.reduce((s, a) => s + Math.max(0, a.weight), 0)
  if (sum <= 0) return profile
  return {
    ...profile,
    archetypes: profile.archetypes.map((a) => ({
      ...a,
      weight: Math.max(0, a.weight) / sum,
    })),
  }
}

export function readWriteFractions(profile: WorkloadProfile | undefined): {
  read: number
  write: number
} {
  if (!profile?.archetypes.length) return { read: 0.95, write: 0.05 }
  let read = 0
  let write = 0
  for (const a of profile.archetypes) {
    if (a.method === 'read') read += a.weight
    else write += a.weight
  }
  const t = read + write
  if (t <= 0) return { read: 0.95, write: 0.05 }
  return { read: read / t, write: write / t }
}
