import type { DiagramStepState } from '../../../lib/types/walkthroughDiagram'
import {
  DiagramAnnotationLabel,
  DiagramArrow,
  DiagramDefs,
  nodeVisual,
  PillNode,
  StackedCachePill,
  arrowVisual,
} from '../diagramShared'

const MARKER_TEAL = 'write-arrowhead-teal'
const MARKER_AMBER = 'write-arrowhead-amber'

const APP_X = 360
const CLIENT_X = 60
const WORKER_X = 650

const NODES = {
  client: { cx: CLIENT_X, cy: 100, label: 'CLIENT' },
  lb: { cx: 190, cy: 100, label: 'LOAD BALANCER' },
  'app-server': { cx: APP_X, cy: 100, label: 'APP SERVER' },
  db: { cx: APP_X, cy: 165, label: 'POSTGRESQL' },
  mq: { cx: 530, cy: 100, label: 'RABBITMQ' },
  worker: { cx: WORKER_X, cy: 100, label: 'WORKER' },
  'cache-stack': { cx: 840, cy: 105, label: 'TIMELINE CACHE ×N' },
  'cache-bob': { cx: 840, cy: 60, label: '@BOB' },
  'cache-mike': { cx: 840, cy: 105, label: '@MIKE' },
  'cache-user123': { cx: 840, cy: 150, label: '@USER123' },
} as const

const ARROW_PATHS = {
  'client→lb': 'M 110 100 L 140 100',
  'lb→app': 'M 240 100 L 310 100',
  'app→db': 'M 360 116 L 360 149',
  'app→mq': 'M 414 100 L 480 100',
  'app→client': `M ${APP_X - 50} 100 C ${APP_X - 50} 20, ${CLIENT_X + 50} 20, ${CLIENT_X + 50} 100`,
  'mq→worker': 'M 580 100 L 600 100',
  'worker→db': 'M 650 120 L 650 165 L 415 165',
  'worker→cache': 'M 700 105 L 790 105',
  'worker→cache-bob': 'M 700 105 L 790 60',
  'worker→cache-mike': 'M 700 105 L 790 105',
  'worker→cache-user123': 'M 700 105 L 790 150',
} as const

type WriteArrowKey = keyof typeof ARROW_PATHS

const BASE_ARROWS: WriteArrowKey[] = [
  'client→lb',
  'lb→app',
  'app→db',
  'app→mq',
  'app→client',
  'mq→worker',
  'worker→db',
]

const FANOUT_ARROWS: WriteArrowKey[] = [
  'worker→cache-bob',
  'worker→cache-mike',
  'worker→cache-user123',
]

export interface SocialFeedWriteDiagramProps {
  state: DiagramStepState
  nodeDurationMs: number
  arrowDurationMs: number
  crossfadeMs: number
  className?: string
}

export function SocialFeedWriteDiagram({
  state,
  nodeDurationMs,
  arrowDurationMs,
  crossfadeMs,
  className,
}: SocialFeedWriteDiagramProps) {
  const isFanoutStep = state.highlightedNodes.includes('cache-bob')
  const stackFade = {
    opacity: isFanoutStep ? 0 : 1,
    transition: `opacity ${crossfadeMs}ms ease`,
    pointerEvents: 'none' as const,
  }
  const fanoutFade = {
    opacity: isFanoutStep ? 1 : 0,
    transition: `opacity ${crossfadeMs}ms ease`,
    pointerEvents: 'none' as const,
  }

  const renderArrow = (id: WriteArrowKey) => (
    <DiagramArrow
      key={id}
      id={id}
      d={ARROW_PATHS[id]}
      active={arrowVisual(id, state)}
      amber={id === 'app→client'}
      arrowDurationMs={arrowDurationMs}
      markerTealId={MARKER_TEAL}
      markerAmberId={MARKER_AMBER}
    />
  )

  return (
    <svg
      viewBox="0 0 960 200"
      className={className}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Social feed write path architecture diagram"
    >
      <DiagramDefs markerTealId={MARKER_TEAL} markerAmberId={MARKER_AMBER} />

      {BASE_ARROWS.filter((id) => id !== 'worker→cache').map(renderArrow)}

      <g style={stackFade}>
        {isFanoutStep ? null : renderArrow('worker→cache')}
      </g>

      <g style={fanoutFade}>{FANOUT_ARROWS.map(renderArrow)}</g>

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
      <PillNode
        cx={NODES.db.cx}
        cy={NODES.db.cy}
        label={NODES.db.label}
        width={108}
        {...nodeVisual('db', state)}
        transitionMs={nodeDurationMs}
      />
      <PillNode
        cx={NODES.mq.cx}
        cy={NODES.mq.cy}
        label={NODES.mq.label}
        {...nodeVisual('mq', state)}
        transitionMs={nodeDurationMs}
      />
      <PillNode
        cx={NODES.worker.cx}
        cy={NODES.worker.cy}
        label={NODES.worker.label}
        {...nodeVisual('worker', state)}
        transitionMs={nodeDurationMs}
      />

      <g style={stackFade}>
        <StackedCachePill
          cx={NODES['cache-stack'].cx}
          cy={NODES['cache-stack'].cy}
          label={NODES['cache-stack'].label}
          width={130}
          {...nodeVisual('cache-stack', state)}
          transitionMs={nodeDurationMs}
        />
      </g>

      <g style={fanoutFade}>
        <PillNode
          cx={NODES['cache-bob'].cx}
          cy={NODES['cache-bob'].cy}
          label={NODES['cache-bob'].label}
          width={72}
          {...nodeVisual('cache-bob', state)}
          transitionMs={nodeDurationMs}
        />
        <PillNode
          cx={NODES['cache-mike'].cx}
          cy={NODES['cache-mike'].cy}
          label={NODES['cache-mike'].label}
          width={72}
          {...nodeVisual('cache-mike', state)}
          transitionMs={nodeDurationMs}
        />
        <PillNode
          cx={NODES['cache-user123'].cx}
          cy={NODES['cache-user123'].cy}
          label={NODES['cache-user123'].label}
          width={88}
          {...nodeVisual('cache-user123', state)}
          transitionMs={nodeDurationMs}
        />
      </g>

      {state.annotation ? (
        <DiagramAnnotationLabel annotation={state.annotation} nodes={NODES} />
      ) : null}
    </svg>
  )
}
