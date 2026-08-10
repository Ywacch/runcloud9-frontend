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

/** Wide thumb matching dashboard / template cards (~2.5:1), not a stretched square. */
export const PREVIEW_VB_W = 250
export const PREVIEW_VB_H = 100
const PREVIEW_PAD = 16

export function layoutTopologyPreview(
  nodes: TopologyPreviewNode[],
  vbW = PREVIEW_VB_W,
  vbH = PREVIEW_VB_H,
  pad = PREVIEW_PAD,
): Map<string, { x: number; y: number }> {
  const xs = nodes.map((n) => n.position[0])
  const zs = nodes.map((n) => n.position[2])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const spanX = Math.max(maxX - minX, 1e-6)
  const spanZ = Math.max(maxZ - minZ, 1e-6)
  const usableW = vbW - pad * 2
  const usableH = vbH - pad * 2
  const scale = Math.min(usableW / spanX, usableH / spanZ)
  const offsetX = pad + (usableW - spanX * scale) / 2
  const offsetY = pad + (usableH - spanZ * scale) / 2
  return new Map(
    nodes.map((n) => [
      n.id,
      {
        x: offsetX + (n.position[0] - minX) * scale,
        y: offsetY + (n.position[2] - minZ) * scale,
      },
    ]),
  )
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
  if (nodes.length === 0) return null

  const laid = layoutTopologyPreview(nodes)
  const r = 7

  return (
    <svg
      viewBox={`0 0 ${PREVIEW_VB_W} ${PREVIEW_VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden
    >
      {edges.map((e) => {
        const s = laid.get(e.sourceId)
        const t = laid.get(e.targetId)
        if (!s || !t) return null
        return (
          <line
            key={`${e.sourceId}-${e.targetId}`}
            x1={s.x}
            y1={s.y}
            x2={t.x}
            y2={t.y}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="1.2"
          />
        )
      })}
      {nodes.map((n) => {
        const p = laid.get(n.id)
        if (!p) return null
        return (
          <circle
            key={n.id}
            cx={p.x}
            cy={p.y}
            r={r}
            fill={TOPOLOGY_NODE_COLORS[n.type] ?? '#878593'}
          />
        )
      })}
    </svg>
  )
}
