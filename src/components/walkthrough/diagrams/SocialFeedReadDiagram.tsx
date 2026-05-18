import type { DiagramStepState } from '../../../lib/types/walkthroughDiagram'
import {
  DiagramArrow,
  DiagramDefs,
  nodeVisual,
  PillNode,
  StackedCachePill,
  arrowVisual,
} from '../diagramShared'

const MARKER = 'read-arrowhead'

const NODES = {
  client: { cx: 60, cy: 85, label: 'CLIENT' },
  lb: { cx: 190, cy: 85, label: 'LOAD BALANCER' },
  'app-server': { cx: 360, cy: 85, label: 'APP SERVER' },
  'cache-stack': { cx: 530, cy: 85, label: 'TIMELINE CACHE' },
  db: { cx: 530, cy: 145, label: 'POSTGRESQL' },
} as const

const ARROWS = {
  'client→lb': 'M 110 85 L 140 85',
  'lb→app': 'M 240 85 L 310 85',
  'app→cache': 'M 410 85 L 480 85',
  'cache→app': 'M 480 42 Q 360 28 310 42',
  'app→client': 'M 310 128 Q 210 142 110 128',
  'app→db': 'M 390 101 L 510 129',
} as const

export interface SocialFeedReadDiagramProps {
  state: DiagramStepState
  nodeDurationMs: number
  arrowDurationMs: number
  className?: string
}

export function SocialFeedReadDiagram({
  state,
  nodeDurationMs,
  arrowDurationMs,
  className,
}: SocialFeedReadDiagramProps) {
  const coldPathDimmed = true

  return (
    <svg
      viewBox="0 0 680 170"
      className={className}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Social feed read path architecture diagram"
    >
      <DiagramDefs markerTealId={MARKER} />
      {(Object.keys(ARROWS) as (keyof typeof ARROWS)[]).map((id) => (
        <DiagramArrow
          key={id}
          id={id}
          d={ARROWS[id]}
          active={arrowVisual(id, state)}
          dimmed={id === 'app→db' ? coldPathDimmed : false}
          dashed={id === 'app→db'}
          animate={id !== 'app→db'}
          arrowDurationMs={arrowDurationMs}
          markerTealId={MARKER}
        />
      ))}
      <PillNode
        cx={NODES.client.cx}
        cy={NODES.client.cy}
        label={NODES.client.label}
        {...nodeVisual('client', state)}
        transitionMs={nodeDurationMs}
      />
      <PillNode
        cx={NODES.lb.cx}
        cy={NODES.lb.cy}
        label={NODES.lb.label}
        width={118}
        {...nodeVisual('lb', state)}
        transitionMs={nodeDurationMs}
      />
      <PillNode
        cx={NODES['app-server'].cx}
        cy={NODES['app-server'].cy}
        label={NODES['app-server'].label}
        width={108}
        {...nodeVisual('app-server', state)}
        transitionMs={nodeDurationMs}
      />
      <StackedCachePill
        cx={NODES['cache-stack'].cx}
        cy={NODES['cache-stack'].cy}
        label={NODES['cache-stack'].label}
        width={118}
        {...nodeVisual('cache-stack', state)}
        transitionMs={nodeDurationMs}
      />
      <PillNode
        cx={NODES.db.cx}
        cy={NODES.db.cy}
        label={NODES.db.label}
        width={108}
        active={false}
        dimmed
        transitionMs={nodeDurationMs}
      />
    </svg>
  )
}
