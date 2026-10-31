export interface ResourceLimitsJSON {
  cpu: string
  memory: string
  ephemeralStorage: string
  profile?: string
}

export interface ResourceProfilesResponse {
  profiles: Record<string, ResourceLimitsJSON>
  components: Record<string, ResourceLimitsJSON>
}

export interface DeploymentNode {
  id: string
  type: string
  name: string
  config: Record<string, unknown>
  /** Canvas lattice position persisted for layout miniviews. */
  position?: [number, number, number]
}

export interface DeploymentConn {
  sourceId: string
  targetId: string
  protocol: string
}

export interface DeploymentDesign {
  version: string
  template: string
  archetype: string
  nodes: DeploymentNode[]
  connections: DeploymentConn[]
  /** Optional live session length (minutes). Honored for paid tiers only on the API. */
  sessionMinutes?: number
  /** Optional explicit job id to canvas node id bindings. */
  jobBindings?: Record<string, string>
}

/** Compact layout returned on deployment history list items. */
export interface DeploymentHistoryTopology {
  nodes: Array<{
    id: string
    type: string
    position?: [number, number, number]
  }>
  connections: DeploymentConn[]
}
