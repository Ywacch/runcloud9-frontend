/**
 * Logo assets for engine face marks (iso-projected onto unit top faces).
 *
 * Vendored from https://svglogos.dev/ (gilbarbara/logos). See ATTRIBUTION.md.
 * Prefer *-icon.svg at badge size when both icon + wordmark exist.
 */

import goSvg from '../assets/logos/go.svg?raw'
import gopherSvg from '../assets/logos/gopher.svg?raw'
import kafkaIcon from '../assets/logos/kafka-icon.svg?raw'
import memcachedSvg from '../assets/logos/memcached.svg?raw'
import mongodbIcon from '../assets/logos/mongodb-icon.svg?raw'
import natsIcon from '../assets/logos/nats-icon.svg?raw'
import nginxSvg from '../assets/logos/nginx.svg?raw'
import postgresqlSvg from '../assets/logos/postgresql.svg?raw'
import rabbitmqIcon from '../assets/logos/rabbitmq-icon.svg?raw'
import redisSvg from '../assets/logos/redis.svg?raw'

export const LOGO_SVG: Record<string, string> = {
  postgresql: postgresqlSvg,
  mongodb: mongodbIcon,
  memcached: memcachedSvg,
  kafka: kafkaIcon,
  nats: natsIcon,
  rabbitmq: rabbitmqIcon,
  redis: redisSvg,
  go: goSvg,
  gopher: gopherSvg,
  nginx: nginxSvg,
}

export function logoDataUrl(logoId: string): string | null {
  const raw = LOGO_SVG[logoId]
  if (!raw) return null
  return `data:image/svg+xml;utf8,${encodeURIComponent(raw)}`
}
