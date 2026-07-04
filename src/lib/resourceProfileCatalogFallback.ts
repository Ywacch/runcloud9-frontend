import type { ResourceProfilesResponse } from './api'

/** Offline fallback — must match ganymede/pkg/deployer/resource_catalog.go NewResourceCatalogResponse(). */
export const FALLBACK_RESOURCE_PROFILES: ResourceProfilesResponse = {
  profiles: {
    small: {
      cpu: '125m',
      memory: '256Mi',
      ephemeralStorage: '100Mi',
      profile: 'small',
    },
    medium: {
      cpu: '250m',
      memory: '512Mi',
      ephemeralStorage: '100Mi',
    },
    large: {
      cpu: '500m',
      memory: '1Gi',
      ephemeralStorage: '200Mi',
    },
    alpha: {
      cpu: '125m',
      memory: '256Mi',
      ephemeralStorage: '100Mi',
      profile: 'small',
    },
  },
  components: {
    db: {
      cpu: '125m',
      memory: '256Mi',
      ephemeralStorage: '100Mi',
      profile: 'small',
    },
    mq: {
      cpu: '200m',
      memory: '256Mi',
      ephemeralStorage: '100Mi',
    },
    lb: {
      cpu: '250m',
      memory: '128Mi',
      ephemeralStorage: '50Mi',
    },
    exporter: {
      cpu: '25m',
      memory: '32Mi',
      ephemeralStorage: '50Mi',
    },
  },
}
