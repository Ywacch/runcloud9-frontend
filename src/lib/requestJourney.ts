import type { TopologyFlags } from './componentRole'
import { filterSteps, resolveExplanation } from './storytellingEngine'
import type {
  StorytellingJourney,
  StorytellingJourneyStep,
  StorytellingSpec,
} from './storytellingTypes'

export type JourneyBackendComponent =
  | 'lb'
  | 'app-server'
  | 'cache'
  | 'db'
  | 'mq'
  | 'worker'

export interface JourneyStep {
  component: JourneyBackendComponent
  /** When omitted, UI derives from `component` (see `journeyStepHeading`). */
  title?: string
  action: string
  detail?: string
  branchLabel?: string
  metricsKey?: string
}

export interface JourneySpec {
  id: string
  method: string
  path: string
  label: string
  trafficPercent?: number
  steps: JourneyStep[]
  explanation: string
}

function asBackendComponent(raw: string): JourneyBackendComponent {
  const c = raw.trim()
  if (
    c === 'lb' ||
    c === 'app-server' ||
    c === 'cache' ||
    c === 'db' ||
    c === 'mq' ||
    c === 'worker'
  ) {
    return c
  }
  return 'app-server'
}

function storytellingStepToJourneyStep(step: StorytellingJourneyStep): JourneyStep {
  return {
    component: asBackendComponent(step.component),
    action: step.action,
    detail: step.detail,
    branchLabel: step.condition ?? step.metricsKey,
    metricsKey: step.metricsKey,
  }
}

export type FilteredJourney = JourneySpec

export function getJourneys(
  _templateId: string | null,
  topology: TopologyFlags,
  storytelling: StorytellingSpec | null | undefined,
): FilteredJourney[] {
  const journeys = storytelling?.journeys ?? []
  return journeys.map((j) => ({
    id: j.id,
    method: j.method,
    path: j.path,
    label: j.label,
    trafficPercent: j.trafficPercent,
    explanation: resolveExplanation(j, topology),
    steps: filterSteps(j.steps, topology).map(storytellingStepToJourneyStep),
  }))
}

export function journeyById(
  templateId: string | null,
  id: string,
  topology: TopologyFlags,
  storytelling: StorytellingSpec | null | undefined,
): JourneySpec | null {
  const j = getJourneys(templateId, topology, storytelling).find((x) => x.id === id)
  return j ?? null
}

function scoreJourneyForKpiRow(
  j: StorytellingJourney,
  row: { id: string; label: string },
): number {
  const labelL = row.label.toLowerCase()
  const idL = row.id.toLowerCase()
  const jl = j.label.toLowerCase()
  const jpath = j.path.toLowerCase()
  const jid = j.id.toLowerCase()

  let score = 0
  if (idL === jid) score += 12
  if (idL.includes(jid) || jid.includes(idL.replace(/^tm-/, ''))) score += 8
  if (labelL.includes(jl) || jl.includes(labelL.split(/[(/]/)[0]?.trim() ?? '')) score += 6
  if (jpath && (labelL.includes(jpath) || idL.includes(jpath.replace(/\//g, '-')))) {
    score += 4
  }

  const writeHints = /post|write|order|checkout|shorten|shortened|create|publish|async|sync/i
  const readHints = /read|feed|pull|catalog|product|resolve|browse|collision/i
  const rowWrite = writeHints.test(row.label) || writeHints.test(row.id)
  const rowRead = readHints.test(row.label) || readHints.test(row.id)
  const jWrite = j.method === 'POST'
  if (rowWrite && jWrite) score += 5
  if (rowRead && !jWrite) score += 5
  if (rowWrite && !jWrite) score -= 2
  if (rowRead && jWrite) score -= 1

  score += (j.trafficPercent ?? 0) * 0.001
  return score
}

export function kpiRowToJourneyId(
  _templateId: string | null | undefined,
  row: { id: string; label: string },
  storytelling?: StorytellingSpec | null,
): string | null {
  const journeys = storytelling?.journeys
  if (!journeys?.length) return null

  let best: { id: string; score: number } | null = null
  for (const j of journeys) {
    const s = scoreJourneyForKpiRow(j, row)
    if (!best || s > best.score) best = { id: j.id, score: s }
  }
  if (best && best.score >= 4) return best.id
  if (journeys.length === 1) return journeys[0].id
  return best?.id ?? null
}

const COMPONENT_TITLE: Record<JourneyBackendComponent, string> = {
  lb: 'Load balancer',
  'app-server': 'App server',
  cache: 'Redis',
  db: 'Postgres',
  mq: 'Message queue',
  worker: 'Worker',
}

export function journeyStepHeading(step: JourneyStep, index: number): string {
  const prefix = String(index + 1)
  const compTitle = step.title ?? COMPONENT_TITLE[step.component]
  const branch = step.branchLabel ? ` (${step.branchLabel})` : ''
  return `${prefix}. ${compTitle}${branch}`
}
