import { ApiError } from './apiError'

export const DEFAULT_API_FETCH_TIMEOUT_MS = 20_000

export type ApiFetchInit = RequestInit & {
  timeoutMs?: number
}

export function parseApiErrorBody(
  text: string,
  res: Response,
): { message: string; reason?: string } {
  if (!text) return { message: res.statusText || `HTTP ${res.status}` }
  try {
    const j = JSON.parse(text) as { error?: string; reason?: string }
    const message =
      typeof j.error === 'string' ? j.error : text.slice(0, 200)
    const reason = typeof j.reason === 'string' ? j.reason : undefined
    return { message, reason }
  } catch {
    return { message: text.slice(0, 200) }
  }
}

function composeAbortSignal(
  callerSignal: AbortSignal | null | undefined,
  timeoutMs: number,
): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const onCallerAbort = () => controller.abort()
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort()
    else callerSignal.addEventListener('abort', onCallerAbort)
  }

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timeoutId)
      if (callerSignal) callerSignal.removeEventListener('abort', onCallerAbort)
    },
  }
}

/** fetch with timeout + optional caller signal; throws ApiError on non-OK. */
export async function apiFetch(
  url: string,
  init: ApiFetchInit = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_API_FETCH_TIMEOUT_MS, signal, ...rest } = init
  const composed = composeAbortSignal(signal, timeoutMs)
  try {
    const res = await fetch(url, { ...rest, signal: composed.signal })
    if (!res.ok) {
      const text = await res.text()
      const { message, reason } = parseApiErrorBody(text, res)
      throw new ApiError(res.status, message, reason)
    }
    return res
  } finally {
    composed.dispose()
  }
}
