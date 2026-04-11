import { NODE_VISUAL } from '../lib/nodeVisual'
import { useCanvasStore, type CanvasNode } from '../store/canvasStore'
import { LiveMetrics } from './LiveMetrics'

const fieldClass =
  'w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none'
const labelClass = 'mb-1 block text-xs uppercase tracking-wider text-gray-400'
const badgeClass = 'rounded bg-gray-800 px-2 py-1 text-xs text-gray-300'

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function InspectorPanel() {
  const mode = useCanvasStore((s) => s.mode)
  const selectedId = useCanvasStore((s) => s.selectedId)
  const nodes = useCanvasStore((s) => s.nodes)
  const selectNode = useCanvasStore((s) => s.selectNode)
  const updateNodeConfig = useCanvasStore((s) => s.updateNodeConfig)
  const updateNodeLabel = useCanvasStore((s) => s.updateNodeLabel)
  const removeNode = useCanvasStore((s) => s.removeNode)

  const node = selectedId ? (nodes[selectedId] ?? null) : null
  const open = node !== null

  const onDelete = () => {
    if (!node) return
    removeNode(node.id)
    selectNode(null)
  }

  return (
    <aside
      className={`fixed top-0 right-0 z-30 flex h-full w-80 flex-col border-l border-gray-800 bg-gray-900/95 text-white shadow-xl backdrop-blur-sm transition-transform duration-200 ease-out ${
        open ? 'translate-x-0' : 'pointer-events-none translate-x-full'
      }`}
      aria-hidden={!open}
    >
      {open && node ? (
        <>
          <header className="flex shrink-0 items-center gap-3 border-b border-gray-800 p-4">
            <span
              className="h-10 w-10 shrink-0 rounded"
              style={{ backgroundColor: NODE_VISUAL[node.type].face }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <span className={labelClass}>Label</span>
              {mode !== 'live' ? (
                <input
                  id="cloud9-inspector-label"
                  type="text"
                  value={node.label}
                  onChange={(e) => updateNodeLabel(node.id, e.target.value)}
                  className={fieldClass}
                />
              ) : (
                <p className="truncate text-sm font-medium text-white">
                  {node.label}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => selectNode(null)}
              className="shrink-0 rounded p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
              aria-label="Close inspector"
            >
              ✕
            </button>
          </header>

          {mode === 'live' ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                <ReadOnlyConfig node={node} />
                <LiveMetrics node={node} />
              </div>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
                <TypeFields
                  node={node}
                  updateConfig={(patch) => updateNodeConfig(node.id, patch)}
                />
              </div>
              <div className="shrink-0 border-t border-gray-800 p-4">
                <button
                  type="button"
                  onClick={onDelete}
                  className="w-full rounded bg-red-900/80 px-4 py-2.5 text-sm font-medium text-red-100 hover:bg-red-800"
                >
                  Delete node
                </button>
              </div>
            </>
          )}
        </>
      ) : null}
    </aside>
  )
}

function ReadOnlyConfig({ node }: { node: CanvasNode }) {
  const c = node.config

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        Configuration
      </h3>
      <div className="flex flex-wrap gap-2">
        {node.type === 'compute' ? (
          <>
            <span className={badgeClass}>
              Replicas: {String(c.replicas ?? 1)}
            </span>
            <span className={badgeClass}>
              Size: {String(c.instanceSize ?? 'small')}
            </span>
          </>
        ) : null}
        {node.type === 'database' ? (
          <>
            <span className={badgeClass}>Engine: PostgreSQL</span>
            <span className={badgeClass}>
              Max conn: {String(c.maxConnections ?? 100)}
            </span>
          </>
        ) : null}
        {node.type === 'cache' ? (
          <>
            <span className={badgeClass}>
              Strategy: {String(c.cacheStrategy ?? 'cache-aside')}
            </span>
            <span className={badgeClass}>
              Eviction: {String(c.evictionPolicy ?? 'allkeys-lru')}
            </span>
            <span className={badgeClass}>
              Max mem: {String(c.maxMemoryMB ?? 256)} MB
            </span>
          </>
        ) : null}
        {node.type === 'load_balancer' ? (
          <span className={badgeClass}>
            Algorithm: {String(c.algorithm ?? 'round-robin')}
          </span>
        ) : null}
        {node.type === 'message_queue' ? (
          <>
            <span className={badgeClass}>Engine: RabbitMQ</span>
            <span className={badgeClass}>
              Durable: {String(c.durable ?? true)}
            </span>
          </>
        ) : null}
        {node.type === 'worker' ? (
          <>
            <span className={badgeClass}>
              Replicas: {String(c.replicas ?? 1)}
            </span>
            <span className={badgeClass}>
              Size: {String(c.instanceSize ?? 'small')}
            </span>
          </>
        ) : null}
        {node.type === 'client' ? (
          <span className={badgeClass}>External traffic source (load generator)</span>
        ) : null}
      </div>
    </div>
  )
}

function TypeFields({
  node,
  updateConfig,
}: {
  node: CanvasNode
  updateConfig: (patch: Partial<CanvasNode['config']>) => void
}) {
  const c = node.config

  switch (node.type) {
    case 'load_balancer':
      return (
        <div>
          <label className={labelClass} htmlFor="lb-algo">
            Algorithm
          </label>
          <select
            id="lb-algo"
            className={fieldClass}
            value={String(c.algorithm ?? 'round-robin')}
            onChange={(e) => updateConfig({ algorithm: e.target.value })}
          >
            <option value="round-robin">round-robin</option>
            <option value="least-connections">least-connections</option>
            <option value="ip-hash">ip-hash</option>
          </select>
        </div>
      )

    case 'compute': {
      const replicas = Number(c.replicas ?? 1)
      const instanceSize = String(c.instanceSize ?? 'small')
      return (
        <>
          <div>
            <label className={labelClass} htmlFor="compute-replicas">
              Replicas
            </label>
            <input
              id="compute-replicas"
              type="number"
              min={1}
              max={5}
              className={fieldClass}
              value={replicas}
              onChange={(e) =>
                updateConfig({
                  replicas: clamp(Number(e.target.value) || 1, 1, 5),
                })
              }
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="compute-size">
              Instance size
            </label>
            <select
              id="compute-size"
              className={fieldClass}
              value={instanceSize}
              onChange={(e) => updateConfig({ instanceSize: e.target.value })}
            >
              <option value="small">small</option>
              <option value="medium">medium</option>
              <option value="large">large</option>
            </select>
          </div>
        </>
      )
    }

    case 'database': {
      const storageGB = Number(c.storageGB ?? 10)
      const maxConnections = Number(c.maxConnections ?? 100)
      return (
        <>
          <div>
            <span className={labelClass}>Engine</span>
            <span className="inline-block rounded bg-gray-800 px-2 py-1.5 text-xs text-gray-300">
              PostgreSQL
            </span>
          </div>
          <div>
            <label className={labelClass} htmlFor="db-storage">
              Storage (GB)
            </label>
            <input
              id="db-storage"
              type="number"
              min={1}
              max={100}
              className={fieldClass}
              value={storageGB}
              onChange={(e) =>
                updateConfig({
                  storageGB: clamp(Number(e.target.value) || 1, 1, 100),
                })
              }
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="db-conn">
              Max connections
            </label>
            <input
              id="db-conn"
              type="number"
              min={10}
              max={500}
              className={fieldClass}
              value={maxConnections}
              onChange={(e) =>
                updateConfig({
                  maxConnections: clamp(
                    Number(e.target.value) || 10,
                    10,
                    500
                  ),
                })
              }
            />
          </div>
        </>
      )
    }

    case 'cache': {
      const maxMemoryMB = Number(c.maxMemoryMB ?? 256)
      const eviction = String(c.evictionPolicy ?? 'allkeys-lru')
      const strategy = String(c.cacheStrategy ?? 'cache-aside')
      return (
        <>
          <div>
            <span className={labelClass}>Engine</span>
            <span className="inline-block rounded bg-gray-800 px-2 py-1.5 text-xs text-gray-300">
              Redis
            </span>
          </div>
          <div>
            <label className={labelClass} htmlFor="cache-mem">
              Max memory (MB)
            </label>
            <input
              id="cache-mem"
              type="number"
              min={64}
              max={1024}
              className={fieldClass}
              value={maxMemoryMB}
              onChange={(e) =>
                updateConfig({
                  maxMemoryMB: clamp(
                    Number(e.target.value) || 64,
                    64,
                    1024
                  ),
                })
              }
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="cache-evict">
              Eviction policy
            </label>
            <select
              id="cache-evict"
              className={fieldClass}
              value={eviction}
              onChange={(e) => updateConfig({ evictionPolicy: e.target.value })}
            >
              <option value="allkeys-lru">allkeys-lru</option>
              <option value="volatile-lru">volatile-lru</option>
              <option value="noeviction">noeviction</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="cache-strat">
              Cache strategy
            </label>
            <select
              id="cache-strat"
              className={fieldClass}
              value={strategy}
              onChange={(e) => updateConfig({ cacheStrategy: e.target.value })}
            >
              <option value="cache-aside">cache-aside</option>
              <option value="write-through">write-through</option>
              <option value="write-behind">write-behind</option>
            </select>
          </div>
        </>
      )
    }

    case 'message_queue':
      return (
        <>
          <div>
            <span className={labelClass}>Engine</span>
            <span className="inline-block rounded bg-gray-800 px-2 py-1.5 text-xs text-gray-300">
              RabbitMQ
            </span>
          </div>
          <div>
            <label className={labelClass} htmlFor="mq-durable">
              Durable queues
            </label>
            <select
              id="mq-durable"
              className={fieldClass}
              value={String(c.durable ?? true)}
              onChange={(e) =>
                updateConfig({ durable: e.target.value === 'true' })
              }
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        </>
      )

    case 'worker': {
      const replicas = Number(c.replicas ?? 1)
      const instanceSize = String(c.instanceSize ?? 'small')
      return (
        <>
          <div>
            <label className={labelClass} htmlFor="worker-replicas">
              Replicas
            </label>
            <input
              id="worker-replicas"
              type="number"
              min={1}
              max={10}
              className={fieldClass}
              value={replicas}
              onChange={(e) =>
                updateConfig({
                  replicas: clamp(Number(e.target.value) || 1, 1, 10),
                })
              }
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="worker-size">
              Instance size
            </label>
            <select
              id="worker-size"
              className={fieldClass}
              value={instanceSize}
              onChange={(e) => updateConfig({ instanceSize: e.target.value })}
            >
              <option value="small">small</option>
              <option value="medium">medium</option>
              <option value="large">large</option>
            </select>
          </div>
        </>
      )
    }

    default:
      return null
  }
}
