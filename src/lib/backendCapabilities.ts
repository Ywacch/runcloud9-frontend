/**
 * What the deployer can actually provision today. Visual code (SVG packing,
 * engine skins) may exceed this; user-facing controls and deploy payloads must not.
 * Mirrors ganymede: no `shards` handling, DB_ENGINE defaults postgresql.
 * Cache fallback is Redis, then Memcached. `/meta/jobs` replaces this list when it loads.
 * Database read replicas are provisioned via readReplicas; cache stays single-instance.
 */
import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetaJobsResponse } from './api'

/** Engines the backend provisions, by canvas node type. Empty = no engine choice. */
export const BACKEND_ENGINES: Record<CanvasNode['type'], string[]> = {
  database: ['postgresql'],
  cache: ['redis', 'memcached'],
  message_queue: ['rabbitmq'],
  compute: [],
  worker: [],
  load_balancer: [],
  client: [],
}

/** Maps catalog jobs to canvas node types for provisioned-engine lists. */
const CATALOG_JOBS_BY_NODE_TYPE: Partial<
  Record<CanvasNode['type'], readonly string[]>
> = {
  database: ['main_db'],
  cache: ['hot_cache'],
  message_queue: ['work_queue'],
}

let catalogEnginesByType: Partial<
  Record<CanvasNode['type'], string[]>
> | null = null

let replicaApplyDelayEngineIds: Set<string> | null = null

/** Applies `/meta/jobs` pairs with `build: available` to deploy-time engine lists. */
export function applyEnginesCatalog(catalog: MetaJobsResponse): void {
  const next: Partial<Record<CanvasNode['type'], string[]>> = {}
  const lagDial = new Set<string>()
  for (const eng of catalog.engines ?? []) {
    if (eng.replicaApplyDelay) {
      lagDial.add(eng.id.trim().toLowerCase())
    }
  }
  replicaApplyDelayEngineIds = lagDial.size > 0 ? lagDial : null
  for (const [nodeType, jobs] of Object.entries(CATALOG_JOBS_BY_NODE_TYPE) as [
    CanvasNode['type'],
    readonly string[],
  ][]) {
    const engines = new Set<string>()
    for (const pair of catalog.pairs) {
      if (!jobs.includes(pair.job) || pair.build !== 'available') continue
      engines.add(pair.engine.trim().toLowerCase())
    }
    if (engines.size > 0) {
      next[nodeType] = [...engines].sort()
    }
  }
  catalogEnginesByType = next
}

/** Clears catalog-driven engines (tests). */
export function resetBackendEnginesCatalog(): void {
  catalogEnginesByType = null
  replicaApplyDelayEngineIds = null
}

/** Sharding is visual only — the deployer provisions one instance per component. */
export const BACKEND_SUPPORTS_SHARDING = false

/**
 * User-facing / deploy-wire replica counts.
 * Compute scales via config.replicas (+ auto-LB). Worker scales via Deployment replicas.
 * Cache and DB stay at 1 until provisioned topology matches the SVG packing UI.
 */
export const BACKEND_REPLICA_TYPES: ReadonlySet<CanvasNode['type']> = new Set([
  'compute',
  'worker',
])

export function backendEnginesForType(type: CanvasNode['type']): string[] {
  const fromCatalog = catalogEnginesByType?.[type]
  if (fromCatalog?.length) return fromCatalog
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

const PREFERRED_BLANK_ENGINE: Partial<Record<CanvasNode['type'], string>> = {
  cache: 'redis',
  database: 'postgresql',
  message_queue: 'rabbitmq',
}

function fallbackEngine(type: CanvasNode['type'], supported: string[]): string {
  const prefer = PREFERRED_BLANK_ENGINE[type]
  if (prefer && supported.includes(prefer)) return prefer
  return supported[0]
}

/** Unsupported engines fall back to the first provisioned engine.
 * A blank cache engine stays Redis even when the catalog lists Memcached first.
 */
export function backendEngineOrDefault(
  type: CanvasNode['type'],
  engine: unknown,
): string | undefined {
  const supported = backendEnginesForType(type)
  if (supported.length === 0) return undefined
  const raw = String(engine ?? '').trim().toLowerCase()
  if (!raw) return fallbackEngine(type, supported)
  return supported.includes(raw) ? raw : supported[0]
}

export function backendSupportsReplicas(type: CanvasNode['type']): boolean {
  return BACKEND_REPLICA_TYPES.has(type)
}

/** Postgres streaming read replicas (readReplicas knob, not config.replicas). */
export function backendSupportsReadReplicas(type: CanvasNode['type']): boolean {
  return type === 'database'
}

function normalizeDatabaseEngineId(engine: unknown): string {
  const raw = String(engine ?? '').trim().toLowerCase()
  if (!raw || raw === 'postgres') return 'postgresql'
  return raw
}

/** Lab lag dial (recovery_min_apply_delay) when the engines catalog marks the engine. */
export function backendSupportsReplicaApplyDelay(engine: unknown): boolean {
  const id = normalizeDatabaseEngineId(engine)
  if (replicaApplyDelayEngineIds) {
    return replicaApplyDelayEngineIds.has(id)
  }
  return id === 'postgresql'
}
