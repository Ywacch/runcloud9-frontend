/** Mirrors ganymede/pkg/placement JSON (lowerCamel fields). */

export interface PlacementTopology {
  nodes: PlacementNode[]
  jobs: PlacementJob[]
}

export interface PlacementNode {
  nodeId: string
  nodeType: string
  engine?: string
  family?: string
  members: PlacementMember[]
  jobs?: string[]
}

export interface PlacementMember {
  role: string
  index?: number
  appLabel: string
  container: string
  service?: string
  port?: string
}

export interface PlacementJob {
  job: string
  component: string
  nodeId: string
  engine: string
  shared?: boolean
  explicit?: boolean
}