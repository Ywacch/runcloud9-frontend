/**
 * What the deployer can actually provision today. Visual code (SVG packing,
 * engine skins) may exceed this; user-facing controls and deploy payloads must not.
 * Mirrors ganymede: no `shards` handling, DB_ENGINE defaults postgresql, cache is redis.
 * Cache / DB / worker replica topology stays visual-only until BE owns it end-to-end.
 */
import type { CanvasNode } from '../editor-core/stores/canvasStore'

/** Engines the backend provisions, by canvas node type. Empty = no engine choice. */
export const BACKEND_ENGINES: Record<CanvasNode['type'], string[]> = {
  database: ['postgresql'],
  cache: ['redis'],
  message_queue: ['rabbitmq'],
  compute: [],
  worker: [],
  load_balancer: [],
  client: [],
}

/** Sharding is visual only — the deployer provisions one instance per component. */
export const BACKEND_SUPPORTS_SHARDING = false

/**
 * User-facing / deploy-wire replica counts.
 * Compute scales via config.replicas (+ auto-LB). Cache, DB, and worker stay at 1
 * until provisioned topology matches the SVG packing UI.
 */
export const BACKEND_REPLICA_TYPES: ReadonlySet<CanvasNode['type']> = new Set([
  'compute',
])

export function backendEnginesForType(type: CanvasNode['type']): string[] {
  return BACKEND_ENGINES[type] ?? []
}

export function isBackendSupportedEngine(
  type: CanvasNode['type'],
  engine: string,
): boolean {
  const supported = backendEnginesForType(type)
  if (supported.length === 0) return true
  return supported.includes(engine.trim().toLowerCase())
}

/** Unsupported or blank engines fall back to the single provisioned engine. */
export function backendEngineOrDefault(
  type: CanvasNode['type'],
  engine: unknown,
): string | undefined {
  const supported = backendEnginesForType(type)
  if (supported.length === 0) return undefined
  const raw = String(engine ?? '').trim().toLowerCase()
  return supported.includes(raw) ? raw : supported[0]
}

export function backendSupportsReplicas(type: CanvasNode['type']): boolean {
  return BACKEND_REPLICA_TYPES.has(type)
}
