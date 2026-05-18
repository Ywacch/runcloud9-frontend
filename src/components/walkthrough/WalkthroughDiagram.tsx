import { resolveWalkthroughDiagramSpec } from '../../data/walkthroughDiagrams'
import type { WalkthroughDiagramSpec } from '../../lib/types/walkthroughDiagram'
import { clampDiagramState } from './diagramShared'
import { SocialFeedReadDiagram } from './diagrams/SocialFeedReadDiagram'
import { SocialFeedWriteDiagram } from './diagrams/SocialFeedWriteDiagram'

const NODE_BASE_MS = 400
const ARROW_BASE_MS = 600
const CROSSFADE_BASE_MS = 300

export interface WalkthroughDiagramProps {
  spec: WalkthroughDiagramSpec
  journeyId: string
  currentStepIndex: number
  playbackSpeed: number
  className?: string
}

export function WalkthroughDiagram({
  spec,
  journeyId,
  currentStepIndex,
  playbackSpeed,
  className,
}: WalkthroughDiagramProps) {
  const speed = playbackSpeed > 0 ? playbackSpeed : 1
  const nodeDurationMs = NODE_BASE_MS / speed
  const arrowDurationMs = ARROW_BASE_MS / speed
  const crossfadeMs = CROSSFADE_BASE_MS / speed
  const state = clampDiagramState(spec.steps, currentStepIndex)

  const svgClass = className ?? ''

  if (journeyId === 'post-create') {
    return (
      <div className="h-[200px] w-full shrink-0">
        <SocialFeedWriteDiagram
          state={state}
          nodeDurationMs={nodeDurationMs}
          arrowDurationMs={arrowDurationMs}
          crossfadeMs={crossfadeMs}
          className={svgClass}
        />
      </div>
    )
  }

  if (journeyId === 'feed-read') {
    return (
      <div className="h-[180px] w-full shrink-0">
        <SocialFeedReadDiagram
          state={state}
          nodeDurationMs={nodeDurationMs}
          arrowDurationMs={arrowDurationMs}
          className={svgClass}
        />
      </div>
    )
  }

  return null
}

export { resolveWalkthroughDiagramSpec }
