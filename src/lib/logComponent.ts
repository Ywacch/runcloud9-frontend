/** Canonical inspector/backend log component ids. */
export type LogComponentId = 'db' | 'cache' | 'app-server' | 'mq' | 'worker' | 'lb' | 'client'

const LOG_COMPONENT_ALIASES: Record<string, LogComponentId> = {
  db: 'db',
  database: 'db',
  postgres: 'db',
  'postgres-replica': 'db',
  cache: 'cache',
  redis: 'cache',
  'cache-proxy': 'cache',
  'redis-internal': 'cache',
  'app-server': 'app-server',
  compute: 'app-server',
  mq: 'mq',
  rabbitmq: 'mq',
  'message-queue': 'mq',
  message_queue: 'mq',
  worker: 'worker',
  lb: 'lb',
  nginx: 'lb',
  'load-balancer': 'lb',
  load_balancer: 'lb',
  client: 'client',
}

/**
 * Quiet infra components lose the ring-buffer fight against app-server JSON.
 * Keep a reserved slice of the buffer so db/cache/mq/lb lines survive floods.
 */
export const QUIET_LOG_COMPONENTS = new Set<string>(['db', 'cache', 'mq', 'lb'])

/** Map a wire or canvas component string onto the backend log id. */
export function normalizeLogComponent(component: string): string {
  const key = component.trim().toLowerCase()
  return LOG_COMPONENT_ALIASES[key] ?? key
}

export function logComponentMatches(lineComponent: string, expected: string): boolean {
  return normalizeLogComponent(lineComponent) === normalizeLogComponent(expected)
}

export function isQuietLogComponent(component: string): boolean {
  return QUIET_LOG_COMPONENTS.has(normalizeLogComponent(component))
}
