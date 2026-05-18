import { useEffect, useRef } from 'react'
import type { DiagramAnnotation, DiagramStepState } from '../../lib/types/walkthroughDiagram'

export const PILL_W = 100
export const PILL_H = 32
export const PILL_RX = PILL_H / 2

export const INACTIVE_STROKE = 'hsl(220, 12%, 28%)'
export const INACTIVE_LABEL = 'hsl(220, 10%, 45%)'
export const ACTIVE_FILL = 'hsl(220, 16%, 13%)'
export const ACTIVE_STROKE = 'hsl(170, 60%, 50%)'
export const ACTIVE_LABEL = 'hsl(170, 60%, 72%)'
export const ARROW_INACTIVE = 'hsl(220, 12%, 22%)'
export const ARROW_ACTIVE = 'hsl(170, 60%, 50%)'
export const ARROW_AMBER = 'hsl(38, 90%, 55%)'
export const ANNOTATION_COLOR = 'hsl(170, 40%, 65%)'

export const EMPTY_DIAGRAM_STATE: DiagramStepState = {
  highlightedNodes: [],
  activeArrows: [],
}

export function clampDiagramState(
  steps: DiagramStepState[],
  index: number,
): DiagramStepState {
  if (steps.length === 0) return EMPTY_DIAGRAM_STATE
  const i = Math.max(0, Math.min(index, steps.length - 1))
  return steps[i]!
}

export function nodeVisual(
  nodeId: string,
  state: DiagramStepState,
): { active: boolean; dimmed: boolean } {
  const active = state.highlightedNodes.includes(nodeId)
  const explicitDim = state.dimmedNodes?.includes(nodeId) ?? false
  const dimmed =
    explicitDim ||
    (!active &&
      (state.highlightedNodes.length > 0 || state.activeArrows.length > 0))
  return { active, dimmed }
}

export function arrowVisual(
  arrowId: string,
  state: DiagramStepState,
): boolean {
  return state.activeArrows.includes(arrowId)
}

interface PillNodeProps {
  cx: number
  cy: number
  label: string
  active: boolean
  dimmed: boolean
  width?: number
  transitionMs: number
}

export function PillNode({
  cx,
  cy,
  label,
  active,
  dimmed,
  width = PILL_W,
  transitionMs,
}: PillNodeProps) {
  const x = cx - width / 2
  const y = cy - PILL_H / 2
  const style = {
    transition: `fill ${transitionMs}ms ease, stroke ${transitionMs}ms ease, opacity ${transitionMs}ms ease`,
    opacity: dimmed ? 0.25 : 1,
  }

  return (
    <g style={style}>
      {active ? (
        <circle cx={x + 10} cy={cy} r={3} fill={ACTIVE_STROKE} />
      ) : null}
      <rect
        x={x}
        y={y}
        width={width}
        height={PILL_H}
        rx={PILL_RX}
        ry={PILL_RX}
        fill={active ? ACTIVE_FILL : 'transparent'}
        stroke={active ? ACTIVE_STROKE : INACTIVE_STROKE}
        strokeWidth={active ? 1.5 : 1}
      />
      <text
        x={cx + (active ? 6 : 0)}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill={active ? ACTIVE_LABEL : INACTIVE_LABEL}
        fontSize={11}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
        letterSpacing="0.05em"
      >
        {label}
      </text>
    </g>
  )
}

interface StackedCachePillProps {
  cx: number
  cy: number
  label: string
  active: boolean
  dimmed: boolean
  width?: number
  transitionMs: number
}

export function StackedCachePill(props: StackedCachePillProps) {
  const { cx, cy, width = 118 } = props
  const x = cx - width / 2
  const y = cy - PILL_H / 2
  const backStyle = { opacity: props.dimmed ? 0.15 : 0.35 }

  return (
    <g>
      <rect
        x={x + 4}
        y={y + 4}
        width={width}
        height={PILL_H}
        rx={PILL_RX}
        ry={PILL_RX}
        fill="transparent"
        stroke={INACTIVE_STROKE}
        strokeWidth={1}
        style={backStyle}
      />
      <rect
        x={x + 2}
        y={y + 2}
        width={width}
        height={PILL_H}
        rx={PILL_RX}
        ry={PILL_RX}
        fill="transparent"
        stroke={INACTIVE_STROKE}
        strokeWidth={1}
        style={backStyle}
      />
      <PillNode {...props} width={width} />
    </g>
  )
}

interface DiagramArrowProps {
  id: string
  d: string
  active: boolean
  dimmed?: boolean
  amber?: boolean
  dashed?: boolean
  animate?: boolean
  arrowDurationMs: number
  markerTealId: string
  markerAmberId?: string
}

export function DiagramArrow({
  id,
  d,
  active,
  dimmed = false,
  amber = false,
  dashed = false,
  animate = true,
  arrowDurationMs,
  markerTealId,
  markerAmberId,
}: DiagramArrowProps) {
  const animRef = useRef<SVGAnimateMotionElement>(null)
  const stroke = amber && active ? ARROW_AMBER : active ? ARROW_ACTIVE : ARROW_INACTIVE
  const opacity = dimmed ? 0.25 : active ? 1 : 0.4
  const dotFill = amber ? ARROW_AMBER : ARROW_ACTIVE
  const markerEnd =
    amber && markerAmberId
      ? `url(#${markerAmberId})`
      : `url(#${markerTealId})`

  useEffect(() => {
    if (active && animate && animRef.current) {
      animRef.current.beginElement()
    }
  }, [active, animate])

  return (
    <g
      style={{
        transition: `stroke ${arrowDurationMs}ms ease, opacity ${arrowDurationMs}ms ease`,
      }}
    >
      <path
        id={id}
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={1}
        opacity={opacity}
        strokeDasharray={dashed ? '4 3' : undefined}
        markerEnd={markerEnd}
      />
      {animate ? (
        <circle r={3} fill={dotFill}>
          <animateMotion
            ref={animRef}
            dur={`${arrowDurationMs}ms`}
            begin="indefinite"
            fill="remove"
            path={d}
          />
        </circle>
      ) : null}
    </g>
  )
}

export function DiagramDefs({
  markerTealId,
  markerAmberId,
}: {
  markerTealId: string
  markerAmberId?: string
}) {
  return (
    <defs>
      <marker
        id={markerTealId}
        markerWidth="6"
        markerHeight="6"
        refX="5"
        refY="3"
        orient="auto"
      >
        <path d="M0,0 L6,3 L0,6 Z" fill={ARROW_ACTIVE} />
      </marker>
      {markerAmberId ? (
        <marker
          id={markerAmberId}
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill={ARROW_AMBER} />
        </marker>
      ) : null}
    </defs>
  )
}

interface NodePosition {
  cx: number
  cy: number
  label: string
}

export function DiagramAnnotationLabel({
  annotation,
  nodes,
}: {
  annotation: DiagramAnnotation
  nodes: Record<string, NodePosition>
}) {
  const node = nodes[annotation.nodeId]
  if (!node) return null

  let x = node.cx
  let y = node.cy
  let textAnchor: 'start' | 'middle' | 'end' = 'middle'
  let baseline: 'auto' | 'middle' | 'hanging' = 'auto'

  switch (annotation.side) {
    case 'top':
      y = node.cy - PILL_H / 2 - 10
      baseline = 'auto'
      break
    case 'bottom':
      y = node.cy + PILL_H / 2 + 14
      baseline = 'hanging'
      break
    case 'left':
      x = node.cx - PILL_W / 2 - 8
      textAnchor = 'end'
      break
    case 'right':
      x = node.cx + PILL_W / 2 + 8
      textAnchor = 'start'
      break
  }

  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      dominantBaseline={baseline}
      fill={ANNOTATION_COLOR}
      fontSize={10}
      fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    >
      {annotation.text}
    </text>
  )
}
