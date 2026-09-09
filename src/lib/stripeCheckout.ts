import { getAccessToken } from './auth'
import { trackEvent, type CheckoutStartedSource } from './analytics'
import { useAuthStore } from '../product/stores/authStore'

export {
  displayPlanTierLabel,
  formatSessionsLeftThisMonth,
  isChaosTrialUsedMessage,
  REPLICAS_HELP_FREE,
  replicasHelpPaid,
  RESOURCE_PROFILE_HELPER,
  UPGRADE_TO_ENGINEER_LABEL,
  UPGRADE_TO_SCALE_REPLICAS_TOOLTIP,
  UPGRADE_TO_UNLOCK_TOOLTIP,
} from './billingCopy'

export class StripeCheckoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StripeCheckoutError'
  }
}

function supabaseConfig(): { url: string; anonKey: string } {
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
  if (!url || !anonKey) {
    throw new StripeCheckoutError(
      'Billing is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    )
  }
  return { url: url.replace(/\/$/, ''), anonKey }
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text()
  if (!text) return res.statusText || `HTTP ${res.status}`
  try {
    const j = JSON.parse(text) as { error?: string; message?: string }
    if (typeof j.error === 'string' && j.error.trim()) return j.error
    if (typeof j.message === 'string' && j.message.trim()) return j.message
  } catch {
    /* not JSON */
  }
  return text.slice(0, 200)
}

function requireSignedInUserId(): { token: string; userId: string } {
  const session = useAuthStore.getState().session
  const token = getAccessToken()
  const userId = session?.user?.id?.trim()
  if (!session || !token || !userId) {
    throw new StripeCheckoutError('Sign in to manage billing.')
  }
  return { token, userId }
}

async function postBillingFunction(
  path: string,
  userId: string,
  token: string,
  extra?: Record<string, unknown>,
): Promise<Response> {
  const { url, anonKey } = supabaseConfig()
  return fetch(`${url}/functions/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, ...extra }),
  })
}

/**
 * Create a Stripe Checkout session via the deployed Supabase Edge Function
 * and redirect the browser to Stripe.
 */
export async function startEngineerCheckout(opts?: {
  assign?: (url: string) => void
  source?: CheckoutStartedSource
}): Promise<void> {
  const session = useAuthStore.getState().session
  const token = getAccessToken()
  const userId = session?.user?.id?.trim()
  if (!session || !token || !userId) {
    throw new StripeCheckoutError('Sign in to upgrade to Engineer.')
  }

  const res = await postBillingFunction('create-checkout-session', userId, token)

  if (!res.ok) {
    throw new StripeCheckoutError(await readErrorMessage(res))
  }

  let checkoutUrl: string | undefined
  try {
    const body = (await res.json()) as { url?: string }
    checkoutUrl = typeof body.url === 'string' ? body.url.trim() : undefined
  } catch {
    throw new StripeCheckoutError('Checkout response was invalid.')
  }
  if (!checkoutUrl) {
    throw new StripeCheckoutError('Checkout did not return a redirect URL.')
  }

  trackEvent('checkout_started', {
    source: opts?.source ?? 'unknown',
  })
  const assign =
    opts?.assign ??
    ((href: string) => {
      window.location.assign(href)
    })
  assign(checkoutUrl)
}

/** Open Stripe Customer Portal (Stop renewal / resume / payment method). */
export async function startBillingPortal(opts?: {
  assign?: (url: string) => void
}): Promise<void> {
  const { token, userId } = requireSignedInUserId()
  const res = await postBillingFunction('create-portal-session', userId, token)

  if (!res.ok) {
    throw new StripeCheckoutError(await readErrorMessage(res))
  }

  let portalUrl: string | undefined
  try {
    const body = (await res.json()) as { url?: string }
    portalUrl = typeof body.url === 'string' ? body.url.trim() : undefined
  } catch {
    throw new StripeCheckoutError('Portal response was invalid.')
  }
  if (!portalUrl) {
    throw new StripeCheckoutError('Portal did not return a redirect URL.')
  }

  const assign =
    opts?.assign ??
    ((href: string) => {
      window.location.assign(href)
    })
  assign(portalUrl)
}

/**
 * Whether Cancel & refund is allowed (unused in current Stripe billing period).
 */
export async function checkCancelEligibility(): Promise<boolean> {
  const { token, userId } = requireSignedInUserId()
  const res = await postBillingFunction('cancel-subscription', userId, token, {
    checkOnly: true,
  })
  if (!res.ok) return false
  try {
    const body = (await res.json()) as { canCancel?: boolean }
    return body.canCancel === true
  } catch {
    return false
  }
}

/**
 * Immediate Cancel + refund path (unused in Stripe billing period only).
 * Edge Function enforces period-scoped usage; 409 if used.
 */
export async function startCancelSubscription(): Promise<{
  ok: true
  alreadyCanceled?: boolean
  refunded?: boolean
}> {
  const { token, userId } = requireSignedInUserId()
  const res = await postBillingFunction('cancel-subscription', userId, token)

  if (!res.ok) {
    throw new StripeCheckoutError(await readErrorMessage(res))
  }

  try {
    const body = (await res.json()) as {
      ok?: boolean
      alreadyCanceled?: boolean
      refunded?: boolean
    }
    if (body.ok) {
      return {
        ok: true,
        alreadyCanceled: body.alreadyCanceled === true,
        refunded: body.refunded === true,
      }
    }
  } catch {
    throw new StripeCheckoutError('Cancel response was invalid.')
  }
  throw new StripeCheckoutError('Cancel did not confirm success.')
}
