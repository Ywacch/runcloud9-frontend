import type { TopologyFlags } from './componentRole'

export interface JourneyStep {
  component: 'lb' | 'app-server' | 'cache' | 'db' | 'mq' | 'worker'
  title: string
  action: string
  detail?: string
  when?: (t: TopologyFlags) => boolean
  branchLabel?: string
}

export interface JourneySpec {
  id: string
  method: string
  path: string
  label: string
  trafficPercent?: number
  steps: JourneyStep[]
  explanation: string
}

const socialFeedRead: JourneySpec = {
  id: 'social-feed-read',
  method: 'GET',
  path: '/feed/{userId}',
  label: 'Feed reads',
  trafficPercent: 60,
  explanation:
    'In push mode, most reads hit a materialized Redis timeline (sub-ms). Without cache, every read does a multi-table JOIN — the fan-out-on-read cost described in DDIA.',
  steps: [
    {
      component: 'lb',
      title: 'Load balancer',
      action: 'Routes to an app-server instance (e.g. round-robin).',
      when: (t) => t.hasLB,
    },
    {
      component: 'app-server',
      title: 'App server',
      action: 'Serves the feed request and checks Redis for a materialized timeline.',
      when: (t) => t.hasCache,
      detail: 'ZREVRANGE timeline:{userId} 0 19',
    },
    {
      component: 'app-server',
      title: 'App server',
      action: 'Serves the feed read from Postgres (pull mode — no Redis on canvas).',
      when: (t) => !t.hasCache,
      detail: 'JOIN posts × follows × users WHERE follower_id = ?',
    },
    {
      component: 'cache',
      title: 'Redis (sorted set)',
      action: 'Returns recent post IDs for the user timeline when the key is warm.',
      when: (t) => t.hasCache,
      branchLabel: 'If timeline key is cold / empty',
    },
    {
      component: 'db',
      title: 'Postgres fallback',
      action: 'Rebuilds the feed from normalized tables when Redis cannot serve the read.',
      when: (t) => t.hasCache,
      detail: 'JOIN posts × follows × users WHERE follower_id = ?',
    },
  ],
}

const socialFeedPost: JourneySpec = {
  id: 'social-post',
  method: 'POST',
  path: '/post',
  label: 'Create post',
  trafficPercent: 30,
  explanation:
    'Fan-out amplification: each post may expand to thousands of timeline writes. MQ + worker decouple response latency from that work.',
  steps: [
    {
      component: 'lb',
      title: 'Load balancer',
      action: 'Routes the POST to an app-server.',
      when: (t) => t.hasLB,
    },
    {
      component: 'app-server',
      title: 'App server',
      action: 'Validates auth, persists the new row in Postgres.',
      detail: 'INSERT INTO posts …',
    },
    {
      component: 'mq',
      title: 'Message queue',
      action: 'Publishes a job for async fan-out (response can return after enqueue).',
      when: (t) => t.hasMQ,
      detail: 'Async — fan-out continues in the background.',
    },
    {
      component: 'worker',
      title: 'Worker',
      action: 'Consumes fan-out jobs and writes follower timelines.',
      when: (t) => t.hasMQ && t.hasWorker,
      detail: 'ZADD timeline:{followerId} … (batched pipeline)',
    },
    {
      component: 'cache',
      title: 'Redis',
      action: 'Receives timeline writes from the worker.',
      when: (t) => t.hasMQ && t.hasWorker && t.hasCache,
    },
    {
      component: 'app-server',
      title: 'App server (sync fan-out)',
      action:
        'Without MQ, may still enqueue Redis writes inline (goroutine) so HTTP latency stays bounded.',
      when: (t) => !t.hasMQ && t.hasCache,
      detail: 'Fire-and-forget path — still CPU/Redis heavy under load.',
    },
  ],
}

const urlResolve: JourneySpec = {
  id: 'url-resolve-get',
  method: 'GET',
  path: '/r/{code}',
  label: 'Resolve short URL',
  trafficPercent: 80,
  explanation:
    'Classic cache-aside: try Redis for the mapping, fall back to Postgres on miss, then populate cache.',
  steps: [
    {
      component: 'lb',
      title: 'Load balancer',
      action: 'Routes GET /r/{code} to app-server.',
      when: (t) => t.hasLB,
    },
    {
      component: 'app-server',
      title: 'App server',
      action: 'Looks up the short code.',
    },
    {
      component: 'cache',
      title: 'Redis',
      action: 'GET short:{code} — hot path for popular links.',
      when: (t) => t.hasCache,
      branchLabel: 'On miss',
    },
    {
      component: 'db',
      title: 'Postgres',
      action: 'SELECT original URL by code when cache misses.',
      detail: 'SELECT url FROM urls WHERE code = ?',
    },
  ],
}

const urlShorten: JourneySpec = {
  id: 'url-shorten-post',
  method: 'POST',
  path: '/shorten',
  label: 'Create short URL',
  trafficPercent: 20,
  explanation: 'Write path persists the mapping then warms cache for subsequent reads.',
  steps: [
    {
      component: 'lb',
      title: 'Load balancer',
      action: 'Routes POST /shorten.',
      when: (t) => t.hasLB,
    },
    {
      component: 'app-server',
      title: 'App server',
      action: 'Allocates a code, inserts row, returns short URL.',
    },
    {
      component: 'db',
      title: 'Postgres',
      action: 'INSERT mapping (code → original URL).',
    },
    {
      component: 'cache',
      title: 'Redis',
      action: 'SET short:{code} for fast resolves.',
      when: (t) => t.hasCache,
    },
  ],
}

const ecommerceCatalog: JourneySpec = {
  id: 'ecommerce-catalog',
  method: 'GET',
  path: '/catalog',
  label: 'Browse catalog',
  trafficPercent: 40,
  explanation: 'Read-heavy catalog traffic benefits from a warm product cache.',
  steps: [
    {
      component: 'lb',
      title: 'Load balancer',
      action: 'Spreads catalog reads across app-servers.',
      when: (t) => t.hasLB,
    },
    {
      component: 'app-server',
      title: 'App server',
      action: 'Serves catalog listing; prefers cache when present.',
    },
    {
      component: 'cache',
      title: 'Redis',
      action: 'Product / listing fragments on cache hit.',
      when: (t) => t.hasCache,
      branchLabel: 'On miss',
    },
    {
      component: 'db',
      title: 'Postgres',
      action: 'Loads catalog rows when cache cannot satisfy the query.',
    },
  ],
}

const ecommerceProduct: JourneySpec = {
  id: 'ecommerce-product',
  method: 'GET',
  path: '/products/{id}',
  label: 'Product detail',
  trafficPercent: 30,
  explanation: 'Similar to catalog: cache shortens the hot path to Postgres.',
  steps: [
    {
      component: 'lb',
      title: 'Load balancer',
      action: 'Routes product detail traffic.',
      when: (t) => t.hasLB,
    },
    {
      component: 'app-server',
      title: 'App server',
      action: 'Fetches product by id; checks cache first when wired.',
    },
    {
      component: 'cache',
      title: 'Redis',
      action: 'Holds denormalized product payloads when enabled.',
      when: (t) => t.hasCache,
      branchLabel: 'On miss',
    },
    {
      component: 'db',
      title: 'Postgres',
      action: 'Authoritative product + inventory rows.',
    },
  ],
}

const ecommerceCheckout: JourneySpec = {
  id: 'ecommerce-checkout',
  method: 'POST',
  path: '/checkout',
  label: 'Checkout',
  trafficPercent: 30,
  explanation:
    'Checkout ties inventory consistency to the database, then may emit async fulfillment work through MQ.',
  steps: [
    {
      component: 'lb',
      title: 'Load balancer',
      action: 'Routes checkout POSTs.',
      when: (t) => t.hasLB,
    },
    {
      component: 'app-server',
      title: 'App server',
      action: 'Runs checkout orchestration (validate cart, price, payment intent).',
    },
    {
      component: 'db',
      title: 'Postgres',
      action: 'Transactional inventory + order rows.',
      detail: 'UPDATE inventory … INSERT orders …',
    },
    {
      component: 'mq',
      title: 'Message queue',
      action: 'Publishes order.placed (or similar) for downstream fulfillment.',
      when: (t) => t.hasMQ,
    },
    {
      component: 'worker',
      title: 'Worker',
      action: 'Consumes fulfillment jobs (emails, shipping hooks, etc.).',
      when: (t) => t.hasMQ && t.hasWorker,
    },
  ],
}

export function getJourneys(
  templateId: string | null,
  _topology: TopologyFlags
): JourneySpec[] {
  const t = templateId ?? ''
  if (t === 'social-feed' || t === 'social-feed-pull') {
    return [socialFeedRead, socialFeedPost]
  }
  if (t === 'url-shortener') {
    return [urlResolve, urlShorten]
  }
  if (t === 'ecommerce') {
    return [ecommerceCatalog, ecommerceProduct, ecommerceCheckout]
  }
  return []
}

export function filterJourneySteps(
  spec: JourneySpec,
  topology: TopologyFlags
): JourneySpec {
  return {
    ...spec,
    steps: spec.steps.filter((s) => !s.when || s.when(topology)),
  }
}

export function journeyById(
  templateId: string | null,
  id: string,
  topology: TopologyFlags
): JourneySpec | null {
  const j = getJourneys(templateId, topology).find((x) => x.id === id)
  return j ? filterJourneySteps(j, topology) : null
}

export function kpiRowToJourneyId(
  templateId: string | null | undefined,
  row: { id: string; label: string }
): string | null {
  const t = templateId ?? ''
  const labelL = row.label.toLowerCase()
  if (t === 'social-feed' || t === 'social-feed-pull') {
    if (
      row.id === 'posts' ||
      row.id.startsWith('tm-posts') ||
      labelL.includes('post')
    ) {
      return 'social-post'
    }
    return 'social-feed-read'
  }
  if (t === 'url-shortener') {
    if (row.id === 'urls-shortened' || labelL.includes('shorten')) {
      return 'url-shorten-post'
    }
    return 'url-resolve-get'
  }
  if (t === 'ecommerce') {
    if (
      row.id === 'orders' ||
      row.id.includes('checkout') ||
      labelL.includes('checkout') ||
      labelL.includes('order')
    ) {
      return 'ecommerce-checkout'
    }
    if (labelL.includes('catalog')) return 'ecommerce-catalog'
    if (labelL.includes('product')) return 'ecommerce-product'
    return 'ecommerce-catalog'
  }
  return null
}

const COMPONENT_TITLE: Record<JourneyStep['component'], string> = {
  lb: 'Load balancer',
  'app-server': 'App server',
  cache: 'Redis',
  db: 'Postgres',
  mq: 'Message queue',
  worker: 'Worker',
}

export function journeyStepHeading(step: JourneyStep, index: number): string {
  const prefix = String(index + 1)
  const comp = COMPONENT_TITLE[step.component]
  return `${prefix}. ${comp}${step.branchLabel ? ` (${step.branchLabel})` : ''}`
}
