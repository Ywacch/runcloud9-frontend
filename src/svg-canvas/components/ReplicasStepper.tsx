import { APP_SERVER_REPLICA_MAX } from '../../lib/replicaConfig'
import { useSvgCanvasStore } from '../store/svgCanvasStore'

export function ReplicasStepper() {
  const selectedIds = useSvgCanvasStore((s) => s.selectedIds)
  const nodes = useSvgCanvasStore((s) => s.nodes)
  const setNodeReplicas = useSvgCanvasStore((s) => s.setNodeReplicas)

  if (selectedIds.length !== 1) return null
  const node = nodes.find((n) => n.id === selectedIds[0])
  if (!node) return null
  if (node.archetype === 'load-balancer') return null
  const n = node.topology.replicas

  return (
    <div className="ml-2 flex items-center gap-1 rounded-md border border-zinc-300 px-1.5 py-0.5">
      <span className="text-[10px] uppercase tracking-wide text-zinc-400">
        Replicas
      </span>
      <button
        type="button"
        className="rounded px-1.5 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100"
        aria-label="Decrease replicas"
        disabled={n <= 1}
        onClick={() => setNodeReplicas(node.id, n - 1)}
      >
        −
      </button>
      <span className="min-w-[1.25rem] text-center text-xs font-medium text-zinc-800">
        {n}
      </span>
      <button
        type="button"
        className="rounded px-1.5 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100"
        aria-label="Increase replicas"
        disabled={n >= APP_SERVER_REPLICA_MAX}
        onClick={() => setNodeReplicas(node.id, n + 1)}
      >
        +
      </button>
    </div>
  )
}
