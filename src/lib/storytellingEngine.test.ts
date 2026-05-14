import { describe, expect, it } from 'vitest'
import type { TopologyFlags } from './componentRole'
import { filterSteps, matchesWhen, resolveExplanation } from './storytellingEngine'
import type { StorytellingJourney, StorytellingJourneyStep } from './storytellingTypes'

const baseTopology = (): TopologyFlags => ({
  hasMQ: true,
  hasWorker: true,
  hasCache: true,
  hasLB: true,
  cacheStrategy: 'cache-aside',
})

describe('matchesWhen', () => {
  it('matches strategy when cacheStrategy equals', () => {
    const t = { ...baseTopology(), cacheStrategy: 'write-through' }
    expect(matchesWhen({ strategy: 'write-through' }, t)).toBe(true)
    expect(matchesWhen({ strategy: 'cache-aside' }, t)).toBe(false)
  })

  it('matches topology AND across +', () => {
    const t = baseTopology()
    expect(matchesWhen({ topology: 'hasMQ+hasWorker' }, t)).toBe(true)
    expect(matchesWhen({ topology: 'hasMQ+!hasWorker' }, t)).toBe(false)
  })

  it('supports negated flag token', () => {
    const t = { ...baseTopology(), hasMQ: false }
    expect(matchesWhen({ topology: '!hasMQ' }, t)).toBe(true)
    expect(matchesWhen({ topology: 'hasMQ' }, t)).toBe(false)
  })
})

describe('filterSteps', () => {
  const steps: StorytellingJourneyStep[] = [
    { component: 'lb', action: 'Route', requires: ['lb'] },
    { component: 'mq', action: 'Enqueue', requires: ['mq'] },
    { component: 'worker', action: 'Process', onlyWhen: { topology: 'hasMQ+hasWorker' } },
  ]

  it('drops steps when requires missing component', () => {
    const t: TopologyFlags = {
      ...baseTopology(),
      hasMQ: false,
      hasWorker: true,
    }
    const out = filterSteps(steps, t)
    expect(out.map((s) => s.component)).toEqual(['lb'])
  })

  it('drops step when onlyWhen fails', () => {
    const t: TopologyFlags = { ...baseTopology(), hasWorker: false }
    const out = filterSteps(steps, t)
    expect(out.some((s) => s.component === 'worker')).toBe(false)
  })
})

describe('resolveExplanation', () => {
  it('uses first matching variant', () => {
    const j: StorytellingJourney = {
      id: 'j1',
      method: 'GET',
      path: '/',
      label: 'x',
      steps: [],
      explanation: 'default',
      explanationVariants: [
        { when: { topology: '!hasCache' }, text: 'no cache' },
        { when: { topology: 'hasCache' }, text: 'with cache' },
      ],
    }
    const t = baseTopology()
    expect(resolveExplanation(j, t)).toBe('with cache')
  })
})
