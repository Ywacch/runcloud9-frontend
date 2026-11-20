import { normalizeLogComponent } from './logComponent'

/** Prototype log tab uses friendly source names, not backend ids. */
const LOG_SRC_LABEL: Record<string, string> = {
  db: 'postgres',
  cache: 'redis',
  mq: 'message-queue',
  'app-server': 'app-server',
  lb: 'load-balancer',
  worker: 'worker',
  client: 'client',
}

export function logSourceLabel(component: string): string {
  const id = normalizeLogComponent(component)
  return LOG_SRC_LABEL[id] ?? id
}

/** Elapsed clock as in runcloud9-ui canvas logs (`+0:11`). */
export function formatLogElapsedClock(sec: number): string {
  const n = Math.max(0, Math.floor(sec))
  const m = Math.floor(n / 60)
  const s = n % 60
  return `+${m}:${s.toString().padStart(2, '0')}`
}

export function logElapsedSeconds(
  timestamp: string,
  originMs: number,
): number {
  const at = Date.parse(timestamp)
  if (!Number.isFinite(at) || !Number.isFinite(originMs)) return 0
  return Math.max(0, (at - originMs) / 1000)
}

export function logOriginMs(timestamps: readonly string[]): number {
  let min = Number.POSITIVE_INFINITY
  for (const raw of timestamps) {
    const at = Date.parse(raw)
    if (Number.isFinite(at) && at < min) min = at
  }
  return Number.isFinite(min) ? min : Date.now()
}

export function logLevelKind(
  level: string | undefined,
  message: string,
): 'err' | 'warn' | 'info' {
  const lvl = (level ?? '').toLowerCase()
  const lower = message.toLowerCase()
  if (lvl === 'error' || lower.includes('error')) return 'err'
  if (lvl === 'warn' || lvl === 'warning' || lower.includes('warn')) return 'warn'
  return 'info'
}
