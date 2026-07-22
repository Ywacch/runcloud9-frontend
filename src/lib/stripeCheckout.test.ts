import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startEngineerCheckout, StripeCheckoutError } from './stripeCheckout'

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
        body: JSON.stringify({ userId: 'user-1', email: 'a@b.co' }),
      }),
    )
    expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay_123')
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
