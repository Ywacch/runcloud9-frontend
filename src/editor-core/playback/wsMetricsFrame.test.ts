import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseRecentLatenciesMs, parseResourceUsageSource } from '../domain/metricsUiContract'
import {
  applyWsFrameToStore,
  componentToBucket,
  normalizeWsEvents,
  nodeBucketsFromPayload,
} from './wsMetricsFrame'
import type { WsDeploymentMetrics, WsEventPayload } from './wsMetricsTypes'
import { useCanvasStore } from '../stores/canvasStore'
import { useMetricsStore } from '../stores/metricsStore'

describe('parseResourceUsageSource', () => {
  it('accepts known backend source values', () => {
    expect(parseResourceUsageSource('metrics_api')).toBe('metrics_api')
    expect(parseResourceUsageSource('cadvisor')).toBe('cadvisor')
    expect(parseResourceUsageSource('requests')).toBe('requests')
    expect(parseResourceUsageSource('bad')).toBeUndefined()
  })
})

describe('componentToBucket latency units', () => {
  it('converts p50 and p95 from seconds to milliseconds like p99', () => {
    const bucket = componentToBucket({
      p50Latency: 0.001,
      p95Latency: 0.003,
      p99Latency: 0.05,
    })
    expect(bucket.p50Latency).toBe(1)
    expect(bucket.p95Latency).toBe(3)
    expect(bucket.p99Latency).toBe(50)
  })
})

describe('componentToBucket resource sources', () => {
  it('maps cpuSource and memSource onto the bucket', () => {
    const bucket = componentToBucket({
      cpuSource: 'metrics_api',
      memSource: 'metrics_api',
      cpuLimit: 0.5,
      memoryLimit: 512 * 1024 * 1024,
      cpuUsage: 0.2,
      memoryBytes: 256 * 1024 * 1024,
    })
    expect(bucket.cpuSource).toBe('metrics_api')
    expect(bucket.memSource).toBe('metrics_api')
  })

  it('keeps sub-1% cpu instead of rounding idle millicores to 0', () => {
    const bucket = componentToBucket({
      cpuUsage: 0.015,
      cpuLimit: 2,
      memoryBytes: 80 * 1024 * 1024,
      memoryLimit: 2 * 1024 * 1024 * 1024,
    })
    expect(bucket.cpuPercent).toBe(0.8)
    expect(bucket.memPercent).toBeGreaterThan(0)
  })

  it('maps cache layers from WS component payload', () => {
    const bucket = componentToBucket({
      cacheMetricMode: 'layered',
      layers: [
        {
          id: 'redis-internal',
          role: 'backing-store',
          engine: 'redis',
          cpuUsage: 0.12,
          memoryUsage: 134217728,
          cpuLimit: 0.5,
          memoryLimit: 536870912,
          redisOpsPerSec: 21000,
          evictionsPerSec: 2.5,
          expirationsPerSec: 0.75,
          restartCount: 5,
        },
        {
          id: 'cache-proxy',
          role: 'sidecar',
          engine: 'caching-proxy',
          cpuUsage: 0.05,
          memoryUsage: 67108864,
          restartCount: 1,
        },
      ],
    })
    expect(bucket.layers).toHaveLength(2)
    expect(bucket.layers[0].id).toBe('redis-internal')
    expect(bucket.layers[1].id).toBe('cache-proxy')
    expect(bucket.layers[0].redisOpsPerSec).toBe(21000)
    expect(bucket.layers[0].evictionsPerSec).toBe(2.5)
    expect(bucket.layers[0].expirationsPerSec).toBe(0.75)
    // Proxy layer must not inherit backing-store lifecycle rates.
    expect(bucket.layers[1].evictionsPerSec).toBeUndefined()
    expect(bucket.layers[1].expirationsPerSec).toBeUndefined()
  })

  it('maps db replica layers with replicationLagSeconds from WS payload', () => {
    const bucket = componentToBucket({
      component: 'db',
      backendReplicas: { desired: 1, ready: 1 },
      layers: [
        {
          id: 'postgres',
          role: 'primary',
          engine: 'postgresql',
          cpuUsage: 0.1,
          memoryUsage: 134217728,
        },
        {
          id: 'postgres-replica-abc',
          role: 'replica',
          engine: 'postgresql',
          cpuUsage: 0.03,
          memoryUsage: 67108864,
          replicationLagSeconds: 0.42,
        },
      ],
    })
    expect(bucket.backendReplicas).toEqual({ desired: 1, ready: 1 })
    expect(bucket.layers).toHaveLength(2)
    expect(bucket.layers[1].replicationLagSeconds).toBe(0.42)
  })

  it('maps db consistency status from WS payload', () => {
    const bucket = componentToBucket({
      component: 'db',
      consistency: {
        rywViolations: 1,
        monotonicViolations: 0,
        cacheDbStale: 0,
        replicaStalenessVersions: 2,
      },
    })
    expect(bucket.consistency).toEqual({
      leaderReads: 0,
      replicaReads: 0,
      replicaStaleReads: 0,
      guaranteeHeldBy: undefined,
      rywViolations: 1,
      monotonicViolations: 0,
      cacheDbStale: 0,
      replicaStalenessVersions: 2,
      lastProbeError: undefined,
    })
  })

  it('maps component-level cache store lifecycle rates onto the bucket', () => {
    const bucket = componentToBucket({
      component: 'cache',
      evictionsPerSec: 2.5,
      expirationsPerSec: 0.75,
    })
    expect(bucket.evictionsPerSec).toBe(2.5)
    expect(bucket.expirationsPerSec).toBe(0.75)

    const empty = componentToBucket({ component: 'cache' })
    expect(empty.evictionsPerSec).toBe(0)
    expect(empty.expirationsPerSec).toBe(0)
  })

  it('parses scale on the bucket when desired is positive', () => {
    const bucket = componentToBucket({
      component: 'app-server',
      scale: { desired: 2, ready: 1 },
    })
    expect(bucket.scale).toEqual({ desired: 2, ready: 1 })
    expect(componentToBucket({ component: 'app-server' }).scale).toBeNull()
  })

  it('maps component freshness onto the bucket and cache layers', () => {
    const bucket = componentToBucket({
      component: 'db',
      cpuSource: 'metrics_api',
      freshness: {
        throughput: { tier: 'rate', nominalLagSeconds: 15, source: 'prometheus_rate' },
        containerCpu: {
          tier: 'metrics_api',
          nominalLagSeconds: 45,
          source: 'metrics_api',
        },
        containerMem: {
          tier: 'metrics_api',
          nominalLagSeconds: 45,
          source: 'metrics_api',
        },
        connections: { tier: 'rate', nominalLagSeconds: 15 },
      },
      layers: [
        {
          id: 'redis-internal',
          role: 'backing-store',
          engine: 'redis',
          cpuUsage: 0.1,
          memoryUsage: 100,
          freshness: {
            containerCpu: {
              tier: 'estimated',
              nominalLagSeconds: 0,
              source: 'kube_requests',
            },
            containerMem: {
              tier: 'estimated',
              nominalLagSeconds: 0,
              source: 'kube_requests',
            },
          },
        },
      ],
    })
    expect(bucket.freshness?.containerCpu?.tier).toBe('metrics_api')
    expect(bucket.freshness?.connections?.tier).toBe('rate')
    expect(bucket.layers[0].freshness?.containerCpu?.tier).toBe('estimated')
  })

  it('leaves freshness undefined when absent', () => {
    const bucket = componentToBucket({ component: 'db' })
    expect(bucket.freshness).toBeUndefined()
  })
})

describe('parseRecentLatenciesMs', () => {
  it('returns finite non-negative numbers in order', () => {
    expect(parseRecentLatenciesMs([12.5, '45.2', -1, NaN, 38])).toEqual([
      12.5, 45.2, 38,
    ])
  })

  it('returns empty array for non-array input', () => {
    expect(parseRecentLatenciesMs(null)).toEqual([])
  })
})

describe('normalizeWsEvents workload anchors', () => {
  it('retains all workload kinds, detail, and visibility while type stays action', () => {
    const events = normalizeWsEvents([
      {
        timestamp: '2026-05-01T12:00:00Z',
        type: 'action',
        source: 'loadgen',
        kind: 'loadgen_start',
        visibility: 'all',
        title: 'Load generator started',
        description: 'rps=5',
        detail: { template: 'url-shortener', rps: '5', durationSeconds: '30' },
      },
      {
        timestamp: '2026-05-01T12:00:30Z',
        type: 'action',
        source: 'loadgen',
        kind: 'loadgen_stop',
        audience: 'user',
        title: 'Load generator stopped',
        detail: { template: 'url-shortener' },
      },
      {
        timestamp: '2026-05-01T12:00:15Z',
        type: 'action',
        source: 'chaos',
        kind: 'chaos_inject',
        visibility: 'operator',
        title: 'Chaos injected',
        detail: { scenario: 'pod_kill', targetComponent: 'app-server' },
      },
    ])

    expect(events.map((event) => event.kind)).toEqual([
      'loadgen_start',
      'loadgen_stop',
      'chaos_inject',
    ])
    expect(events[0]).toMatchObject({
      type: 'action',
      visibility: 'all',
      detail: { template: 'url-shortener', rps: '5', durationSeconds: '30' },
    })
    expect(events[1]).toMatchObject({
      visibility: 'student',
    })
    expect(events[2]).toMatchObject({
      visibility: 'operator',
      detail: { scenario: 'pod_kill', targetComponent: 'app-server' },
    })
  })

  it('keeps vu_gap_warning workload kind', () => {
    const [event] = normalizeWsEvents([
      {
        timestamp: '2026-05-01T12:00:10Z',
        type: 'workload',
        source: 'loadgen',
        kind: 'vu_gap_warning',
        title: 'Reply gap warning',
        description: 'gap too wide',
      },
    ])
    expect(event.kind).toBe('vu_gap_warning')
  })

  it('keeps kind standby_reclone from chaos follow-up events', () => {
    const [event] = normalizeWsEvents([
      {
        timestamp: '2026-05-01T12:02:00Z',
        type: 'action',
        source: 'chaos',
        kind: 'standby_reclone',
        visibility: 'all',
        component: 'db',
        title: 'Standby rebuilt after timeline fork',
        description: 'standby_reclone',
        detail: {
          status: 'recloned',
          promotedPod: 'postgres-replica-0',
          reclonedPods: 'postgres-replica-1',
        },
      },
    ])

    expect(event.kind).toBe('standby_reclone')
    expect(event.description).toBe('standby_reclone')
    expect(event.visibility).toBe('all')
  })

  it('keeps kind scale with detail', () => {
    const [event] = normalizeWsEvents([
      {
        timestamp: '2026-05-01T12:00:05Z',
        type: 'action',
        source: 'autoscaler',
        kind: 'scale',
        component: 'app-server',
        title: 'App servers scaled',
        description: 'CPU autoscaling uses metrics-server samples from about 60 seconds ago.',
        detail: { from: '1', to: '2', reason: 'cpu', fidelity: 'real' },
      },
    ])
    expect(event.kind).toBe('scale')
    expect(event.detail).toEqual({
      from: '1',
      to: '2',
      reason: 'cpu',
      fidelity: 'real',
    })
  })

  it('keeps a legacy runtime action unchanged when kind is missing', () => {
    const [event] = normalizeWsEvents([
      {
        timestamp: '2026-05-01T12:01:00Z',
        type: 'action',
        source: 'runtime',
        component: 'app-server',
        title: 'Pod restarted',
        description: 'app-server-abc restarted',
        // Additive unknown fields from future backends must not reject the event.
        futureField: 'ignored',
      } as WsEventPayload,
    ])

    expect(event).toMatchObject({
      type: 'action',
      source: 'runtime',
      component: 'app-server',
      title: 'Pod restarted',
      description: 'app-server-abc restarted',
    })
    expect(event.kind).toBeUndefined()
    expect(event.detail).toBeUndefined()
    expect(event.visibility).toBeUndefined()
  })
})

describe('applyWsFrameToStore loadgen latencies', () => {
  beforeEach(() => {
    useMetricsStore.setState({ loadgen: null })
  })

  it('stores recentLatenciesMs from WS loadgen payload', () => {
    applyWsFrameToStore(
      {
        loadgen: {
          active: true,
          targetRps: 50,
          actualRps: 48,
          recentLatenciesMs: [10, 20, 30],
        },
      },
      { appendCharts: false, pushEvents: false },
    )
    expect(useMetricsStore.getState().loadgen?.recentLatenciesMs).toEqual([
      10, 20, 30,
    ])
  })

  it('stores schedule phase fields from WS loadgen payload', () => {
    applyWsFrameToStore(
      {
        loadgen: {
          active: true,
          targetRps: 40,
          currentPhase: 'baseline',
          phaseIndex: 0,
          scheduleId: 'world_cup_goal',
        },
      },
      { appendCharts: false, pushEvents: false },
    )
    const lg = useMetricsStore.getState().loadgen
    expect(lg?.currentPhase).toBe('baseline')
    expect(lg?.phaseIndex).toBe(0)
    expect(lg?.scheduleId).toBe('world_cup_goal')
  })

  it('stores identityCount and identitiesSeen when present', () => {
    applyWsFrameToStore(
      {
        loadgen: {
          active: true,
          targetRps: 220,
          actualRps: 220,
          identityCount: 60,
          identitiesSeen: 42,
        },
      },
      { appendCharts: false, pushEvents: false },
    )
    const lg = useMetricsStore.getState().loadgen
    expect(lg?.identityCount).toBe(60)
    expect(lg?.identitiesSeen).toBe(42)
  })

  it('leaves identity fields undefined when omitted', () => {
    applyWsFrameToStore(
      {
        loadgen: {
          active: true,
          targetRps: 50,
          actualRps: 50,
        },
      },
      { appendCharts: false, pushEvents: false },
    )
    const lg = useMetricsStore.getState().loadgen
    expect(lg?.identityCount).toBeUndefined()
    expect(lg?.identitiesSeen).toBeUndefined()
  })

  it('stores distribution from WS loadgen payload', () => {
    applyWsFrameToStore(
      {
        loadgen: {
          active: true,
          targetRps: 40,
          distribution: {
            'GET /feed/{userId}': 60,
            'POST /post': 30,
          },
        },
      },
      { appendCharts: false, pushEvents: false },
    )
    expect(useMetricsStore.getState().loadgen?.distribution).toEqual({
      'GET /feed/{userId}': 60,
      'POST /post': 30,
    })
  })

  it('stores scaleLagErrors from WS loadgen payload', () => {
    applyWsFrameToStore(
      {
        loadgen: {
          active: true,
          targetRps: 40,
          scaleLagErrors: 3,
        },
      },
      { appendCharts: false, pushEvents: false },
    )
    expect(useMetricsStore.getState().loadgen?.scaleLagErrors).toBe(3)
  })

  it('keeps loadgen active when stale frame reports inactive after a live run', () => {
    useMetricsStore.setState({
      loadgen: {
        active: true,
        targetRps: 50,
        currentRps: 50,
        actualRps: 48,
        intervalActualRps: 48,
        intervalP99Ms: 12,
        recentIntervals: [],
        recentLatenciesMs: [],
        totalRequests: 100,
        successRate: 1,
        durationSeconds: 0,
        elapsedSeconds: 10,
        statusCodes: {},
      },
    })
    applyWsFrameToStore(
      {
        loadgen: {
          active: false,
          stale: true,
          targetRps: 50,
          actualRps: 48,
        },
      },
      { appendCharts: false, pushEvents: false },
    )
    const lg = useMetricsStore.getState().loadgen
    expect(lg?.active).toBe(true)
    expect(lg?.stale).toBe(true)
    expect(lg?.actualRps).toBe(48)
  })

  it('trusts inactive loadgen when stale is false', () => {
    useMetricsStore.setState({
      loadgen: {
        active: true,
        targetRps: 50,
        currentRps: 50,
        actualRps: 48,
        intervalActualRps: 48,
        intervalP99Ms: 12,
        recentIntervals: [],
        recentLatenciesMs: [],
        totalRequests: 100,
        successRate: 1,
        durationSeconds: 0,
        elapsedSeconds: 10,
        statusCodes: {},
      },
    })
    applyWsFrameToStore(
      {
        loadgen: {
          active: false,
          stale: false,
          targetRps: 0,
          actualRps: 0,
        },
      },
      { appendCharts: false, pushEvents: false },
    )
    expect(useMetricsStore.getState().loadgen?.active).toBe(false)
  })
})

describe('applyWsFrameToStore batching', () => {
  beforeEach(() => {
    useMetricsStore.setState({ metrics: {}, history: {} })
    useCanvasStore.setState({
      nodes: {
        'n-app': {
          id: 'n-app',
          type: 'compute',
          position: [0, 0, 0],
          label: 'App Server',
          config: {},
          status: 'healthy',
        },
        'n-db': {
          id: 'n-db',
          type: 'database',
          position: [1, 0, 0],
          label: 'Database',
          config: {},
          status: 'healthy',
        },
      },
    })
  })

  it('applies component metrics and statuses in one store write each', () => {
    const metricsSpy = vi.fn()
    const canvasSpy = vi.fn()
    const unsubMetrics = useMetricsStore.subscribe(metricsSpy)
    const unsubCanvas = useCanvasStore.subscribe(canvasSpy)
    applyWsFrameToStore(
      {
        timestamp: new Date().toISOString(),
        components: {
          'app-server': { requestRate: 10, errorRate: 0.5 },
          db: { dbQueryRate: 5 },
        },
      },
      { appendCharts: false, pushEvents: false },
    )
    unsubMetrics()
    unsubCanvas()
    expect(metricsSpy).toHaveBeenCalledTimes(2)
    expect(canvasSpy).toHaveBeenCalledTimes(1)
    expect(useMetricsStore.getState().metrics['n-app']?.requestRate).toBe(10)
    expect(useMetricsStore.getState().metrics['n-db']?.dbQueryRate).toBe(5)
    expect(useCanvasStore.getState().nodes['n-app'].status).toBe('degraded')
  })
})

describe('applyWsFrameToStore phenomena', () => {
  beforeEach(() => {
    useMetricsStore.setState({ phenomena: [], ledgerNamespace: null })
  })

  it('parses phenomena and tolerates absence', () => {
    applyWsFrameToStore(
      {
        namespace: 'ns-lab',
        phenomena: [
          {
            phenomenon: 'reply_before_parent',
            fidelity: 'simulated',
            cost: { readsAffected: 3 },
            baseRate: { perThousand: 30, denominator: 'all thread reads', reads: 100 },
            sources: ['app'],
          },
        ],
      },
      { appendCharts: false, pushEvents: false },
    )
    expect(useMetricsStore.getState().phenomena).toHaveLength(1)
    expect(useMetricsStore.getState().phenomena[0].cost.readsAffected).toBe(3)
    expect(useMetricsStore.getState().ledgerNamespace).toBe('ns-lab')

    applyWsFrameToStore({}, { appendCharts: false, pushEvents: false })
    expect(useMetricsStore.getState().phenomena).toHaveLength(0)
  })
})

describe('applyWsFrameToStore phenomena', () => {
  beforeEach(() => {
    useMetricsStore.setState({ phenomena: [], ledgerNamespace: null })
  })

  it('parses phenomena and tolerates absence', () => {
    applyWsFrameToStore(
      {
        namespace: 'ns-lab',
        phenomena: [
          {
            phenomenon: 'reply_before_parent',
            fidelity: 'simulated',
            cost: { readsAffected: 3 },
            baseRate: { perThousand: 30, denominator: 'all thread reads', reads: 100 },
            sources: ['app'],
          },
        ],
      },
      { appendCharts: false, pushEvents: false },
    )
    expect(useMetricsStore.getState().phenomena).toHaveLength(1)
    expect(useMetricsStore.getState().phenomena[0].cost.readsAffected).toBe(3)
    expect(useMetricsStore.getState().ledgerNamespace).toBe('ns-lab')

    applyWsFrameToStore({}, { appendCharts: false, pushEvents: false })
    expect(useMetricsStore.getState().phenomena).toHaveLength(0)
  })
})

describe('applyWsFrameToStore chart history', () => {
  beforeEach(() => {
    useMetricsStore.setState({ metrics: {}, history: {} })
    useCanvasStore.setState({
      nodes: {
        'n-app': {
          id: 'n-app',
          type: 'compute',
          position: [0, 0, 0],
          label: 'App Server',
          config: {},
          status: 'healthy',
        },
      },
    })
  })

  it('appends history when appendCharts is true', () => {
    const frame = (rate: number): WsDeploymentMetrics => ({
      timestamp: new Date().toISOString(),
      components: { 'app-server': { requestRate: rate } },
    })

    applyWsFrameToStore(frame(10), { appendCharts: true, pushEvents: false })
    applyWsFrameToStore(frame(20), { appendCharts: true, pushEvents: false })

    const history = useMetricsStore.getState().history['n-app'] ?? []
    expect(history.length).toBe(2)
    expect(history[0]?.requestRate).toBe(10)
    expect(history[1]?.requestRate).toBe(20)
  })

  it('does not append history when appendCharts is false', () => {
    applyWsFrameToStore(
      {
        timestamp: new Date().toISOString(),
        components: { 'app-server': { requestRate: 10 } },
      },
      { appendCharts: false, pushEvents: false },
    )
    expect(useMetricsStore.getState().history['n-app']).toBeUndefined()
    expect(useMetricsStore.getState().metrics['n-app']?.requestRate).toBe(10)
  })
})

describe('nodeBucketsFromPayload worker replicas', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: {
        'n-worker': {
          id: 'n-worker',
          type: 'worker',
          position: [0, 0, 0],
          label: 'Worker',
          config: {},
          status: 'healthy',
        },
      },
    })
  })

  it('maps worker replicas into podReplicas on the worker bucket', () => {
    const buckets = nodeBucketsFromPayload(
      {
        components: {
          worker: {
            requestRate: 8,
            replicas: [
              {
                name: 'worker-roll-a',
                ready: true,
                requestRate: 3,
                p99Latency: 0.04,
                totalRequests: 100,
              },
              {
                name: 'worker-roll-b',
                ready: true,
                requestRate: 5,
                p99Latency: 0.05,
                totalRequests: 120,
              },
            ],
          },
        },
      },
      useCanvasStore.getState().nodes,
    )
    const bucket = buckets['n-worker']
    expect(bucket?.podReplicas).toHaveLength(2)
    expect(bucket?.podReplicas[0]?.name).toBe('worker-roll-a')
    expect(bucket?.requestRate).toBe(8)
  })
})
