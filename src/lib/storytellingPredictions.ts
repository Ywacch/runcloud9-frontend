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

function humanizeRuleId(id: string): string {
  return id
    .replace(/^journey:/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Pre-deploy predictions from template storytelling + current canvas topology. */
export function collectPredictions(
  storytelling: StorytellingSpec | null | undefined,
  topology: TopologyFlags,
): PredictionCard[] {
  const cards: PredictionCard[] = []

  for (const j of storytelling?.journeys ?? []) {
    const body = resolveExplanation(j, topology)
    if (!body.trim()) continue
    cards.push({
      id: `journey:${j.id}`,
      kind: 'journey',
      title: `${j.method} ${j.path} · ${j.label}`,
      body,
    })
  }

  for (const [ruleId, ctx] of Object.entries(storytelling?.narrativeContext ?? {})) {
    const cause = ctx.cause?.trim()
    if (!cause) continue
    cards.push({
      id: ruleId,
      kind: 'narrative',
      title: humanizeRuleId(ruleId),
      body: cause,
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
