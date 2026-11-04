import type { CanvasNode } from '../../editor-core/stores/canvasStore'
import { isBackendSupportedEngine } from '../../lib/backendCapabilities'
import type { Archetype } from '../store/svgTypes'

export type BrandTint = {
  top: string
  left: string
  right: string
}

export type EngineSkin = {
  engine: string
  archetype: Archetype
  label: string
  /**
   * Face colors for procedural / tint paths.
   * Image sprites use accent from `top` only (see brandTintFilter.ts).
   */
  brandTint: BrandTint
  /** Logo id under assets/logos (see logos.ts), or null → letter chip. */
  logoId: string | null
  /** Redis only: body *is* the brand mark. */
  brandBody?: 'redis'
}

const GREY: BrandTint = {
  top: '#e8e8ea',
  left: '#d2d2d4',
  right: '#b8b8bb',
}

export const ENGINE_SKINS: EngineSkin[] = [
  {
    engine: 'generic',
    archetype: 'app-server',
    label: 'Generic',
    brandTint: GREY,
    logoId: 'go',
  },
  {
    engine: 'generic',
    archetype: 'worker',
    label: 'Generic',
    brandTint: { top: '#e4d4f5', left: '#c9b0e8', right: '#b396d9' },
    logoId: 'gopher',
  },
  {
    engine: 'generic',
    archetype: 'load-balancer',
    label: 'Generic',
    brandTint: { top: '#c8f0e6', left: '#9fdccf', right: '#7ec4b5' },
    logoId: 'nginx',
  },
  {
    engine: 'postgresql',
    archetype: 'database',
    label: 'PostgreSQL',
    brandTint: { top: '#7ba3c9', left: '#5b87b0', right: '#4a7199' },
    logoId: 'postgresql',
  },
  {
    engine: 'mongodb',
    archetype: 'database',
    label: 'MongoDB',
    brandTint: { top: '#6bbf8a', left: '#4fa06c', right: '#3d8256' },
    logoId: 'mongodb',
  },
  {
    engine: 'redis',
    archetype: 'cache',
    label: 'Redis',
    brandTint: { top: '#d82f27', left: '#ad261f', right: '#821c17' },
    logoId: null,
    brandBody: 'redis',
  },
  {
    engine: 'memcached',
    archetype: 'cache',
    label: 'Memcached',
    brandTint: { top: '#f0a070', left: '#d88858', right: '#c07048' },
    logoId: 'memcached',
  },
  {
    engine: 'redis',
    archetype: 'message-queue',
    label: 'Redis',
    brandTint: { top: '#d82f27', left: '#ad261f', right: '#821c17' },
    logoId: 'redis',
  },
  {
    engine: 'kafka',
    archetype: 'message-queue',
    label: 'Kafka',
    brandTint: { top: '#f5f5f5', left: '#e0e0e0', right: '#c8c8c8' },
    logoId: 'kafka',
  },
  {
    engine: 'rabbitmq',
    archetype: 'message-queue',
    label: 'RabbitMQ',
    brandTint: { top: '#f5a623', left: '#e09218', right: '#c47d12' },
    logoId: 'rabbitmq',
  },
  {
    engine: 'nats',
    archetype: 'message-queue',
    label: 'NATS',
    brandTint: { top: '#7ec8f0', left: '#5aa8d4', right: '#4a90b8' },
    logoId: 'nats',
  },
]

/** Default engine when placing an archetype from the palette. */
export function defaultEngineForArchetype(archetype: Archetype): string {
  switch (archetype) {
    case 'database':
      return 'postgresql'
    case 'cache':
      return 'redis'
    case 'message-queue':
      return 'rabbitmq'
    case 'client':
      return 'generic'
    default:
      return 'generic'
  }
}

export function resolveSkin(
  archetype: Archetype,
  engine: string,
): EngineSkin {
  const exact = ENGINE_SKINS.find(
    (s) => s.archetype === archetype && s.engine === engine,
  )
  if (exact) return exact
  const fallback = ENGINE_SKINS.find(
    (s) => s.archetype === archetype && s.engine === 'generic',
  )
  if (fallback) return fallback
  return {
    engine,
    archetype,
    label: engine,
    brandTint: GREY,
    logoId: null,
  }
}

/**
 * Brand key for export / landing tooltips. Generic skins use their face logo
 * (nginx, go, …) so metadata isn't just "generic".
 */
export function exportBrandKey(archetype: Archetype, engine: string): string {
  if (engine && engine !== 'generic') return engine
  const skin = resolveSkin(archetype, engine)
  return skin.brandBody ?? skin.logoId ?? engine
}

export function enginesForArchetype(archetype: Archetype): EngineSkin[] {
  return ENGINE_SKINS.filter((s) => s.archetype === archetype)
}

/** Local archetype→canvas type map; avoids importing the bridge (circular). */
const CANVAS_TYPE_BY_ARCHETYPE: Record<Archetype, CanvasNode['type']> = {
  'app-server': 'compute',
  database: 'database',
  cache: 'cache',
  'load-balancer': 'load_balancer',
  'message-queue': 'message_queue',
  worker: 'worker',
  client: 'client',
}

/**
 * Skins the deployer can actually provision. Unsupported engines stay in
 * `ENGINE_SKINS` for later, but never reach the picker.
 */
export function backendSupportedEnginesForArchetype(
  archetype: Archetype,
): EngineSkin[] {
  const type = CANVAS_TYPE_BY_ARCHETYPE[archetype]
  return enginesForArchetype(archetype).filter((s) =>
    isBackendSupportedEngine(type, s.engine),
  )
}

export const MQ_SHARD_MAX = 4
