import type { JourneyStep } from '../../lib/requestJourney'
import type { WalkthroughDiagramSpec } from '../../lib/types/walkthroughDiagram'
import { buildFeedReadDiagramSteps } from './socialFeedRead'
import { buildPostCreateDiagramSteps } from './socialFeedWrite'

export function resolveWalkthroughDiagramSpec(
  journeyId: string,
  journeySteps: JourneyStep[],
): WalkthroughDiagramSpec | null {
  const components = journeySteps.map((s) => s.component)

  let steps: ReturnType<typeof buildPostCreateDiagramSteps> = null
  if (journeyId === 'post-create') {
    steps = buildPostCreateDiagramSteps(components)
  } else if (journeyId === 'feed-read') {
    steps = buildFeedReadDiagramSteps(components)
  }

  if (!steps || steps.length !== journeySteps.length) return null

  return { journeyId, steps }
}

export { SOCIAL_FEED_WRITE_5, SOCIAL_FEED_WRITE_7 } from './socialFeedWrite'
export { SOCIAL_FEED_READ_4, SOCIAL_FEED_READ_5 } from './socialFeedRead'
