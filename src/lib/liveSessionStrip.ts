import { readWriteFractions } from '../editor-core/domain/simulation/workload'
import { workloadProfileForTemplate } from '../editor-core/domain/simulation/workloadProfiles'

export function formatSessionMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

export type LoadMixSlice = {
  read: number
  write: number
  readPct: number
  writePct: number
  readLabel: string
  writeLabel: string
}

export function loadMixForTemplate(
  templateId: string | null | undefined,
): LoadMixSlice | null {
  const profile = workloadProfileForTemplate(templateId)
  if (!profile?.archetypes.length) return null
  const { read, write } = readWriteFractions(profile)
  return {
    read,
    write,
    readPct: Math.round(read * 100),
    writePct: Math.round(write * 100),
    readLabel: profile.readLabel ?? 'Reads',
    writeLabel: profile.writeLabel ?? 'Writes',
  }
}
