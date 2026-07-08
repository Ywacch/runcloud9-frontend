import type { TopologyFlags } from './componentRole'
import { resolveExplanation } from './storytellingEngine'
import type { StorytellingSpec } from './storytellingTypes'

export interface PredictionCard {
  id: string
  kind: 'journey' | 'narrative'
  title: string
  body: string
  suggestion?: string
}

const PLACEHOLDER_RE = /\{[a-zA-Z0-9_.]+\}/

/** Static pre-deploy copy when live templateMetrics placeholders are not available. */
const PRE_DEPLOY_NARRATIVE: Record<string, string> = {
  mq_backpressure:
    'Each post fans out to follower timelines. Under load, message queue depth and worker throughput become the bottleneck.',
  cascade_mq_backpressure:
    'When workers fall behind producers, queue depth grows and timeline freshness suffers. Scale workers or add cache capacity.',
}

/** Narrative rules that only apply when the canvas includes async fan-out. */
const NARRATIVE_REQUIRES: Record<string, (t: TopologyFlags) => boolean> = {
  mq_backpressure: (t) => t.hasMQ && t.hasWorker,
  cascade_mq_backpressure: (t) => t.hasMQ && t.hasWorker,
}

function humanizeRuleId(id: string): string {
  return id
    .replace(/^journey:/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function narrativeAppliesToTopology(
  ruleId: string,
  topology: TopologyFlags,
): boolean {
  const gate = NARRATIVE_REQUIRES[ruleId]
  return gate ? gate(topology) : true
}

/** Resolve narrative cause for pre-deploy cards (no live templateMetrics yet). */
export function preDeployNarrativeBody(ruleId: string, cause: string): string {
  if (PRE_DEPLOY_NARRATIVE[ruleId]) return PRE_DEPLOY_NARRATIVE[ruleId]
  if (PLACEHOLDER_RE.test(cause)) {
    return cause
      .replace(PLACEHOLDER_RE, '…')
      .replace(/\s+/g, ' ')
      .replace(/\.\s*\./g, '.')
      .trim()
  }
  return cause
}

/** Pre-deploy predictions from template storytelling + current canvas topology. */
export function collectPredictions(
  storytelling: StorytellingSpec | null | undefined,
  topology: TopologyFlags,
): PredictionCard[] {
  const cards: PredictionCard[] = []

  for (const j of storytelling?.journeys ?? []) {
    const body = resolveExplanation(j, topology)
    if (!body?.trim()) continue
    cards.push({
      id: `journey:${j.id}`,
      kind: 'journey',
      title: `${j.method} ${j.path} · ${j.label}`,
      body,
    })
  }

  for (const [ruleId, ctx] of Object.entries(storytelling?.narrativeContext ?? {})) {
    if (!narrativeAppliesToTopology(ruleId, topology)) continue
    const cause = ctx.cause?.trim()
    if (!cause) continue
    cards.push({
      id: ruleId,
      kind: 'narrative',
      title: humanizeRuleId(ruleId),
      body: preDeployNarrativeBody(ruleId, cause),
      suggestion: ctx.suggestion?.trim() || undefined,
    })
  }

  return cards
}

export function predictionRuleIds(cards: PredictionCard[]): string[] {
  return cards.map((c) => c.id)
}

/** Match live/post-session events to pre-deploy prediction rule ids. */
export function eventMatchesPrediction(
  predictedIds: ReadonlySet<string>,
  event: { title?: string; rule?: string },
): boolean {
  if (predictedIds.size === 0) return false
  const rule = event.rule?.trim()
  if (rule && predictedIds.has(rule)) return true
  const title = event.title?.trim()
  if (title && predictedIds.has(title)) return true
  return false
}

const PREDICTED_STORAGE_PREFIX = 'runcloud9-predicted-rules-'

export function persistPredictedRules(templateId: string, ruleIds: string[]): void {
  try {
    sessionStorage.setItem(
      `${PREDICTED_STORAGE_PREFIX}${templateId}`,
      JSON.stringify(ruleIds),
    )
  } catch {
    /* ignore */
  }
}

export function loadPersistedPredictedRules(templateId: string): string[] {
  try {
    const raw = sessionStorage.getItem(`${PREDICTED_STORAGE_PREFIX}${templateId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((x) => String(x)).filter(Boolean)
  } catch {
    return []
  }
}

export function clearPersistedPredictedRules(templateId: string): void {
  try {
    sessionStorage.removeItem(`${PREDICTED_STORAGE_PREFIX}${templateId}`)
  } catch {
    /* ignore */
  }
}
