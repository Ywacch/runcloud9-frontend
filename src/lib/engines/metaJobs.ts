import {
  DEPLOYMENTS_API_PREFIX,
  fetchMetaJobs,
  type MetaJobsResponse,
} from '../api'

let cachedEtag: string | null = null
let cachedBody: MetaJobsResponse | null = null

function metaJobsUrl(): string {
  return `${DEPLOYMENTS_API_PREFIX.replace(/\/?deployments\/?$/, '')}/meta/jobs`
}

/** Clears the in-memory /meta/jobs cache (tests). */
export function resetMetaJobsCache(): void {
  cachedEtag = null
  cachedBody = null
}

/** Test hook: inject catalog without fetch. */
export function setMetaJobsCacheForTest(
  body: MetaJobsResponse,
  etag = '"test"',
): void {
  cachedBody = body
  cachedEtag = etag
}

/**
 * Loads the jobs catalog, reusing the cached body when the server returns 304.
 */
export async function loadMetaJobs(): Promise<MetaJobsResponse> {
  const headers: HeadersInit = {}
  if (cachedEtag) {
    headers['If-None-Match'] = cachedEtag
  }
  const res = await fetch(metaJobsUrl(), { headers })
  if (res.status === 304 && cachedBody) {
    return cachedBody
  }
  if (!res.ok) {
    throw new Error(`meta/jobs: ${res.status}`)
  }
  const etag = res.headers.get('ETag')
  const body = (await res.json()) as MetaJobsResponse
  if (etag) {
    cachedEtag = etag
  }
  cachedBody = body
  return body
}

export { fetchMetaJobs }
