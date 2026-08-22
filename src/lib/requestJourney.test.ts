import { describe, expect, it } from 'vitest'
import type { TopologyFlags } from './componentRole'
import { getJourneys } from './requestJourney'
import type { StorytellingSpec } from './storytellingTypes'
import { workloadProfileForTemplate } from '../editor-core/domain/simulation/workloadProfiles'

const pullTopology: TopologyFlags = {
  hasMQ: false,
  hasWorker: false,
  hasCache: false,
  hasLB: true,
  hasDB: true,
  dbReadReplicas: 0,
  cacheStrategy: 'cache-aside',
}

const socialFeedStorytelling: StorytellingSpec = {
  journeys: [
    {
      id: 'feed-read',
      method: 'GET',
      path: '/feed/{userId}',
      label: 'Feed reads',
      trafficPercent: 60,
      explanation: 'Pull mode reads hit the database directly.',
      steps: [
        { component: 'lb', action: 'Route request', requires: ['lb'] },
        { component: 'app-server', action: 'Resolve feed for user' },
        {
          component: 'cache',
          action: 'Return materialized timeline',
          onlyWhen: { topology: 'hasCache' },
        },
        { component: 'db', action: 'JOIN posts and follows' },
      ],
    },
    {
      id: 'post-create',
      method: 'POST',
      path: '/posts',
      label: 'Create post',
      steps: [
        { component: 'lb', action: 'Route request', requires: ['lb'] },
        { component: 'app-server', action: 'Validate and persist' },
        { component: 'mq', action: 'Publish fan-out job', requires: ['mq'] },
        { component: 'worker', action: 'Fan out to timelines', requires: ['worker'] },
      ],
    },
  ],
}

describe('workloadProfileForTemplate', () => {
  it('returns social-feed profile with archetypes', () => {
    const p = workloadProfileForTemplate('social-feed')
    expect(p?.archetypes.length).toBeGreaterThan(0)
    expect(p?.readLabel).toBeTruthy()
  })
})

describe('getJourneys pull mode (LB + app + db)', () => {
  it('keeps feed-read with lb, app-server, and db steps', () => {
    const journeys = getJourneys('social-feed', pullTopology, socialFeedStorytelling)
    const feedRead = journeys.find((j) => j.id === 'feed-read')
    expect(feedRead).toBeDefined()
    expect(feedRead!.steps.map((s) => s.component)).toEqual([
      'lb',
      'app-server',
      'db',
    ])
  })

  it('drops journeys with no surviving steps after MQ/worker filter', () => {
    const journeys = getJourneys('social-feed', pullTopology, {
      journeys: [
        {
          id: 'async-only',
          method: 'POST',
          path: '/posts',
          label: 'Async post',
          steps: [
            { component: 'mq', action: 'Enqueue', requires: ['mq'] },
            { component: 'worker', action: 'Process', requires: ['worker'] },
          ],
        },
      ],
    })
    expect(journeys).toHaveLength(0)
  })

  it('retains post-create when app and lb steps remain', () => {
    const journeys = getJourneys('social-feed', pullTopology, socialFeedStorytelling)
    const post = journeys.find((j) => j.id === 'post-create')
    expect(post).toBeDefined()
    expect(post!.steps.map((s) => s.component)).toEqual(['lb', 'app-server'])
  })
})
