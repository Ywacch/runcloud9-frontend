import type {
  ExportedConnectionRule,
  TopologyRulesResponse,
} from './topologyRulesTypes'
import type { SemanticComponentType } from './topologyRulesTypes'

/**
 * Offline / pre-fetch bootstrap for topology rules.
 * Source of truth is ganymede GET /meta/topology-rules; this mirror is only
 * used until the API payload loads (same pattern as resource profiles).
 */
function buildFallbackConnections(): ExportedConnectionRule[] {
  const out: ExportedConnectionRule[] = []
  const vs = { valid: true, supported: true, explanation: '' }
  const invalid = (explanation: string) => ({
    valid: false,
    supported: false,
    explanation,
  })
  const unsup = (explanation: string) => ({
    valid: true,
    supported: false,
    explanation,
  })

  const dbPassive =
    "Databases are passive stores — they don't initiate connections to other components"
  const lbToDB =
    'Load balancers distribute traffic to application servers, not databases directly'
  const lbToCache =
    'Load balancers route HTTP traffic to compute nodes, not cache stores'
  const lbToMQ = 'Load balancers route HTTP traffic, not message queue connections'
  const lbToWorker =
    'Load balancers route HTTP to app-servers; workers consume from queues'
  const cacheToApp = "Cache nodes don't push data to application servers"
  const cacheToLB = "Cache nodes don't initiate traffic to load balancers"
  const cacheToMQ = "Cache nodes don't publish to message queues"
  const cacheToWorker = "Cache nodes don't push data to workers"
  const cacheToCache = 'Cache-to-cache connections are not supported'
  const mqToApp =
    'Message queues deliver to workers, not back to app-servers (use a separate consumer)'
  const mqToDB = "Message queues don't write directly to databases; use a worker"
  const mqToLB = "Message queues don't route through load balancers"
  const mqToCache = "Message queues don't write to caches directly"
  const mqToWorker =
    'Workers depend on message queues; use worker -> mq (not mq -> worker)'
  const mqToMQ = 'Queue chaining is not supported'
  const workerToApp = "Workers don't call back to app-servers"
  const workerToLB =
    "Workers process jobs from queues, they don't route through load balancers"
  const workerToWorker = 'Worker chaining is not supported'
  const appToLB =
    "App-servers receive traffic from load balancers, they don't push connections to them"
  const appToWorker =
    'App-servers publish to message queues, not directly to workers'

  const pair = (
    source: SemanticComponentType,
    target: SemanticComponentType,
    rule: { valid: boolean; supported: boolean; explanation: string },
  ) => {
    out.push({ source, target, ...rule })
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

  return out
}

export const FALLBACK_TOPOLOGY_RULES: TopologyRulesResponse = {
  componentTypes: ['lb', 'app-server', 'db', 'cache', 'mq', 'worker'],
  connections: buildFallbackConnections(),
  presence: [
    {
      id: 'cache_without_db',
      message:
        'A cache node is present but no database — clarify whether Redis is your primary store or add a database; for now this topology is rejected',
    },
    {
      id: 'worker_without_mq',
      message:
        'Workers consume from message queues — add a message queue to the design',
    },
    {
      id: 'mq_without_worker',
      message: 'Message queue has no consumer — add a worker node',
    },
  ],
  singletons: [
    {
      nodeType: 'app-server',
      message:
        'only one app-server node is supported (found {count}) — scale with replicas on a single app-server instead of placing multiple nodes',
      scaleWithReplicas: true,
    },
    {
      nodeType: 'worker',
      message:
        'only one worker node is supported (found {count}) — scale with replicas on a single worker instead of placing multiple nodes',
      scaleWithReplicas: true,
    },
    {
      nodeType: 'cache',
      message:
        'only one cache node is supported (found {count}) — remove extra cache nodes; the platform provisions a single Redis service',
      scaleWithReplicas: false,
    },
    {
      nodeType: 'db',
      message:
        'only one db node is supported (found {count}) — remove extra database nodes; the platform provisions a single Postgres service',
      scaleWithReplicas: false,
    },
    {
      nodeType: 'mq',
      message:
        'only one mq node is supported (found {count}) — remove extra message queue nodes; the platform provisions a single queue service',
      scaleWithReplicas: false,
    },
  ],
  requiredOutbound: [
    {
      nodeType: 'worker',
      targets: ['db', 'mq'],
      missingDbMessage:
        'worker "{name}" must connect to a db node (add worker -> db edge)',
      missingMqMessage:
        'worker "{name}" must connect to an mq node (add worker -> mq edge)',
      wrongMqDirectionMessage:
        'invalid worker/mq edge direction for worker "{name}": found mq -> worker; use worker -> mq',
    },
  ],
}
