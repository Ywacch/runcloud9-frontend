import { CELL_W, HALF_H, HALF_W } from '../math/iso'
import type { PointerEvent as ReactPointerEvent } from 'react'

type DemoCubeProps = {
  x: number
  y: number
  ghost?: boolean
  interactive?: boolean
  onPointerDown?: (e: ReactPointerEvent<SVGGElement>) => void
}

/**
 * Hand-authored isometric compute cube. Anchor = left vertex of the top face.
 * Face geometry uses the research lattice numbers {0,64,128} × {0,37,74}.
 */
export function DemoCube({
  x,
  y,
  ghost = false,
  interactive = false,
  onPointerDown,
}: DemoCubeProps) {
  const opacity = ghost ? 0.35 : 1
  const top = `0 0 ${HALF_W} ${-HALF_H} ${CELL_W} 0 ${HALF_W} ${HALF_H}`
  const left = `0 0 ${HALF_W} ${HALF_H} ${HALF_W} ${HALF_H + 37} 0 37`
  const right = `${CELL_W} 0 ${HALF_W} ${HALF_H} ${HALF_W} ${HALF_H + 37} ${CELL_W} 37`

  return (
    <g
      transform={`translate(${x} ${y})`}
      opacity={opacity}
      style={{
        pointerEvents: interactive ? 'auto' : 'none',
        cursor: interactive ? 'grab' : undefined,
      }}
      onPointerDown={interactive ? onPointerDown : undefined}
      data-demo-cube={ghost ? 'ghost' : 'solid'}
    >
      <polygon points={left} fill="#d2d2d4" stroke="#9ca3af" strokeWidth={1} />
      <polygon points={right} fill="#b8b8bb" stroke="#9ca3af" strokeWidth={1} />
      <polygon points={top} fill="#e8e8ea" stroke="#9ca3af" strokeWidth={1} />
      <circle cx={HALF_W} cy={0} r={10} fill="#3b82f6" />
      <text
        x={HALF_W}
        y={4}
        textAnchor="middle"
        fontSize={10}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill="#fff"
        fontWeight={700}
      >
        T2
      </text>
    </g>
  )
}
