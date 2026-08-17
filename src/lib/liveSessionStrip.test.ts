import { describe, expect, it } from 'vitest'
import type { TopologyFlags } from './componentRole'
import {
  DEV_LIVE_STRIP_PREVIEW,
  formatDeployLabel,
  formatSessionMmSs,
  loadMixForTemplate,
  loadMixSegmentsForSession,
  loadMixSegmentsFromDistribution,
  loadMixSegmentsForTemplate,
  MIX_LABEL_MIN_PCT,
  mixSegmentShowsLabel,
  sessionHealth,
} from './liveSessionStrip'
import type { StorytellingSpec } from './storytellingTypes'

const defaultTopology: TopologyFlags = {
  hasMQ: true,
  hasWorker: true,
  hasCache: true,
  hasLB: true,
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
      steps: [
        { component: 'lb', action: 'Route', requires: ['lb'] },
        { component: 'app-server', action: 'Read feed' },
      ],
    },
    {
      id: 'post-create',
      method: 'POST',
      path: '/post',
      label: 'Create post',
      trafficPercent: 30,
      steps: [
        { component: 'lb', action: 'Route', requires: ['lb'] },
        { component: 'app-server', action: 'Create post' },
        { component: 'mq', action: 'Publish', requires: ['mq'] },
        { component: 'worker', action: 'Fan out', requires: ['worker'] },
      ],
    },
  ],
}

describe('formatSessionMmSs', () => {
  it('formats minutes and seconds', () => {
    expect(formatSessionMmSs(0)).toBe('0:00')
    expect(formatSessionMmSs(7 * 60 + 8)).toBe('7:08')
    expect(formatSessionMmSs(90)).toBe('1:30')
  })
})

describe('formatDeployLabel', () => {
  it('drops cloud9 prefix and trailing hashes', () => {
    expect(formatDeployLabel('cloud9-url-shortener-cd9fbd72-3cace8')).toBe(
      'url-shortener · 3cace8',
    )
  })

  it('keeps a short id unchanged', () => {
    expect(formatDeployLabel('demo')).toBe('demo')
  })
})

describe('DEV_LIVE_STRIP_PREVIEW', () => {
  it('uses a social-feed mix the live strip can render', () => {
    const mix = loadMixSegmentsForSession(
      DEV_LIVE_STRIP_PREVIEW.templateId,
      defaultTopology,
      socialFeedStorytelling,
    )
    expect(mix).not.toBeNull()
    expect(mix!.length).toBe(2)
    expect(mix!.map((s) => s.label)).toEqual(['Feed reads', 'Create post'])
    expect(formatDeployLabel(DEV_LIVE_STRIP_PREVIEW.deploymentId)).toBe(
      'social-feed · 3cace8',
    )
    expect(DEV_LIVE_STRIP_PREVIEW.kpiRows.some((r) => r.kind === 'error')).toBe(
      true,
    )
  })
})

describe('loadMixForTemplate', () => {
  it('returns null without a workload profile', () => {
    expect(loadMixForTemplate(null)).toBeNull()
    expect(loadMixForTemplate('unknown-template')).toBeNull()
  })

  it('returns read/write percents for social-feed', () => {
    const mix = loadMixForTemplate('social-feed')
    expect(mix).not.toBeNull()
    expect(mix!.readPct + mix!.writePct).toBe(100)
    expect(mix!.readLabel.length).toBeGreaterThan(0)
    expect(mix!.writeLabel.length).toBeGreaterThan(0)
  })
})

describe('loadMixSegmentsForTemplate', () => {
  it('returns null without a workload profile', () => {
    expect(loadMixSegmentsForTemplate(null)).toBeNull()
    expect(loadMixSegmentsForTemplate('unknown-template')).toBeNull()
  })

  it('returns workload archetypes for social-feed (simulation granularity)', () => {
    const segs = loadMixSegmentsForTemplate('social-feed')
    expect(segs).not.toBeNull()
    expect(segs!.length).toBe(4)
  })

  it('returns two segments for url-shortener', () => {
    const segs = loadMixSegmentsForTemplate('url-shortener')
    expect(segs).not.toBeNull()
    expect(segs).toHaveLength(2)
    expect(segs![0]!.pct).toBeGreaterThan(segs![1]!.pct)
  })
})

describe('loadMixSegmentsForSession', () => {
  it('matches storytelling journeys for social-feed', () => {
    const segs = loadMixSegmentsForSession(
      'social-feed',
      defaultTopology,
      socialFeedStorytelling,
    )
    expect(segs).toHaveLength(2)
    expect(segs![0]!.id).toBe('feed-read')
    expect(segs![0]!.pct).toBe(60)
    expect(segs![1]!.id).toBe('post-create')
    expect(segs![1]!.pct).toBe(30)
    expect(segs![0]!.share).toBeCloseTo(0.667, 2)
    expect(segs![1]!.share).toBeCloseTo(0.333, 2)
  })

  it('falls back to workload archetypes without storytelling', () => {
    const segs = loadMixSegmentsForSession('social-feed', defaultTopology, null)
    expect(segs).toHaveLength(4)
  })

  it('label visibility follows MIX_LABEL_MIN_PCT', () => {
    const segs = loadMixSegmentsForSession(
      'social-feed',
      defaultTopology,
      socialFeedStorytelling,
    )
    const labeled = segs!.filter((s) => mixSegmentShowsLabel(s.pct))
    const unlabeled = segs!.filter((s) => !mixSegmentShowsLabel(s.pct))
    expect(labeled.every((s) => s.pct >= MIX_LABEL_MIN_PCT)).toBe(true)
    expect(unlabeled.every((s) => s.pct < MIX_LABEL_MIN_PCT)).toBe(true)
  })
})

describe('loadMixSegmentsFromDistribution', () => {
  it('maps distribution keys to journey labels and percents', () => {
    const journeys = socialFeedStorytelling.journeys!.map((j) => ({
      id: j.id,
      method: j.method,
      path: j.path,
      label: j.label,
      steps: [],
      explanation: '',
    }))
    const segs = loadMixSegmentsFromDistribution(
      {
        'GET /feed/{userId}': 60,
        'POST /post': 30,
        'GET /users/{userId}': 10,
      },
      journeys,
    )
    expect(segs).toHaveLength(3)
    expect(segs![0]!.label).toBe('Feed reads')
    expect(segs![0]!.pct).toBe(60)
    expect(segs![1]!.label).toBe('Create post')
    expect(segs![1]!.pct).toBe(30)
    expect(segs![2]!.label).toBe('users/{userId}')
    expect(segs![2]!.pct).toBe(10)
  })

  it('returns null for empty distribution', () => {
    expect(loadMixSegmentsFromDistribution({}, [])).toBeNull()
  })
})

describe('sessionHealth', () => {
  it('is critical when error rate or p99 is catastrophic', () => {
    expect(sessionHealth({ errPct: 100, p99Ms: 50 })).toBe('critical')
    expect(sessionHealth({ errPct: 0, p99Ms: 3000 })).toBe('critical')
    expect(sessionHealth({ errPct: 0, p99Ms: 50, nodeStatus: 'Degraded' })).toBe(
      'critical',
    )
  })

  it('is ok for healthy sessions', () => {
    expect(sessionHealth({ errPct: 0, p99Ms: 50, nodeStatus: 'Running' })).toBe(
      'ok',
    )
  })
})
