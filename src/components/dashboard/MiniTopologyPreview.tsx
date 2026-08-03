/** Hex fills aligned with canvas COMPONENT_COLORS top faces. */
export const TOPOLOGY_NODE_COLORS: Record<string, string> = {
  load_balancer: '#7eb8f8',
  compute: '#b0bcc8',
  database: '#8090a8',
  cache: '#f07878',
  message_queue: '#b07ee8',
  worker: '#c898f0',
  client: '#78b0f0',
}

export type TopologyPreviewNode = {
  id: string
  type: string
  position: [number, number, number]
}

export type TopologyPreviewEdge = {
  sourceId: string
  targetId: string
}

/** Flat SVG topology preview for template cards and dashboards. */
export function MiniTopologyPreview({
  nodes,
  edges,
  className = 'h-full w-full',
}: {
  nodes: TopologyPreviewNode[]
  edges: TopologyPreviewEdge[]
  className?: string
}) {
  if (nodes.length === 0) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        aria-hidden
      >
        <div className="h-8 w-8 rounded-md bg-[var(--c9-bg-subtle)]/60" />
      </div>
    )
  }

  const positions = new Map(
    nodes.map((n) => [n.id, { x: n.position[0], z: n.position[2] }]),
  )

  const xs = nodes.map((n) => n.position[0])
  const zs = nodes.map((n) => n.position[2])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const rangeX = maxX - minX || 1
  const rangeZ = maxZ - minZ || 1
  const padded = (v: number, min: number, range: number) =>
    15 + ((v - min) / range) * 70

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      {edges.map((e) => {
        const s = positions.get(e.sourceId)
        const t = positions.get(e.targetId)
        if (!s || !t) return null
        return (
          <line
            key={`${e.sourceId}-${e.targetId}`}
            x1={padded(s.x, minX, rangeX)}
            y1={padded(s.z, minZ, rangeZ)}
            x2={padded(t.x, minX, rangeX)}
            y2={padded(t.z, minZ, rangeZ)}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="0.8"
          />
        )
      })}
      {nodes.map((n) => (
        <circle
          key={n.id}
          cx={padded(n.position[0], minX, rangeX)}
          cy={padded(n.position[2], minZ, rangeZ)}
          r="5"
          fill={TOPOLOGY_NODE_COLORS[n.type] ?? '#878593'}
        />
      ))}
    </svg>
  )
}
