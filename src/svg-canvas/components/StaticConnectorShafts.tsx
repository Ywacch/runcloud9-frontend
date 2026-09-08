import { connectorStrokeForProtocol } from '../fx/connectorStroke'
import type { SvgEdge } from '../store/svgTypes'

type Props = {
  edges: SvgEdge[]
}

/** Read-only connector shafts for miniviews (no hit targets, arrows, or semantic paint). */
export function StaticConnectorShafts({ edges }: Props) {
  const floorTheme = 'dark' as const
  const preset = 'flow' as const

  return (
    <g data-connector-shafts aria-hidden>
      {edges.map((edge) => {
        const pts = edge.waypoints
        if (pts.length < 2) return null
        const stroke = connectorStrokeForProtocol(
          edge.protocol ?? 'http',
          preset,
          floorTheme,
        )
        if (!stroke) return null
        return pts.slice(0, -1).map((a, i) => {
          const b = pts[i + 1]
          return (
            <line
              key={`${edge.id}-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={stroke.color}
              strokeWidth={stroke.width}
              strokeDasharray={stroke.dash}
              strokeLinecap="round"
            />
          )
        })
      })}
    </g>
  )
}
