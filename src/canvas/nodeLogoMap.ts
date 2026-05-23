// To add alternative engine support later: add an
// overrideLogoMap: Record<string, string> keyed by config.engine
// and check it before NODE_LOGO_MAP in resolveNodeLogo().

export const NODE_LOGO_MAP: Record<string, string> = {
  database: '/logos/postgresql.svg',
  cache: '/logos/redis.svg',
  message_queue: '/logos/rabbitmq.svg',
  load_balancer: '/logos/nginx.svg',
}

export function resolveNodeLogo(nodeType: string): string | null {
  return NODE_LOGO_MAP[nodeType] ?? null
}
