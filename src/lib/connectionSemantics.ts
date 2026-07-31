import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import { canvasToBackend } from './typeMapping'
import { assessGraphConstraints } from './graphConstraints'

export type SemanticComponentType =
  | 'lb'
  | 'app-server'
  | 'db'
  | 'cache'
  | 'mq'
  | 'worker'

export type EdgeSemanticClass =
  | 'active'
  | 'decorative'
  | 'unsupported'
  | 'invalid'
  | 'neutral'

export interface ConnectionRule {
  valid: boolean
  supported: boolean
  explanation: string
}

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

function buildConnectionRules(): Map<string, ConnectionRule> {
  const m = new Map<string, ConnectionRule>()
  const vs: ConnectionRule = { valid: true, supported: true, explanation: '' }
  const invalid = (explanation: string): ConnectionRule => ({
    valid: false,
    supported: false,
    explanation,
  })
  const unsup = (explanation: string): ConnectionRule => ({
    valid: true,
    supported: false,
    explanation,
  })

  const dbPassive =
    'Databases are passive stores — they do not initiate connections to other components'
  const lbToDB =
    'Load balancers distribute traffic to application servers, not databases directly'
  const lbToCache =
    'Load balancers route HTTP traffic to compute nodes, not cache stores'
  const lbToMQ = 'Load balancers route HTTP traffic, not message queue connections'
  const lbToWorker =
    'Load balancers route HTTP to app-servers; workers consume from queues'
  const cacheToApp = 'Cache nodes do not push data to application servers'
  const cacheToLB = 'Cache nodes do not initiate traffic to load balancers'
  const cacheToMQ = 'Cache nodes do not publish to message queues'
  const cacheToWorker = 'Cache nodes do not push data to workers'
  const cacheToCache = 'Cache-to-cache connections are not supported'
  const mqToApp =
    'Message queues deliver to workers, not back to app-servers (use a separate consumer)'
  const mqToDB = 'Message queues do not write directly to databases; use a worker'
  const mqToLB = 'Message queues do not route through load balancers'
  const mqToCache = 'Message queues do not write to caches directly'
  const mqToWorker =
    'Workers depend on message queues; use worker → mq (not mq → worker)'
  const mqToMQ = 'Queue chaining is not supported'
  const workerToApp = 'Workers do not call back to app-servers'
  const workerToLB =
    'Workers process jobs from queues, they do not route through load balancers'
  const workerToWorker = 'Worker chaining is not supported'
  const appToLB =
    'App-servers receive traffic from load balancers, they do not push connections to them'
  const appToWorker =
    'App-servers publish to message queues, not directly to workers'

  const pair = (a: SemanticComponentType, b: SemanticComponentType, r: ConnectionRule) => {
    m.set(ruleKey(a, b), r)
  }

  pair('lb', 'lb', unsup('Chained load balancers are not wired yet'))
  pair('lb', 'app-server', vs)
  pair('lb', 'db', invalid(lbToDB))
  pair('lb', 'cache', invalid(lbToCache))
  pair('lb', 'mq', invalid(lbToMQ))
  pair('lb', 'worker', invalid(lbToWorker))

  pair('app-server', 'lb', invalid(appToLB))
  pair(
    'app-server',
    'app-server',
    unsup('Service-to-service calls between app-servers are not wired yet'),
  )
  pair('app-server', 'db', vs)
  pair('app-server', 'cache', vs)
  pair('app-server', 'mq', vs)
  pair('app-server', 'worker', invalid(appToWorker))

  pair('db', 'lb', invalid(dbPassive))
  pair('db', 'app-server', invalid(dbPassive))
  pair('db', 'db', invalid(dbPassive))
  pair('db', 'cache', invalid(dbPassive))
  pair('db', 'mq', invalid(dbPassive))
  pair('db', 'worker', invalid(dbPassive))

  pair('cache', 'db', vs)
  pair('cache', 'lb', invalid(cacheToLB))
  pair('cache', 'app-server', invalid(cacheToApp))
  pair('cache', 'cache', invalid(cacheToCache))
  pair('cache', 'mq', invalid(cacheToMQ))
  pair('cache', 'worker', invalid(cacheToWorker))

  pair('mq', 'worker', invalid(mqToWorker))
  pair('mq', 'lb', invalid(mqToLB))
  pair('mq', 'app-server', invalid(mqToApp))
  pair('mq', 'db', invalid(mqToDB))
  pair('mq', 'cache', invalid(mqToCache))
  pair('mq', 'mq', invalid(mqToMQ))

  pair('worker', 'db', vs)
  pair('worker', 'cache', vs)
  pair('worker', 'mq', vs)
  pair('worker', 'lb', invalid(workerToLB))
  pair('worker', 'app-server', invalid(workerToApp))
  pair('worker', 'worker', invalid(workerToWorker))

  return m
}

export const CONNECTION_RULES = buildConnectionRules()

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
  return CONNECTION_RULES.get(ruleKey(source, target))
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
