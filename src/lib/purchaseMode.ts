/** Matches ticket-drop PURCHASE_MODE env (ganymede DeriveEnvVars). */
export type PurchaseMode = 'unsafe' | 'safe' | 'optimistic'

export const PURCHASE_MODE_DEFAULT: PurchaseMode = 'unsafe'

export const PURCHASE_MODE_HELP =
  'Where inventory is checked: app read-then-write (oversell), row lock (FOR UPDATE), or conditional UPDATE in the database.'

export const DEFAULT_SEED_EVENT_NAME = 'Midnight Arena - Floor'
export const DEFAULT_SEED_EVENT_CAPACITY = 100
export const SEED_EVENT_CAPACITY_MIN = 1
export const SEED_EVENT_CAPACITY_MAX = 10_000

const TICKET_DROP_TEMPLATE = 'ticket-drop'

export interface PurchasePathInfo {
  label: string
  layer: string
  sql: string[]
  underDrop: string
}

export function templateSupportsPurchaseMode(templateId: unknown): boolean {
  return String(templateId ?? '').trim() === TICKET_DROP_TEMPLATE
}

/** Normalizes canvas config to a live purchase mode. */
export function normalizePurchaseMode(raw: unknown): PurchaseMode {
  const v = String(raw ?? '').trim().toLowerCase()
  if (v === 'safe') return 'safe'
  if (v === 'optimistic') return 'optimistic'
  return 'unsafe'
}

export function purchaseModeFromConfig(
  config: Record<string, unknown>,
): PurchaseMode {
  return normalizePurchaseMode(config.purchaseMode)
}

export function purchaseModeLabel(mode: PurchaseMode): string {
  switch (mode) {
    case 'safe':
      return 'Row lock (FOR UPDATE)'
    case 'optimistic':
      return 'Conditional UPDATE'
    default:
      return 'Unsafe (app read-then-write)'
  }
}

export function purchasePathInfo(mode: PurchaseMode): PurchasePathInfo {
  switch (mode) {
    case 'safe':
      return {
        label: purchaseModeLabel(mode),
        layer: 'Database serializes each event row.',
        sql: [
          'SELECT capacity, sold FROM events WHERE id = $1 FOR UPDATE',
          'INSERT INTO purchases …; UPDATE events SET sold = sold + qty',
        ],
        underDrop:
          'HTTP 409 sold out at capacity. Lock wait on the event row under contention. ticket.oversell stays 0.',
      }
    case 'optimistic':
      return {
        label: purchaseModeLabel(mode),
        layer: 'Database predicate: no explicit row lock.',
        sql: [
          'UPDATE events SET sold = sold + $qty',
          'WHERE id = $1 AND sold + $qty <= capacity',
          'RETURNING sold; then INSERT INTO purchases',
        ],
        underDrop:
          'HTTP 409 when the UPDATE matches zero rows. No oversell. Less blocking than FOR UPDATE.',
      }
    default:
      return {
        label: purchaseModeLabel(mode),
        layer: 'App server: check is advisory only.',
        sql: [
          'SELECT capacity; SELECT SUM(qty) FROM purchases',
          'INSERT INTO purchases (ignores capacity)',
        ],
        underDrop:
          'HTTP 200 even past capacity. ticket.oversell > 0 during the drop spike.',
      }
  }
}

export function seedEventNameFromConfig(
  config: Record<string, unknown>,
): string {
  const name = String(config.seedEventName ?? '').trim()
  return name || DEFAULT_SEED_EVENT_NAME
}

export function seedEventCapacityFromConfig(
  config: Record<string, unknown>,
): number {
  const raw = config.seedEventCapacity
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return DEFAULT_SEED_EVENT_CAPACITY
  const cap = Math.floor(n)
  if (cap < SEED_EVENT_CAPACITY_MIN) return DEFAULT_SEED_EVENT_CAPACITY
  if (cap > SEED_EVENT_CAPACITY_MAX) return SEED_EVENT_CAPACITY_MAX
  return cap
}
