import { getAccessToken } from './auth'
import { useAuthStore } from '../product/stores/authStore'

export const UPGRADE_TO_ENGINEER_LABEL = 'Upgrade to Engineer'

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

/**
 * Create a Stripe Checkout session via the deployed Supabase Edge Function
 * and redirect the browser to Stripe.
 */
export async function startEngineerCheckout(opts?: {
  assign?: (url: string) => void
}): Promise<void> {
  const session = useAuthStore.getState().session
  const token = getAccessToken()
  const userId = session?.user?.id?.trim()
  const email = session?.user?.email?.trim()
  if (!session || !token || !userId || !email) {
    throw new StripeCheckoutError('Sign in to upgrade to Engineer.')
  }

  const { url, anonKey } = supabaseConfig()
  const res = await fetch(`${url}/functions/v1/create-checkout-session`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, email }),
  })

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

  const assign = opts?.assign ?? ((href: string) => {
    window.location.assign(href)
  })
  assign(checkoutUrl)
}

export function isChaosTrialUsedMessage(raw: string): boolean {
  return raw.toLowerCase().includes('chaos trial already used')
}

/** Plan label for UI — never expose internal. */
export function displayPlanTierLabel(
  effectiveTier: string | null | undefined,
): string {
  switch (effectiveTier) {
    case 'engineer':
    case 'internal':
      return 'Engineer'
    case 'free':
      return 'Explorer'
    default:
      return 'Explorer'
  }
}
