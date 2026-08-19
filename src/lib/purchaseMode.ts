/** Matches ticket-drop PURCHASE_MODE env (ganymede DeriveEnvVars). */
export type PurchaseMode = 'unsafe' | 'safe'

export const PURCHASE_MODE_DEFAULT: PurchaseMode = 'unsafe'

export const PURCHASE_MODE_HELP =
  'Unsafe uses a racy read-then-write path (oversell possible under load). Safe serializes purchases with FOR UPDATE (no oversell).'

const TICKET_DROP_TEMPLATE = 'ticket-drop'

export function templateSupportsPurchaseMode(templateId: unknown): boolean {
  return String(templateId ?? '').trim() === TICKET_DROP_TEMPLATE
}

/** Normalizes canvas config to unsafe or safe. */
export function normalizePurchaseMode(raw: unknown): PurchaseMode {
  const v = String(raw ?? '').trim().toLowerCase()
  if (v === 'safe') return 'safe'
  return 'unsafe'
}

export function purchaseModeFromConfig(
  config: Record<string, unknown>,
): PurchaseMode {
  return normalizePurchaseMode(config.purchaseMode)
}

export function purchaseModeLabel(mode: PurchaseMode): string {
  return mode === 'safe' ? 'Safe (no oversell)' : 'Unsafe (can oversell)'
}
