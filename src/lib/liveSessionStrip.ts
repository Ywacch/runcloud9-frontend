import { readWriteFractions } from '../editor-core/domain/simulation/workload'
import { workloadProfileForTemplate } from '../editor-core/domain/simulation/workloadProfiles'
import type { TopologyFlags } from './componentRole'
import { getJourneys } from './requestJourney'
import type { StorytellingSpec } from './storytellingTypes'
import type { TemplateKpiRow } from './templateKpis'

export function formatSessionMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

/** Trailing hash fragments (must include a digit so words like "feed" stay in the slug). */
const HEX_SEGMENT = /^(?=.*\d)[a-f0-9]{4,12}$/i

/** Short live id: `cloud9-url-shortener-cd9fbd72-3cace8` → `url-shortener · 3cace8`. */
export function formatDeployLabel(id: string): string {
  const stripped = id.replace(/^cloud9-/, '')
  const parts = stripped.split('-').filter(Boolean)
  const hashes: string[] = []
  while (parts.length > 0 && HEX_SEGMENT.test(parts[parts.length - 1]!)) {
    hashes.unshift(parts.pop()!)
  }
  const slug = parts.join('-')
  const tail = hashes[hashes.length - 1]
  if (slug && tail) return `${slug} · ${tail}`
  if (slug) return slug
  if (stripped.length <= 28) return stripped
  return `${stripped.slice(0, 20)}…`
}

/** Fixture so Vite design can judge the live strip without a backend session. */
export const DEV_LIVE_STRIP_PREVIEW = {
  deploymentId: 'cloud9-social-feed-cd9fbd72-3cace8',
  templateId: 'social-feed',
  p99Ms: 115,
  errPct: 0,
  throughputRps: 1200,
  remainingSeconds: 8 * 60 + 19,
  targetRps: 50,
  totalRequests: 1398,
  kpiRows: [
    { id: 'posts', label: 'Posts', value: '470', numeric: 470 },
    { id: 'feed-reads', label: 'Feed reads', value: '111', numeric: 111 },
    {
      id: 'fanout-errors',
      label: 'Fan-out errors',
      value: '0',
      numeric: 0,
      kind: 'error',
    },
    { id: 'cache-hit', label: 'Cache hit', value: '91%' },
  ] satisfies TemplateKpiRow[],
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

const MIX_COLORS = ['#3b82f6', '#8b5cf6', '#f97316', '#22d3ee'] as const

/** Inline % labels only render when a segment is at least this share of traffic. */
export const MIX_LABEL_MIN_PCT = 15

export type LoadMixSegment = {
  id: string
  label: string
  /** Label / tooltip percent (from journey trafficPercent when set). */
  pct: number
  color: string
  /** Bar width share when journey percents do not sum to 100. */
  share?: number
}

/** Archetype split from simulation workload (fallback when storytelling has no journeys). */
export function loadMixSegmentsForTemplate(
  templateId: string | null | undefined,
): LoadMixSegment[] | null {
  const profile = workloadProfileForTemplate(templateId)
  if (!profile?.archetypes.length) return null
  const slices = profile.archetypes.slice(0, 4)
  const total = slices.reduce((sum, a) => sum + a.weight, 0) || 1
  return slices.map((a, i) => ({
    id: a.id,
    label: a.label,
    pct: Math.round((a.weight / total) * 100),
    color: MIX_COLORS[i] ?? MIX_COLORS[0],
  }))
}

/**
 * Request-journey mix for the live strip — same journeys as the Request journeys modal.
 * Falls back to workload archetypes when storytelling has no visible journeys.
 */
export function loadMixSegmentsForSession(
  templateId: string | null | undefined,
  topology: TopologyFlags,
  storytelling: StorytellingSpec | null | undefined,
): LoadMixSegment[] | null {
  const journeys = getJourneys(templateId ?? null, topology, storytelling)
  if (journeys.length > 0) {
    const slice = journeys.slice(0, 4)
    const weights = slice.map((j) =>
      j.trafficPercent != null && j.trafficPercent > 0 ? j.trafficPercent : 0,
    )
    const hasExplicit = weights.some((w) => w > 0)
    const totalWeight = hasExplicit
      ? weights.reduce((sum, w) => sum + w, 0) || slice.length
      : slice.length
    return slice.map((j, i) => {
      const share = hasExplicit ? weights[i] || 0 : 1
      const pct =
        j.trafficPercent != null && j.trafficPercent > 0
          ? Math.round(j.trafficPercent)
          : Math.round((share / totalWeight) * 100)
      return {
        id: j.id,
        label: j.label,
        pct,
        color: MIX_COLORS[i] ?? MIX_COLORS[0],
        share: share / totalWeight,
      }
    })
  }
  return loadMixSegmentsForTemplate(templateId)
}

export function mixSegmentShowsLabel(pct: number): boolean {
  return pct >= MIX_LABEL_MIN_PCT
}

export type SessionHealth = 'ok' | 'degraded' | 'critical'

/** Live HUD health from error rate, p99, and node deploy status. */
export function sessionHealth(opts: {
  errPct: number
  p99Ms: number | null | undefined
  nodeStatus?: 'Running' | 'Degraded' | 'Provisioning'
}): SessionHealth {
  const p99 = opts.p99Ms ?? 0
  if (
    opts.errPct >= 15 ||
    p99 >= 2000 ||
    opts.nodeStatus === 'Degraded'
  ) {
    return 'critical'
  }
  if (
    opts.errPct >= 5 ||
    p99 >= 500 ||
    opts.nodeStatus === 'Provisioning'
  ) {
    return 'degraded'
  }
  return 'ok'
}
