import type { DiagramStepState } from '../../lib/types/walkthroughDiagram'
import type { WalkthroughDiagramSpec } from '../../lib/types/walkthroughDiagram'
import type { JourneyBackendComponent } from '../../lib/requestJourney'

export const SOCIAL_FEED_READ_5: DiagramStepState[] = [
  {
    highlightedNodes: ['client', 'lb'],
    activeArrows: ['client→lb'],
  },
  {
    highlightedNodes: ['lb', 'app-server'],
    activeArrows: ['lb→app'],
  },
  {
    highlightedNodes: ['app-server', 'cache-stack'],
    activeArrows: ['app→cache'],
  },
  {
    highlightedNodes: ['cache-stack', 'app-server'],
    activeArrows: ['cache→app'],
  },
  {
    highlightedNodes: ['app-server', 'client'],
    activeArrows: ['app→client'],
  },
]

/** lb → app → cache → response (no separate cache-hit sub-step) */
export const SOCIAL_FEED_READ_4: DiagramStepState[] = [
  {
    highlightedNodes: ['client', 'lb'],
    activeArrows: ['client→lb'],
  },
  {
    highlightedNodes: ['lb', 'app-server'],
    activeArrows: ['lb→app'],
  },
  {
    highlightedNodes: ['app-server', 'cache-stack'],
    activeArrows: ['app→cache', 'cache→app'],
  },
  {
    highlightedNodes: ['app-server', 'client'],
    activeArrows: ['app→client'],
  },
]

/** lb → app → cache → db (pull / materialized variants) */
export const SOCIAL_FEED_READ_4_WITH_DB: DiagramStepState[] = [
  ...SOCIAL_FEED_READ_4.slice(0, 3),
  {
    highlightedNodes: ['app-server', 'db'],
    activeArrows: ['app→db'],
  },
]

/** @deprecated Use resolve — kept for tests */
export const socialFeedReadSpec: WalkthroughDiagramSpec = {
  journeyId: 'feed-read',
  steps: SOCIAL_FEED_READ_5,
}

function sequenceKey(components: JourneyBackendComponent[]): string {
  return components.join('|')
}

const READ_SEQUENCE_MAP: Record<string, DiagramStepState[]> = {
  [sequenceKey(['lb', 'app-server', 'cache', 'cache', 'app-server'])]:
    SOCIAL_FEED_READ_5,
  [sequenceKey(['lb', 'app-server', 'cache', 'app-server'])]:
    SOCIAL_FEED_READ_5,
  [sequenceKey(['lb', 'app-server', 'cache'])]:
    SOCIAL_FEED_READ_4.slice(0, 3),
  [sequenceKey(['lb', 'app-server', 'cache', 'db'])]:
    SOCIAL_FEED_READ_4_WITH_DB,
  [sequenceKey(['lb', 'app-server', 'db'])]:
    SOCIAL_FEED_READ_4_WITH_DB.slice(0, 3).concat([
      { highlightedNodes: ['app-server', 'db'], activeArrows: ['app→db'] },
    ]),
}

function readStateForComponent(
  component: JourneyBackendComponent,
  index: number,
  components: JourneyBackendComponent[],
): DiagramStepState {
  switch (component) {
    case 'lb':
      return SOCIAL_FEED_READ_5[0]!
    case 'app-server':
      if (index > 0 && components[index - 1] === 'cache') {
        return SOCIAL_FEED_READ_5[3]!
      }
      if (index === components.length - 1) {
        return SOCIAL_FEED_READ_5[4]!
      }
      return SOCIAL_FEED_READ_5[1]!
    case 'cache':
      return SOCIAL_FEED_READ_5[2]!
    case 'db':
      return { highlightedNodes: ['app-server', 'db'], activeArrows: ['app→db'] }
    default:
      return { highlightedNodes: ['app-server'], activeArrows: [] }
  }
}

export function buildFeedReadDiagramSteps(
  components: JourneyBackendComponent[],
): DiagramStepState[] | null {
  if (components.length === 0) return null

  const mapped = READ_SEQUENCE_MAP[sequenceKey(components)]
  if (mapped && mapped.length === components.length) return mapped

  if (components.length === 5) return SOCIAL_FEED_READ_5
  if (components.length === 4 && !components.includes('db')) {
    return SOCIAL_FEED_READ_4
  }

  return components.map((component, index) =>
    readStateForComponent(component, index, components),
  )
}
