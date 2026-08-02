import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  startBillingPortal,
  startCancelSubscription,
  startEngineerCheckout,
  StripeCheckoutError,
} from './stripeCheckout'

vi.mock('./auth', () => ({
  getAccessToken: vi.fn(),
}))

vi.mock('../product/stores/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(),
  },
}))

vi.mock('./supabase', () => ({
  supabase: {},
}))

import { getAccessToken } from './auth'
import { useAuthStore } from '../product/stores/authStore'

describe('stripeCheckout', () => {
  const fetchMock = vi.fn()
  const assign = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    assign.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test')
    vi.mocked(getAccessToken).mockReturnValue('tok')
    vi.mocked(useAuthStore.getState).mockReturnValue({
      session: {
        access_token: 'tok',
        user: { id: 'user-1', email: 'a@b.co' },
      },
    } as never)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('posts to create-checkout-session and redirects', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://checkout.stripe.com/c/pay_123' }),
    })
    await startEngineerCheckout({ assign })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/functions/v1/create-checkout-session',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tok',
          apikey: 'anon-test',
        }),
        body: JSON.stringify({ userId: 'user-1' }),
      }),
    )
    expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay_123')
  })

  it('posts to create-portal-session and redirects', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://billing.stripe.com/session/test' }),
    })
    await startBillingPortal({ assign })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/functions/v1/create-portal-session',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ userId: 'user-1' }),
      }),
    )
    expect(assign).toHaveBeenCalledWith('https://billing.stripe.com/session/test')
  })

  it('posts to cancel-subscription', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, refunded: true }),
    })
    await expect(startCancelSubscription()).resolves.toEqual({
      ok: true,
      alreadyCanceled: false,
      refunded: true,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/functions/v1/cancel-subscription',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ userId: 'user-1' }),
      }),
    )
  })

  it('checks cancel eligibility without canceling', async () => {
    const { checkCancelEligibility } = await import('./stripeCheckout')
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ canCancel: true }),
    })
    await expect(checkCancelEligibility()).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/functions/v1/cancel-subscription',
      expect.objectContaining({
        body: JSON.stringify({ userId: 'user-1', checkOnly: true }),
      }),
    )
  })

  it('surfaces cancel 409 without treating as success', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      text: async () =>
        JSON.stringify({
          error:
            'Cancel is only available if you have not used Engineer this billing period. You can stop renewal instead.',
        }),
    })
    await expect(startCancelSubscription()).rejects.toBeInstanceOf(
      StripeCheckoutError,
    )
  })

  it('throws on Edge Function error without redirecting', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => JSON.stringify({ error: 'price not configured' }),
    })
    await expect(startEngineerCheckout({ assign })).rejects.toBeInstanceOf(
      StripeCheckoutError,
    )
    expect(assign).not.toHaveBeenCalled()
  })

  it('requires a signed-in session', async () => {
    vi.mocked(getAccessToken).mockReturnValue(null)
    vi.mocked(useAuthStore.getState).mockReturnValue({ session: null } as never)
    await expect(startEngineerCheckout({ assign })).rejects.toThrow(/Sign in/)
  })
})
