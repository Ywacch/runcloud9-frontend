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
}
