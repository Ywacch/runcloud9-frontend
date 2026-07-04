import { create } from 'zustand'
import { getResourceProfiles, type ResourceProfilesResponse } from './api'
import { FALLBACK_RESOURCE_PROFILES } from './resourceProfileCatalogFallback'

interface ResourceProfileState {
  catalog: ResourceProfilesResponse | null
  loadAttempted: boolean
}

export const useResourceProfileStore = create<ResourceProfileState>(() => ({
  catalog: null,
  loadAttempted: false,
}))

export function getResourceProfilesCached(): ResourceProfilesResponse {
  return useResourceProfileStore.getState().catalog ?? FALLBACK_RESOURCE_PROFILES
}

export function useResourceProfiles(): ResourceProfilesResponse {
  return useResourceProfileStore((s) => s.catalog ?? FALLBACK_RESOURCE_PROFILES)
}

export async function ensureResourceProfilesLoaded(): Promise<void> {
  const { loadAttempted } = useResourceProfileStore.getState()
  if (loadAttempted) return
  useResourceProfileStore.setState({ loadAttempted: true })
  try {
    const catalog = await getResourceProfiles()
    useResourceProfileStore.setState({ catalog })
  } catch {
    /* session uses FALLBACK_RESOURCE_PROFILES */
  }
}
