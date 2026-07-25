import { BACKEND_SUPPORTS_SHARDING } from '../../lib/backendCapabilities'
import { DB_SHARD_MAX } from '../compose/composeGlyph'
import { MQ_SHARD_MAX } from '../skins/engineSkins'
import { useSvgCanvasStore } from '../store/svgCanvasStore'

function shardMaxFor(archetype: string): number {
  if (archetype === 'database') return DB_SHARD_MAX
  if (archetype === 'message-queue') return MQ_SHARD_MAX
  return 1
}

export function ShardsStepper() {
  const selectedIds = useSvgCanvasStore((s) => s.selectedIds)
  const nodes = useSvgCanvasStore((s) => s.nodes)
  const setNodeShards = useSvgCanvasStore((s) => s.setNodeShards)

  // Packing code stays for demos/tests; the control is hidden until BE provisions shards.
  if (!BACKEND_SUPPORTS_SHARDING) return null
  if (selectedIds.length !== 1) return null
  const node = nodes.find((n) => n.id === selectedIds[0])
  if (
    !node ||
    (node.archetype !== 'message-queue' && node.archetype !== 'database')
  ) {
    return null
  }
  const n = node.topology.shards
  const max = shardMaxFor(node.archetype)

  return (
    <div className="ml-2 flex items-center gap-1 rounded-md border border-zinc-300 px-1.5 py-0.5">
      <span className="text-[10px] uppercase tracking-wide text-zinc-400">
        Shards
      </span>
      <button
        type="button"
        className="rounded px-1.5 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100"
        aria-label="Decrease shards"
        disabled={n <= 1}
        onClick={() => setNodeShards(node.id, n - 1)}
      >
        −
      </button>
      <span className="min-w-[1.25rem] text-center text-xs font-medium text-zinc-800">
        {n}
      </span>
      <button
        type="button"
        className="rounded px-1.5 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100"
        aria-label="Increase shards"
        disabled={n >= max}
        onClick={() => setNodeShards(node.id, n + 1)}
      >
        +
      </button>
    </div>
  )
}
