import { describe, expect, it } from 'vitest'
import type { JourneyStep } from '../../lib/requestJourney'
import { resolveWalkthroughDiagramSpec } from './index'
import { SOCIAL_FEED_WRITE_5, SOCIAL_FEED_WRITE_7 } from './socialFeedWrite'
import { SOCIAL_FEED_READ_5 } from './socialFeedRead'

function steps(
  ...components: JourneyStep['component'][]
): JourneyStep[] {
  return components.map((component) => ({
    component,
    action: '',
  }))
}

describe('walkthrough diagram specs', () => {
  it('resolves 5-step post-create from Social Feed preset shape', () => {
    const spec = resolveWalkthroughDiagramSpec(
      'post-create',
      steps('lb', 'app-server', 'mq', 'worker', 'cache'),
    )
    expect(spec).not.toBeNull()
    expect(spec!.steps).toHaveLength(5)
    expect(spec!.steps[2]?.activeArrows).toContain('app→client')
    expect(spec!.steps[3]?.activeArrows).toContain('worker→db')
  })

  it('resolves 7-step post-create with fan-out final step', () => {
    const spec = resolveWalkthroughDiagramSpec(
      'post-create',
      steps('lb', 'app-server', 'db', 'mq', 'worker', 'worker', 'cache'),
    )
    expect(spec?.steps).toHaveLength(7)
    expect(spec?.steps[6]?.highlightedNodes).toContain('cache-bob')
    expect(spec?.steps[6]?.activeArrows).toContain('worker→cache-mike')
  })

  it('resolves 5-step feed-read', () => {
    const spec = resolveWalkthroughDiagramSpec(
      'feed-read',
      steps('lb', 'app-server', 'cache', 'cache', 'app-server'),
    )
    expect(spec?.steps.length).toBeGreaterThanOrEqual(4)
  })

  it('returns null for unknown journeys', () => {
    expect(
      resolveWalkthroughDiagramSpec('unknown', steps('lb', 'app-server')),
    ).toBeNull()
  })

  it('preset write diagram final step expands follower caches', () => {
    expect(SOCIAL_FEED_WRITE_5[4]?.highlightedNodes).toContain('cache-bob')
    expect(SOCIAL_FEED_WRITE_5[4]?.activeArrows).toContain('worker→cache-bob')
    expect(SOCIAL_FEED_READ_5).toHaveLength(5)
  })
})
