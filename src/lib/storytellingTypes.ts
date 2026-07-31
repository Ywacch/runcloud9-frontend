export interface WhenSpec {
  strategy?: string
  /** e.g. "hasMQ+hasWorker", "!hasMQ" */
  topology?: string
}

export interface StorytellingRoleSpec {
  base?: string
  variants?: { when: WhenSpec; label?: string }[]
}

export interface StorytellingJourneyStep {
  component: string
  action: string
  /** Optional per-step teaching copy for walkthrough "Why this matters". */
  lesson?: string
  detail?: string
  metricsKey?: string
  requires?: string[]
  condition?: string
  onlyWhen?: WhenSpec
  excludeWhen?: WhenSpec
}

export interface StorytellingJourney {
  id: string
  method: string
  path: string
  label: string
  trafficPercent?: number
  steps: StorytellingJourneyStep[]
  explanation?: string
  explanationVariants?: { when: WhenSpec; text?: string }[]
}

export interface NarrativeRuleContext {
  cause?: string
  suggestion?: string
}

export interface StorytellingSpec {
  roles?: Record<string, StorytellingRoleSpec>
  /**
   * Edge teaching copy keyed by semantic pair, e.g. "app-server->cache".
   * Same base/variants shape as roles. Missing keys fall back to platform defaults in FE.
   */
  edges?: Record<string, StorytellingRoleSpec>
  journeys?: StorytellingJourney[]
  narrativeContext?: Record<string, NarrativeRuleContext>
}
