import type { DiagramStepState } from '../../lib/types/walkthroughDiagram'
import type { WalkthroughDiagramSpec } from '../../lib/types/walkthroughDiagram'
import type { JourneyBackendComponent } from '../../lib/requestJourney'

const ACCEPT_ANNOTATION = {
  nodeId: 'app-server',
  text: '202 Accepted — response returns here',
  side: 'top' as const,
}

const WORKER_DB_STEP: DiagramStepState = {
  highlightedNodes: ['worker', 'db'],
  activeArrows: ['worker→db'],
  annotation: {
    nodeId: 'worker',
    text: 'followers: @bob, @mike, @user123',
    side: 'top',
  },
}

const FANOUT_FINAL_STEP: DiagramStepState = {
  highlightedNodes: ['worker', 'cache-bob', 'cache-mike', 'cache-user123'],
  activeArrows: ['worker→cache-bob', 'worker→cache-mike', 'worker→cache-user123'],
  annotation: {
    nodeId: 'worker',
    text: 'ZADD timeline:{followerId} — one write per follower',
    side: 'bottom',
  },
}

/** Canonical 7-step write path (lb → app → db → mq+202 → worker → worker→db → fan-out) */
export const SOCIAL_FEED_WRITE_7: DiagramStepState[] = [
  {
    highlightedNodes: ['client', 'lb'],
    activeArrows: ['client→lb'],
  },
  {
    highlightedNodes: ['lb', 'app-server'],
    activeArrows: ['lb→app'],
  },
  {
    highlightedNodes: ['app-server', 'db'],
    activeArrows: ['app→db'],
  },
  {
    highlightedNodes: ['app-server', 'mq'],
    activeArrows: ['app→mq', 'app→client'],
    annotation: ACCEPT_ANNOTATION,
  },
  {
    highlightedNodes: ['mq', 'worker'],
    activeArrows: ['mq→worker'],
  },
  WORKER_DB_STEP,
  FANOUT_FINAL_STEP,
]

/** Social Feed preset / API storytelling — 5 steps */
export const SOCIAL_FEED_WRITE_5: DiagramStepState[] = [
  {
    highlightedNodes: ['client', 'lb'],
    activeArrows: ['client→lb'],
  },
  {
    highlightedNodes: ['lb', 'app-server'],
    activeArrows: ['lb→app'],
  },
  {
    highlightedNodes: ['app-server', 'mq'],
    activeArrows: ['app→mq', 'app→client'],
    annotation: ACCEPT_ANNOTATION,
  },
  {
    highlightedNodes: ['mq', 'worker', 'db'],
    activeArrows: ['mq→worker', 'worker→db'],
    annotation: WORKER_DB_STEP.annotation,
  },
  FANOUT_FINAL_STEP,
]

/** 6-step variant: lb → app → db → mq → worker → fan-out */
export const SOCIAL_FEED_WRITE_6: DiagramStepState[] = [
  ...SOCIAL_FEED_WRITE_7.slice(0, 4),
  SOCIAL_FEED_WRITE_7[4]!,
  FANOUT_FINAL_STEP,
]

/** @deprecated Use resolve — kept for tests */
export const socialFeedWriteSpec: WalkthroughDiagramSpec = {
  journeyId: 'post-create',
  steps: SOCIAL_FEED_WRITE_7,
}

function sequenceKey(components: JourneyBackendComponent[]): string {
  return components.join('|')
}

const WRITE_SEQUENCE_MAP: Record<string, DiagramStepState[]> = {
  [sequenceKey(['lb', 'app-server', 'db', 'mq', 'worker', 'worker', 'cache'])]:
    SOCIAL_FEED_WRITE_7,
  [sequenceKey(['lb', 'app-server', 'db', 'mq', 'worker', 'cache'])]:
    SOCIAL_FEED_WRITE_6,
  [sequenceKey(['lb', 'app-server', 'mq', 'worker', 'cache'])]:
    SOCIAL_FEED_WRITE_5,
}

function writeStateForComponent(
  component: JourneyBackendComponent,
  index: number,
  components: JourneyBackendComponent[],
): DiagramStepState {
  const prev = components[index - 1]
  switch (component) {
    case 'lb':
      return SOCIAL_FEED_WRITE_5[0]!
    case 'app-server':
      return SOCIAL_FEED_WRITE_5[1]!
    case 'db':
      if (prev === 'worker') {
        return WORKER_DB_STEP
      }
      return { highlightedNodes: ['app-server', 'db'], activeArrows: ['app→db'] }
    case 'mq':
      return SOCIAL_FEED_WRITE_5[2]!
    case 'worker':
      if (components[index + 1] === 'cache') {
        return WORKER_DB_STEP
      }
      return { highlightedNodes: ['mq', 'worker'], activeArrows: ['mq→worker'] }
    case 'cache':
      return FANOUT_FINAL_STEP
    default:
      return { highlightedNodes: ['app-server'], activeArrows: [] }
  }
}

export function buildPostCreateDiagramSteps(
  components: JourneyBackendComponent[],
): DiagramStepState[] | null {
  if (components.length === 0) return null

  const mapped = WRITE_SEQUENCE_MAP[sequenceKey(components)]
  if (mapped) return mapped

  return components.map((component, index) =>
    writeStateForComponent(component, index, components),
  )
}
