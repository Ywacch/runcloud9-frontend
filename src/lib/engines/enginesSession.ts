import { applyEnginesCatalog, resetBackendEnginesCatalog } from '../backendCapabilities'
import { fetchEngineGates, type MetaJobsResponse } from '../api'
import type { EngineGateEntry } from './pickerModel'
import { loadMetaJobs, resetMetaJobsCache } from './metaJobs'

export interface EnginesSession {
  catalog: MetaJobsResponse
  gates: EngineGateEntry[]
}

let cached: EnginesSession | null = null
let inflight: Promise<EnginesSession> | null = null

/** Loads meta/jobs and engine gates once per page session. */
export async function loadEnginesSession(): Promise<EnginesSession> {
  if (cached) return cached
  if (!inflight) {
    inflight = (async () => {
      const catalog = await loadMetaJobs()
      applyEnginesCatalog(catalog)
      let gates: EngineGateEntry[] = []
      try {
        const resp = await fetchEngineGates()
        gates = resp.pairs
      } catch {
        gates = []
      }
      cached = { catalog, gates }
      return cached
    })()
  }
  return inflight
}

/** Test helper. */
export function resetEnginesSession(): void {
  cached = null
  inflight = null
  resetMetaJobsCache()
  resetBackendEnginesCatalog()
}
