import type { TopologyFlags } from './componentRole'
import type {
  StorytellingJourney,
  StorytellingJourneyStep,
  WhenSpec,
} from './storytellingTypes'

function topologyFlagValue(t: TopologyFlags, flag: string): boolean {
  switch (flag) {
    case 'hasMQ':
      return t.hasMQ
    case 'hasWorker':
      return t.hasWorker
    case 'hasCache':
      return t.hasCache
    case 'hasLB':
      return t.hasLB
    default:
      return false
  }
}

export function matchesWhen(when: WhenSpec, topology: TopologyFlags): boolean {
  if (when.strategy && topology.cacheStrategy.trim() !== when.strategy.trim()) return false
  if (when.topology) {
    const parts = when.topology.split('+')
    for (const raw of parts) {
      const token = raw.trim()
      if (!token) continue
      const negated = token.startsWith('!')
      const flag = negated ? token.slice(1).trim() : token
      const value = topologyFlagValue(topology, flag)
      if (negated ? value : !value) return false
    }
  }
  return true
}

function hasComponent(topology: TopologyFlags, comp: string): boolean {
  switch (comp) {
    case 'lb':
      return topology.hasLB
    case 'cache':
      return topology.hasCache
    case 'mq':
      return topology.hasMQ
    case 'worker':
      return topology.hasWorker
    default:
      return true
  }
}

export function filterSteps(
  steps: StorytellingJourneyStep[],
  topology: TopologyFlags,
): StorytellingJourneyStep[] {
  return steps.filter((step) => {
    if (step.requires?.some((r) => !hasComponent(topology, r))) return false
    if (step.excludeWhen && matchesWhen(step.excludeWhen, topology)) return false
    if (step.onlyWhen && !matchesWhen(step.onlyWhen, topology)) return false
    return true
  })
}

export function resolveExplanation(
  journey: StorytellingJourney,
  topology: TopologyFlags,
): string {
  if (journey.explanationVariants) {
    for (const v of journey.explanationVariants) {
      if (matchesWhen(v.when, topology)) return v.text
    }
  }
  return journey.explanation
}
