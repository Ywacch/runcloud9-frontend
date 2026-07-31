import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import { canvasToBackend } from './typeMapping'
import { assessGraphConstraints } from './graphConstraints'
import { getConnectionRulesMap } from './topologyRulesStore'
import type {
  ConnectionRule,
  SemanticComponentType,
} from './topologyRulesTypes'

export type { ConnectionRule, SemanticComponentType } from './topologyRulesTypes'

export type EdgeSemanticClass =
  | 'active'
  | 'decorative'
  | 'unsupported'
  | 'invalid'
  | 'neutral'

export interface EdgeSemanticResult {
  class: EdgeSemanticClass
  message: string
  title: string
}

export interface TopologyWarning {
  code: string
  message: string
  nodeIds?: string[]
  edgeIds?: string[]
}

export const WARNING_CODE_TEMPLATE_NO_ASYNC = 'template_no_async'

const DECORATIVE_IDLE_MESSAGE =
  'This template does not run async workers — message queue and worker nodes will deploy but stay idle on this connection.'

const TEMPLATE_NO_ASYNC_MESSAGE =
  'These components will sit idle — message queue and worker nodes deploy but do not process jobs on this template.'

function ruleKey(source: SemanticComponentType, target: SemanticComponentType): string {
  return `${source}\0${target}`
}

/** Storytelling / YAML edge key, e.g. "app-server->cache". */
export function semanticPairKey(
  source: SemanticComponentType,
  target: SemanticComponentType,
): string {
  return `${source}->${target}`
}

/** Live connection grid from GET /meta/topology-rules (fallback until loaded). */
export function getConnectionRules(): Map<string, ConnectionRule> {
  return getConnectionRulesMap()
}

/** @deprecated Prefer getConnectionRules() — kept for tests that inspect the map. */
export const CONNECTION_RULES = {
  has(key: string): boolean {
    return getConnectionRulesMap().has(key)
  },
  get size(): number {
    return getConnectionRulesMap().size
  },
  get(key: string): ConnectionRule | undefined {
    return getConnectionRulesMap().get(key)
  },
}

/** Platform fallback copy when template storytelling.edges omits a pair. */
const ACTIVE_MEANINGS: Partial<Record<string, string>> = {
  [semanticPairKey('lb', 'app-server')]:
    'Load balancer spreads HTTP traffic to these app pods.',
  [semanticPairKey('app-server', 'db')]:
    'App gets DB credentials and queries Postgres.',
  [semanticPairKey('app-server', 'cache')]:
    'App gets cache host; uses this Redis for get/set (or proxy) per strategy.',
  [semanticPairKey('app-server', 'mq')]: 'App gets queue host and can publish.',
  [semanticPairKey('cache', 'db')]:
    'Proxy cache may fill or flush against this database.',
  [semanticPairKey('worker', 'mq')]: 'Worker consumes from this queue.',
  [semanticPairKey('worker', 'db')]: 'Worker reads and writes this database.',
  [semanticPairKey('worker', 'cache')]: 'Worker can write timeline or cache keys.',
}

export function platformActiveMeaning(
  source: SemanticComponentType,
  target: SemanticComponentType,
): string | undefined {
  return ACTIVE_MEANINGS[semanticPairKey(source, target)]
}

const SEMANTIC_TYPES: SemanticComponentType[] = [
  'lb',
  'app-server',
  'db',
  'cache',
  'mq',
  'worker',
]

export function isSemanticComponentType(
  type: string,
): type is SemanticComponentType {
  return (SEMANTIC_TYPES as string[]).includes(type)
}

export function canvasTypeToSemantic(
  type: CanvasNode['type'],
): SemanticComponentType | 'client' | null {
  if (type === 'client') return 'client'
  const mapped = canvasToBackend[type]
  if (isSemanticComponentType(mapped)) return mapped
  return null
}

function touchesAsyncComponent(
  source: SemanticComponentType,
  target: SemanticComponentType,
): boolean {
  return source === 'mq' || source === 'worker' || target === 'mq' || target === 'worker'
}

export function getConnectionRule(
  source: SemanticComponentType,
  target: SemanticComponentType,
): ConnectionRule | undefined {
  return getConnectionRulesMap().get(ruleKey(source, target))
}

export function classifySemanticPair(
  source: SemanticComponentType,
  target: SemanticComponentType,
  supportsWorker: boolean,
): EdgeSemanticResult {
  const rule = getConnectionRule(source, target)
  if (!rule) {
    return {
      class: 'invalid',
      title: 'Invalid connection',
      message: `Unsupported connection ${source} → ${target}`,
    }
  }
  if (!rule.valid) {
    return {
      class: 'invalid',
      title: 'Invalid connection',
      message: rule.explanation,
    }
  }
  if (!rule.supported) {
    return {
      class: 'unsupported',
      title: 'Not deployable yet',
      message:
        rule.explanation ||
        `Connection ${source} → ${target} is valid but not supported yet`,
    }
  }
  if (!supportsWorker && touchesAsyncComponent(source, target)) {
    return {
      class: 'decorative',
      title: 'Idle on this template',
      message: DECORATIVE_IDLE_MESSAGE,
    }
  }
  const meaning =
    platformActiveMeaning(source, target) ??
    `Valid ${source} → ${target} connection for this template.`
  return {
    class: 'active',
    title: 'Active connection',
    message: meaning,
  }
}

export function classifyCanvasEdge(
  edge: Pick<CanvasEdge, 'id' | 'sourceId' | 'targetId'>,
  nodes: Record<string, CanvasNode>,
  supportsWorker: boolean,
): EdgeSemanticResult | null {
  const source = nodes[edge.sourceId]
  const target = nodes[edge.targetId]
  if (!source || !target) return null

  const sourceSemantic = canvasTypeToSemantic(source.type)
  const targetSemantic = canvasTypeToSemantic(target.type)
  if (sourceSemantic === 'client' || targetSemantic === 'client') {
    return {
      class: 'neutral',
      title: 'Traffic source',
      message: 'Client connections are not validated for deploy semantics.',
    }
  }
  if (!sourceSemantic || !targetSemantic) {
    return {
      class: 'invalid',
      title: 'Invalid connection',
      message: `Unsupported component type on connection`,
    }
  }
  return classifySemanticPair(sourceSemantic, targetSemantic, supportsWorker)
}

export function classifyAllCanvasEdges(
  nodes: Record<string, CanvasNode>,
  edges: Record<string, CanvasEdge>,
  supportsWorker: boolean,
): Record<string, EdgeSemanticResult> {
  const out: Record<string, EdgeSemanticResult> = {}
  for (const edge of Object.values(edges)) {
    const result = classifyCanvasEdge(edge, nodes, supportsWorker)
    if (result) out[edge.id] = result
  }
  return out
}

export function assessWholeDesign(
  nodes: Record<string, CanvasNode>,
  edges: Record<string, CanvasEdge> = {},
): string | null {
  return assessGraphConstraints(nodes, edges)
}

export interface DeployTopologyPreflight {
  wholeDesignIssue: string | null
  invalidEdges: Array<{ edgeId: string; message: string }>
  decorativeEdges: Array<{ edgeId: string; message: string }>
  hasIdleAsyncNodes: boolean
  needsDecorativeConfirm: boolean
  decorativeConfirmMessage: string
}

export function analyzeDeployTopology(
  nodes: Record<string, CanvasNode>,
  edges: Record<string, CanvasEdge>,
  supportsWorker: boolean,
): DeployTopologyPreflight {
  const wholeDesignIssue = assessGraphConstraints(nodes, edges)
  const invalidEdges: DeployTopologyPreflight['invalidEdges'] = []
  const decorativeEdges: DeployTopologyPreflight['decorativeEdges'] = []

  for (const edge of Object.values(edges)) {
    const result = classifyCanvasEdge(edge, nodes, supportsWorker)
    if (!result || result.class === 'neutral') continue
    if (result.class === 'invalid') {
      invalidEdges.push({ edgeId: edge.id, message: result.message })
    } else if (result.class === 'decorative') {
      decorativeEdges.push({ edgeId: edge.id, message: result.message })
    }
  }

  const hasIdleAsyncNodes =
    !supportsWorker &&
    Object.values(nodes).some((n) => {
      const t = canvasTypeToSemantic(n.type)
      return t === 'mq' || t === 'worker'
    })

  const needsDecorativeConfirm =
    decorativeEdges.length > 0 || hasIdleAsyncNodes

  return {
    wholeDesignIssue,
    invalidEdges,
    decorativeEdges,
    hasIdleAsyncNodes,
    needsDecorativeConfirm,
    decorativeConfirmMessage: TEMPLATE_NO_ASYNC_MESSAGE,
  }
}

export function templateNoAsyncWarning(
  templateId: string,
  nodeIds: string[],
): TopologyWarning {
  return {
    code: WARNING_CODE_TEMPLATE_NO_ASYNC,
    message: `Template "${templateId}" does not run async workers — message queue and worker nodes will deploy but stay idle`,
    nodeIds,
  }
}
