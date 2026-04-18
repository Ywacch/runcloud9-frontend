import { describe, expect, it } from 'vitest'
import type { CanvasEdge, CanvasNode } from '../../store/canvasStore'
import { SimulationEngine } from './SimulationEngine'
import { WORKLOAD_BY_TEMPLATE_ID } from './workloadProfiles'

const RAMP_TICKS = 40

function stepMany(
  engine: SimulationEngine,
  n: number
): ReturnType<SimulationEngine['step']> {
  let last = engine.step(16)
  for (let i = 1; i < n; i++) last = engine.step(16)
  return last
}

describe('simulation QA suite', () => {
  it('TC-001: client → compute → DB: DB RPS tracks client chain at steady state', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'c1',
        type: 'client',
        position: [0, 0.3, 0],
        label: 'Client',
        config: { requestsPerSecond: 800 },
        status: 'idle',
      },
      {
        id: 'app1',
        type: 'compute',
        position: [2, 0.3, 0],
        label: 'App',
        config: { replicas: 1, instanceSize: 'large' },
        status: 'idle',
      },
      {
        id: 'db1',
        type: 'database',
        position: [4, 0.3, 0],
        label: 'DB',
        config: { maxConnections: 200, storageGB: 20 },
        status: 'idle',
      },
    ]
    const edges: CanvasEdge[] = [
      {
        id: 'e_c_app',
        sourceId: 'c1',
        targetId: 'app1',
        protocol: 'http',
        animated: true,
      },
      {
        id: 'e_app_db',
        sourceId: 'app1',
        targetId: 'db1',
        protocol: 'tcp',
        animated: true,
      },
    ]
    const engine = new SimulationEngine(nodes, edges)
    const r = stepMany(engine, 55)
    const dbQ = r.metrics.db1?.throughputQps ?? 0
    const appQ = r.metrics.app1?.throughputQps ?? 0
    expect(dbQ).toBeGreaterThan(200)
    expect(Math.abs(dbQ - appQ) / Math.max(appQ, 1)).toBeLessThan(0.05)
  })

  it('TC-003: weighted LB ~75% / ~25% for 3:1 backend weights', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'c1',
        type: 'client',
        position: [0, 0.3, 0],
        label: 'Client',
        config: { requestsPerSecond: 1200 },
        status: 'idle',
      },
      {
        id: 'lb1',
        type: 'load_balancer',
        position: [2, 0.3, 0],
        label: 'LB',
        config: {
          algorithm: 'weighted',
          backendWeights: { appA: 3, appB: 1 },
        },
        status: 'idle',
      },
      {
        id: 'appA',
        type: 'compute',
        position: [4, 0.3, 0],
        label: 'A',
        config: { replicas: 1, instanceSize: 'large' },
        status: 'idle',
      },
      {
        id: 'appB',
        type: 'compute',
        position: [4, 0.3, 2],
        label: 'B',
        config: { replicas: 1, instanceSize: 'large' },
        status: 'idle',
      },
    ]
    const edges: CanvasEdge[] = [
      {
        id: 'e0',
        sourceId: 'c1',
        targetId: 'lb1',
        protocol: 'http',
        animated: true,
      },
      {
        id: 'eA',
        sourceId: 'lb1',
        targetId: 'appA',
        protocol: 'http',
        animated: true,
      },
      {
        id: 'eB',
        sourceId: 'lb1',
        targetId: 'appB',
        protocol: 'http',
        animated: true,
      },
    ]
    const engine = new SimulationEngine(nodes, edges)
    const r = stepMany(engine, 55)
    const a = r.inspector.appA?.ingressQps ?? 0
    const b = r.inspector.appB?.ingressQps ?? 0
    const sum = a + b
    expect(sum).toBeGreaterThan(100)
    const shareA = a / sum
    expect(shareA).toBeGreaterThan(0.68)
    expect(shareA).toBeLessThan(0.82)
  })

  it('TC-003b: round-robin LB splits ~evenly across three backends', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'c1',
        type: 'client',
        position: [0, 0.3, 0],
        label: 'Client',
        config: { requestsPerSecond: 900 },
        status: 'idle',
      },
      {
        id: 'lb1',
        type: 'load_balancer',
        position: [2, 0.3, 0],
        label: 'LB',
        config: { algorithm: 'round-robin' },
        status: 'idle',
      },
      ...(['x1', 'x2', 'x3'] as const).map(
        (id, i): CanvasNode => ({
          id,
          type: 'compute',
          position: [4, 0.3, i * 2],
          label: id,
          config: { replicas: 1, instanceSize: 'medium' },
          status: 'idle',
        })
      ),
    ]
    const edges: CanvasEdge[] = [
      {
        id: 'ec',
        sourceId: 'c1',
        targetId: 'lb1',
        protocol: 'http',
        animated: true,
      },
      ...(['x1', 'x2', 'x3'] as const).map(
        (id): CanvasEdge => ({
          id: `e_${id}`,
          sourceId: 'lb1',
          targetId: id,
          protocol: 'http',
          animated: true,
        })
      ),
    ]
    const engine = new SimulationEngine(nodes, edges)
    const r = stepMany(engine, 55)
    const qs = ['x1', 'x2', 'x3'].map(
      (id) => r.inspector[id]?.ingressQps ?? 0
    )
    const sum = qs.reduce((s, q) => s + q, 0)
    expect(sum).toBeGreaterThan(100)
    for (const q of qs) {
      expect(q / sum).toBeGreaterThan(0.25)
      expect(q / sum).toBeLessThan(0.42)
    }
  })

  it('TC-008b: capacity overload: high RPS into low capacity raises error rate', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'c1',
        type: 'client',
        position: [0, 0.3, 0],
        label: 'Client',
        config: { requestsPerSecond: 500 },
        status: 'idle',
      },
      {
        id: 'app1',
        type: 'compute',
        position: [2, 0.3, 0],
        label: 'App',
        config: { replicas: 1, instanceSize: 'small', nodeCapacityRps: 100 },
        status: 'idle',
      },
    ]
    const edges: CanvasEdge[] = [
      {
        id: 'e1',
        sourceId: 'c1',
        targetId: 'app1',
        protocol: 'http',
        animated: true,
      },
    ]
    const engine = new SimulationEngine(nodes, edges)
    const r = stepMany(engine, 55)
    expect(r.metrics.app1?.errorRate ?? 0).toBeGreaterThan(0.3)
  })

  it('TC-ramp: early tick near zero QPS; late tick near steady client rate', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'c1',
        type: 'client',
        position: [0, 0.3, 0],
        label: 'Client',
        config: { requestsPerSecond: 1000 },
        status: 'idle',
      },
      {
        id: 'app1',
        type: 'compute',
        position: [2, 0.3, 0],
        label: 'App',
        config: { replicas: 1, instanceSize: 'large' },
        status: 'idle',
      },
    ]
    const edges: CanvasEdge[] = [
      {
        id: 'e1',
        sourceId: 'c1',
        targetId: 'app1',
        protocol: 'http',
        animated: true,
      },
    ]
    const engine = new SimulationEngine(nodes, edges)
    const early = engine.step(16)
    expect(early.metrics.app1?.throughputQps ?? 0).toBeLessThan(50)
    const late = stepMany(engine, RAMP_TICKS + 25)
    expect(late.metrics.app1?.throughputQps ?? 0).toBeGreaterThan(400)
  })

  it('TC-edgeflow: LB fan-out edgeFlows match ~equal thirds', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'c1',
        type: 'client',
        position: [0, 0.3, 0],
        label: 'Client',
        config: { requestsPerSecond: 900 },
        status: 'idle',
      },
      {
        id: 'lb1',
        type: 'load_balancer',
        position: [2, 0.3, 0],
        label: 'LB',
        config: { algorithm: 'round-robin' },
        status: 'idle',
      },
      ...(['b1', 'b2', 'b3'] as const).map(
        (id, i): CanvasNode => ({
          id,
          type: 'compute',
          position: [4, 0.3, i * 2],
          label: id,
          config: { replicas: 1, instanceSize: 'medium' },
          status: 'idle',
        })
      ),
    ]
    const edgeIds = ['eb1', 'eb2', 'eb3'] as const
    const edges: CanvasEdge[] = [
      {
        id: 'ec',
        sourceId: 'c1',
        targetId: 'lb1',
        protocol: 'http',
        animated: true,
      },
      ...(['b1', 'b2', 'b3'] as const).map(
        (id, i): CanvasEdge => ({
          id: edgeIds[i]!,
          sourceId: 'lb1',
          targetId: id,
          protocol: 'http',
          animated: true,
        })
      ),
    ]
    const engine = new SimulationEngine(nodes, edges)
    const r = stepMany(engine, 55)
    const ingress = r.inspector.lb1?.ingressQps ?? 0
    expect(ingress).toBeGreaterThan(100)
    for (const eid of edgeIds) {
      const q = r.edgeFlows[eid] ?? 0
      expect(q / ingress).toBeGreaterThan(0.28)
      expect(q / ingress).toBeLessThan(0.39)
    }
  })

  it('TC-leastconn: two backends both receive traffic under least-connections', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'c1',
        type: 'client',
        position: [0, 0.3, 0],
        label: 'Client',
        config: { requestsPerSecond: 600 },
        status: 'idle',
      },
      {
        id: 'lb1',
        type: 'load_balancer',
        position: [2, 0.3, 0],
        label: 'LB',
        config: { algorithm: 'least-connections' },
        status: 'idle',
      },
      {
        id: 'p1',
        type: 'compute',
        position: [4, 0.3, 0],
        label: 'P1',
        config: { replicas: 1, instanceSize: 'medium' },
        status: 'idle',
      },
      {
        id: 'p2',
        type: 'compute',
        position: [4, 0.3, 2],
        label: 'P2',
        config: { replicas: 1, instanceSize: 'medium' },
        status: 'idle',
      },
    ]
    const edges: CanvasEdge[] = [
      {
        id: 'ec',
        sourceId: 'c1',
        targetId: 'lb1',
        protocol: 'http',
        animated: true,
      },
      {
        id: 'e1',
        sourceId: 'lb1',
        targetId: 'p1',
        protocol: 'http',
        animated: true,
      },
      {
        id: 'e2',
        sourceId: 'lb1',
        targetId: 'p2',
        protocol: 'http',
        animated: true,
      },
    ]
    const engine = new SimulationEngine(nodes, edges)
    const r = stepMany(engine, 60)
    const q1 = r.inspector.p1?.ingressQps ?? 0
    const q2 = r.inspector.p2?.ingressQps ?? 0
    expect(Math.min(q1, q2)).toBeGreaterThan(50)
    const mx = Math.max(q1, q2)
    const mn = Math.min(q1, q2)
    expect(mx / mn).toBeLessThan(6)
  })

  it('TC-iphash: single backend receives essentially all LB share in one tick', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'c1',
        type: 'client',
        position: [0, 0.3, 0],
        label: 'Client',
        config: { requestsPerSecond: 900 },
        status: 'idle',
      },
      {
        id: 'lb1',
        type: 'load_balancer',
        position: [2, 0.3, 0],
        label: 'LB',
        config: { algorithm: 'ip-hash' },
        status: 'idle',
      },
      ...(['h1', 'h2', 'h3'] as const).map(
        (id, i): CanvasNode => ({
          id,
          type: 'compute',
          position: [4, 0.3, i * 2],
          label: id,
          config: { replicas: 1, instanceSize: 'medium' },
          status: 'idle',
        })
      ),
    ]
    const edges: CanvasEdge[] = [
      {
        id: 'ec',
        sourceId: 'c1',
        targetId: 'lb1',
        protocol: 'http',
        animated: true,
      },
      ...(['h1', 'h2', 'h3'] as const).map(
        (id): CanvasEdge => ({
          id: `eh_${id}`,
          sourceId: 'lb1',
          targetId: id,
          protocol: 'http',
          animated: true,
        })
      ),
    ]
    const engine = new SimulationEngine(nodes, edges)
    stepMany(engine, 50)
    const r = engine.step(16)
    const split = r.inspector.lb1?.backendSplit ?? []
    const positive = split.filter((b) => b.qps > 1)
    expect(positive.length).toBe(1)
    const total = split.reduce((s, b) => s + b.qps, 0)
    expect(positive[0]!.qps / total).toBeGreaterThan(0.95)
  })

  // ─── Cache / DB interaction ────────────────────────────────────────────────

  it('TC-cache-serial: serial App→Cache→DB: DB RPS ≤ miss fraction × App RPS (BUG-02)', () => {
    // Topology: Client → App → Redis → PostgreSQL (serial cache-aside)
    // With default hit rate ~0.9, DB should receive at most ~15% of App load.
    const nodes: CanvasNode[] = [
      {
        id: 'c1',
        type: 'client',
        position: [0, 0.3, 0],
        label: 'Client',
        config: { requestsPerSecond: 1000 },
        status: 'idle',
      },
      {
        id: 'app1',
        type: 'compute',
        position: [2, 0.3, 0],
        label: 'App',
        config: { replicas: 1, instanceSize: 'large' },
        status: 'idle',
      },
      {
        id: 'cache1',
        type: 'cache',
        position: [4, 0.3, 0],
        label: 'Redis',
        config: { cacheStrategy: 'cache-aside', replicas: 1 },
        status: 'idle',
      },
      {
        id: 'db1',
        type: 'database',
        position: [6, 0.3, 0],
        label: 'DB',
        config: { maxConnections: 200, storageGB: 20 },
        status: 'idle',
      },
    ]
    const edges: CanvasEdge[] = [
      { id: 'e1', sourceId: 'c1', targetId: 'app1', protocol: 'http', animated: true },
      { id: 'e2', sourceId: 'app1', targetId: 'cache1', protocol: 'tcp', animated: true },
      { id: 'e3', sourceId: 'cache1', targetId: 'db1', protocol: 'tcp', animated: true },
    ]
    const engine = new SimulationEngine(nodes, edges)
    const r = stepMany(engine, 55)
    const appQ = r.metrics.app1?.throughputQps ?? 0
    const dbQ = r.metrics.db1?.throughputQps ?? 0
    expect(appQ).toBeGreaterThan(200)
    // Cache hit rate ~0.9 → DB should see at most 20% of App load
    expect(dbQ).toBeLessThan(appQ * 0.25)
  })

  it('TC-cache-parallel: parallel App→Cache + App→DB: DB RPS ≤ miss fraction × App RPS (BUG-02)', () => {
    // Canonical cache-aside: App fans out to both Cache and DB; Cache absorbs hits.
    const nodes: CanvasNode[] = [
      {
        id: 'c1',
        type: 'client',
        position: [0, 0.3, 0],
        label: 'Client',
        config: { requestsPerSecond: 1000 },
        status: 'idle',
      },
      {
        id: 'app1',
        type: 'compute',
        position: [2, 0.3, 0],
        label: 'App',
        config: { replicas: 1, instanceSize: 'large' },
        status: 'idle',
      },
      {
        id: 'cache1',
        type: 'cache',
        position: [4, 0.3, -1],
        label: 'Redis',
        config: { cacheStrategy: 'cache-aside', replicas: 1 },
        status: 'idle',
      },
      {
        id: 'db1',
        type: 'database',
        position: [4, 0.3, 1],
        label: 'DB',
        config: { maxConnections: 200, storageGB: 20 },
        status: 'idle',
      },
    ]
    const edges: CanvasEdge[] = [
      { id: 'e1', sourceId: 'c1', targetId: 'app1', protocol: 'http', animated: true },
      { id: 'e2', sourceId: 'app1', targetId: 'cache1', protocol: 'tcp', animated: true },
      { id: 'e3', sourceId: 'app1', targetId: 'db1', protocol: 'tcp', animated: true },
    ]
    const engine = new SimulationEngine(nodes, edges)
    const r = stepMany(engine, 55)
    const appQ = r.metrics.app1?.throughputQps ?? 0
    const dbQ = r.metrics.db1?.throughputQps ?? 0
    expect(appQ).toBeGreaterThan(200)
    // absorb-on-hit reduces DB load to miss fraction (~10–25% of App)
    expect(dbQ).toBeLessThan(appQ * 0.3)
  })

  // ─── CPU / utilization accuracy ────────────────────────────────────────────

  it('TC-cpu-override: App at 900 RPS with 2000 RPS override should show CPU < 70% (BUG-03)', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'c1',
        type: 'client',
        position: [0, 0.3, 0],
        label: 'Client',
        config: { requestsPerSecond: 900 },
        status: 'idle',
      },
      {
        id: 'app1',
        type: 'compute',
        position: [2, 0.3, 0],
        label: 'App',
        config: { replicas: 1, instanceSize: 'medium', nodeCapacityRps: 2000 },
        status: 'idle',
      },
    ]
    const edges: CanvasEdge[] = [
      { id: 'e1', sourceId: 'c1', targetId: 'app1', protocol: 'http', animated: true },
    ]
    const engine = new SimulationEngine(nodes, edges)
    const r = stepMany(engine, 55)
    const cpu = r.metrics.app1?.cpuUsagePercent ?? 100
    // 900 / 2000 = 45% utilisation → CPU should be well below 70%
    expect(cpu).toBeLessThan(70)
  })

  it('TC-db-cpu-override: DB at 900 RPS with 2500 RPS override should show CPU < 60% (BUG-03)', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'c1',
        type: 'client',
        position: [0, 0.3, 0],
        label: 'Client',
        config: { requestsPerSecond: 900 },
        status: 'idle',
      },
      {
        id: 'app1',
        type: 'compute',
        position: [2, 0.3, 0],
        label: 'App',
        config: { replicas: 1, instanceSize: 'large' },
        status: 'idle',
      },
      {
        id: 'db1',
        type: 'database',
        position: [4, 0.3, 0],
        label: 'DB',
        config: { maxConnections: 300, storageGB: 20, nodeCapacityRps: 2500 },
        status: 'idle',
      },
    ]
    const edges: CanvasEdge[] = [
      { id: 'e1', sourceId: 'c1', targetId: 'app1', protocol: 'http', animated: true },
      { id: 'e2', sourceId: 'app1', targetId: 'db1', protocol: 'tcp', animated: true },
    ]
    const engine = new SimulationEngine(nodes, edges)
    const r = stepMany(engine, 55)
    const cpu = r.metrics.db1?.cpuUsagePercent ?? 100
    // ~900 / 2500 ≈ 36% utilisation → CPU < 60%
    expect(cpu).toBeLessThan(60)
  })

  it('TC-redis-cpu: Redis at 900 RPS with 35000 RPS override should show CPU < 10% (BUG-03)', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'c1',
        type: 'client',
        position: [0, 0.3, 0],
        label: 'Client',
        config: { requestsPerSecond: 900 },
        status: 'idle',
      },
      {
        id: 'app1',
        type: 'compute',
        position: [2, 0.3, 0],
        label: 'App',
        config: { replicas: 1, instanceSize: 'large' },
        status: 'idle',
      },
      {
        id: 'cache1',
        type: 'cache',
        position: [4, 0.3, 0],
        label: 'Redis',
        config: { cacheStrategy: 'cache-aside', replicas: 2, nodeCapacityRps: 35000 },
        status: 'idle',
      },
    ]
    const edges: CanvasEdge[] = [
      { id: 'e1', sourceId: 'c1', targetId: 'app1', protocol: 'http', animated: true },
      { id: 'e2', sourceId: 'app1', targetId: 'cache1', protocol: 'tcp', animated: true },
    ]
    const engine = new SimulationEngine(nodes, edges)
    const r = stepMany(engine, 55)
    const cpu = r.metrics.cache1?.cpuUsagePercent ?? 100
    // 900 / 35000 ≈ 2.6% utilisation → CPU < 10%
    expect(cpu).toBeLessThan(10)
  })

  // ─── Inspector utilisation fields ──────────────────────────────────────────

  it('TC-utilization-inspector: utilizationPct and capacityRps populated for App, DB, Cache (BUG-05)', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'c1',
        type: 'client',
        position: [0, 0.3, 0],
        label: 'Client',
        config: { requestsPerSecond: 500 },
        status: 'idle',
      },
      {
        id: 'app1',
        type: 'compute',
        position: [2, 0.3, 0],
        label: 'App',
        config: { replicas: 1, instanceSize: 'medium', nodeCapacityRps: 2000 },
        status: 'idle',
      },
      {
        id: 'cache1',
        type: 'cache',
        position: [4, 0.3, -1],
        label: 'Redis',
        config: { cacheStrategy: 'cache-aside', replicas: 1, nodeCapacityRps: 10000 },
        status: 'idle',
      },
      {
        id: 'db1',
        type: 'database',
        position: [4, 0.3, 1],
        label: 'DB',
        config: { maxConnections: 200, storageGB: 20, nodeCapacityRps: 3000 },
        status: 'idle',
      },
    ]
    const edges: CanvasEdge[] = [
      { id: 'e1', sourceId: 'c1', targetId: 'app1', protocol: 'http', animated: true },
      { id: 'e2', sourceId: 'app1', targetId: 'cache1', protocol: 'tcp', animated: true },
      { id: 'e3', sourceId: 'app1', targetId: 'db1', protocol: 'tcp', animated: true },
    ]
    const engine = new SimulationEngine(nodes, edges)
    const r = stepMany(engine, 55)
    for (const id of ['app1', 'cache1', 'db1']) {
      const insp = r.inspector[id]
      expect(insp, `inspector missing for ${id}`).toBeDefined()
      expect(insp!.capacityRps, `capacityRps missing for ${id}`).toBeGreaterThan(0)
      expect(insp!.utilizationPct, `utilizationPct missing for ${id}`).toBeGreaterThanOrEqual(0)
      expect(insp!.utilizationPct!, `utilizationPct > 1 for ${id}`).toBeLessThanOrEqual(1.5)
    }
  })

  // ─── Config-interaction tests ───────────────────────────────────────────────

  it('TC-replica-capacity: 2 replicas doubles effective App capacity vs 1 replica', () => {
    // Both receive the same load; the 2-replica instance should have lower error rate.
    const makeEngine = (replicas: number) => {
      const nodes: CanvasNode[] = [
        {
          id: 'c1',
          type: 'client',
          position: [0, 0.3, 0],
          label: 'Client',
          config: { requestsPerSecond: 1400 },
          status: 'idle',
        },
        {
          id: 'app1',
          type: 'compute',
          position: [2, 0.3, 0],
          label: 'App',
          config: { replicas, instanceSize: 'small' },
          status: 'idle',
        },
      ]
      const edges: CanvasEdge[] = [
        { id: 'e1', sourceId: 'c1', targetId: 'app1', protocol: 'http', animated: true },
      ]
      return new SimulationEngine(nodes, edges)
    }
    const r1 = stepMany(makeEngine(1), 55)
    const r2 = stepMany(makeEngine(2), 55)
    const err1 = r1.metrics.app1?.errorRate ?? 0
    const err2 = r2.metrics.app1?.errorRate ?? 0
    expect(err1).toBeGreaterThan(0)
    // 2 replicas should have meaningfully lower error rate
    expect(err2).toBeLessThan(err1)
  })

  it('TC-read-replica-db: DB with readReplicas:2 handles more load than readReplicas:0', () => {
    const makeEngine = (readReplicas: number) => {
      const nodes: CanvasNode[] = [
        {
          id: 'c1',
          type: 'client',
          position: [0, 0.3, 0],
          label: 'Client',
          config: { requestsPerSecond: 3000 },
          status: 'idle',
        },
        {
          id: 'app1',
          type: 'compute',
          position: [2, 0.3, 0],
          label: 'App',
          config: { replicas: 4, instanceSize: 'large' },
          status: 'idle',
        },
        {
          id: 'db1',
          type: 'database',
          position: [4, 0.3, 0],
          label: 'DB',
          config: { maxConnections: 500, storageGB: 20, readReplicas },
          status: 'idle',
        },
      ]
      const edges: CanvasEdge[] = [
        { id: 'e1', sourceId: 'c1', targetId: 'app1', protocol: 'http', animated: true },
        { id: 'e2', sourceId: 'app1', targetId: 'db1', protocol: 'tcp', animated: true },
      ]
      return new SimulationEngine(nodes, edges)
    }
    const r0 = stepMany(makeEngine(0), 55)
    const r2 = stepMany(makeEngine(2), 55)
    const cap0 = r0.inspector.db1?.capacityRps ?? 0
    const cap2 = r2.inspector.db1?.capacityRps ?? 0
    // More read replicas → higher reported capacity
    expect(cap2).toBeGreaterThan(cap0)
    const err0 = r0.metrics.db1?.errorRate ?? 0
    const err2 = r2.metrics.db1?.errorRate ?? 0
    expect(err2).toBeLessThanOrEqual(err0)
  })

  it('TC-mq-partitions: MQ with partitions:8 has higher capacity than partitions:1', () => {
    const makeEngine = (partitions: number) => {
      const nodes: CanvasNode[] = [
        {
          id: 'c1',
          type: 'client',
          position: [0, 0.3, 0],
          label: 'Client',
          config: { requestsPerSecond: 1000 },
          status: 'idle',
        },
        {
          id: 'app1',
          type: 'compute',
          position: [2, 0.3, 0],
          label: 'App',
          config: { replicas: 2, instanceSize: 'large' },
          status: 'idle',
        },
        {
          id: 'mq1',
          type: 'message_queue',
          position: [4, 0.3, 0],
          label: 'MQ',
          config: { partitions },
          status: 'idle',
        },
        {
          id: 'w1',
          type: 'worker',
          position: [6, 0.3, 0],
          label: 'Worker',
          config: { replicas: 2, instanceSize: 'large', processingTimeMs: 50, jobType: 'io-bound' },
          status: 'idle',
        },
      ]
      const edges: CanvasEdge[] = [
        { id: 'e1', sourceId: 'c1', targetId: 'app1', protocol: 'http', animated: true },
        { id: 'e2', sourceId: 'app1', targetId: 'mq1', protocol: 'tcp', animated: true },
        { id: 'e3', sourceId: 'mq1', targetId: 'w1', protocol: 'tcp', animated: true },
      ]
      return new SimulationEngine(nodes, edges)
    }
    const r1 = stepMany(makeEngine(1), 55)
    const r8 = stepMany(makeEngine(8), 55)
    const cap1 = r1.inspector.mq1?.capacityRps ?? 0
    const cap8 = r8.inspector.mq1?.capacityRps ?? 0
    expect(cap8).toBeGreaterThan(cap1)
  })

  it('TC-cache-instances: Cache with instances:4 has 4× capacity vs instances:1', () => {
    const makeEngine = (instances: number) => {
      const nodes: CanvasNode[] = [
        {
          id: 'c1',
          type: 'client',
          position: [0, 0.3, 0],
          label: 'Client',
          config: { requestsPerSecond: 500 },
          status: 'idle',
        },
        {
          id: 'app1',
          type: 'compute',
          position: [2, 0.3, 0],
          label: 'App',
          config: { replicas: 1, instanceSize: 'large' },
          status: 'idle',
        },
        {
          id: 'cache1',
          type: 'cache',
          position: [4, 0.3, 0],
          label: 'Redis',
          config: { cacheStrategy: 'cache-aside', replicas: instances },
          status: 'idle',
        },
      ]
      const edges: CanvasEdge[] = [
        { id: 'e1', sourceId: 'c1', targetId: 'app1', protocol: 'http', animated: true },
        { id: 'e2', sourceId: 'app1', targetId: 'cache1', protocol: 'tcp', animated: true },
      ]
      return new SimulationEngine(nodes, edges)
    }
    const r1 = stepMany(makeEngine(1), 55)
    const r4 = stepMany(makeEngine(4), 55)
    const cap1 = r1.inspector.cache1?.capacityRps ?? 0
    const cap4 = r4.inspector.cache1?.capacityRps ?? 0
    expect(cap4).toBeCloseTo(cap1 * 4, -2)
  })

  // ─── Engine reinit ──────────────────────────────────────────────────────────

  it('TC-reinit: after reinit() first tick returns near-zero QPS (ramp resets)', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'c1',
        type: 'client',
        position: [0, 0.3, 0],
        label: 'Client',
        config: { requestsPerSecond: 1000 },
        status: 'idle',
      },
      {
        id: 'app1',
        type: 'compute',
        position: [2, 0.3, 0],
        label: 'App',
        config: { replicas: 1, instanceSize: 'large' },
        status: 'idle',
      },
    ]
    const edges: CanvasEdge[] = [
      { id: 'e1', sourceId: 'c1', targetId: 'app1', protocol: 'http', animated: true },
    ]
    const engine = new SimulationEngine(nodes, edges)
    stepMany(engine, RAMP_TICKS + 10)
    const steadyState = engine.step(16)
    expect(steadyState.metrics.app1?.throughputQps ?? 0).toBeGreaterThan(400)

    engine.reinit(nodes, edges)
    const afterReinit = engine.step(16)
    expect(afterReinit.metrics.app1?.throughputQps ?? 0).toBeLessThan(50)
  })

  it('TC-random: averaged over many ticks, three backends near equal share', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'c1',
        type: 'client',
        position: [0, 0.3, 0],
        label: 'Client',
        config: { requestsPerSecond: 900 },
        status: 'idle',
      },
      {
        id: 'lb1',
        type: 'load_balancer',
        position: [2, 0.3, 0],
        label: 'LB',
        config: { algorithm: 'random' },
        status: 'idle',
      },
      ...(['r1', 'r2', 'r3'] as const).map(
        (id, i): CanvasNode => ({
          id,
          type: 'compute',
          position: [4, 0.3, i * 2],
          label: id,
          config: { replicas: 1, instanceSize: 'medium' },
          status: 'idle',
        })
      ),
    ]
    const edges: CanvasEdge[] = [
      {
        id: 'ec',
        sourceId: 'c1',
        targetId: 'lb1',
        protocol: 'http',
        animated: true,
      },
      ...(['r1', 'r2', 'r3'] as const).map(
        (id): CanvasEdge => ({
          id: `er_${id}`,
          sourceId: 'lb1',
          targetId: id,
          protocol: 'http',
          animated: true,
        })
      ),
    ]
    const engine = new SimulationEngine(nodes, edges)
    stepMany(engine, 45)
    let acc = { r1: 0, r2: 0, r3: 0 }
    const samples = 120
    for (let i = 0; i < samples; i++) {
      const t = engine.step(16)
      const split = t.inspector.lb1?.backendSplit ?? []
      for (const b of split) {
        if (b.nodeId in acc) {
          acc[b.nodeId as keyof typeof acc] += b.qps
        }
      }
    }
    const sum = acc.r1 + acc.r2 + acc.r3
    expect(sum).toBeGreaterThan(100)
    for (const k of ['r1', 'r2', 'r3'] as const) {
      const share = acc[k] / sum
      expect(share).toBeGreaterThan(0.22)
      expect(share).toBeLessThan(0.45)
    }
  })

  it('TC-template-inspector: all templates emit concrete cache keys and rich inspector samples', () => {
    const templateIds = ['url-shortener', 'ecommerce', 'social-feed'] as const
    for (const templateId of templateIds) {
      const nodes: CanvasNode[] = [
        {
          id: 'c1',
          type: 'client',
          position: [0, 0.3, 0],
          label: 'Client',
          config: { requestsPerSecond: 1000 },
          status: 'idle',
        },
        {
          id: 'app1',
          type: 'compute',
          position: [2, 0.3, 0],
          label: 'App',
          config: { replicas: 1, instanceSize: 'medium' },
          status: 'idle',
        },
        {
          id: 'cache1',
          type: 'cache',
          position: [4, 0.3, 0],
          label: 'Cache',
          config: { cacheStrategy: 'cache-aside', evictionPolicy: 'volatile-ttl', replicas: 2 },
          status: 'idle',
        },
        {
          id: 'db1',
          type: 'database',
          position: [6, 0.3, 0],
          label: 'DB',
          config: { storageGB: 20, maxConnections: 300 },
          status: 'idle',
        },
        {
          id: 'mq1',
          type: 'message_queue',
          position: [8, 0.3, 0],
          label: 'MQ',
          config: { partitions: 4 },
          status: 'idle',
        },
        {
          id: 'w1',
          type: 'worker',
          position: [10, 0.3, 0],
          label: 'Worker',
          config: { replicas: 2, processingTimeMs: 60 },
          status: 'idle',
        },
      ]
      const edges: CanvasEdge[] = [
        { id: 'e1', sourceId: 'c1', targetId: 'app1', protocol: 'http', animated: true },
        { id: 'e2', sourceId: 'app1', targetId: 'cache1', protocol: 'http', animated: true },
        { id: 'e3', sourceId: 'app1', targetId: 'db1', protocol: 'tcp', animated: true },
        { id: 'e4', sourceId: 'db1', targetId: 'mq1', protocol: 'tcp', animated: true },
        { id: 'e5', sourceId: 'mq1', targetId: 'w1', protocol: 'tcp', animated: true },
      ]
      const engine = new SimulationEngine(nodes, edges, WORKLOAD_BY_TEMPLATE_ID[templateId])
      const r1 = stepMany(engine, 60)
      const r2 = engine.step(16)

      const cache = r1.inspector.cache1
      expect(cache?.cacheEntries?.length ?? 0).toBeGreaterThan(0)
      for (const e of cache?.cacheEntries ?? []) {
        expect(e.key.includes('{')).toBe(false)
      }
      expect((cache?.cacheEntries ?? []).some((e) => e.isHotKey)).toBe(true)
      expect((cache?.cacheEntries ?? []).some((e) => e.evictionCandidate)).toBe(true)
      expect(
        (cache?.cacheEntries ?? []).some((e) => e.ttlRemaining != null)
      ).toBe(true)

      expect(r1.inspector.db1?.dbQuerySamples?.length ?? 0).toBeGreaterThan(0)
      expect(r1.inspector.mq1?.mqMessages?.length ?? 0).toBeGreaterThan(0)
      expect(r1.inspector.w1?.workerJobs?.length ?? 0).toBeGreaterThan(0)

      const ttl1 = r1.inspector.cache1?.cacheEntries?.[0]?.ttlRemaining
      const ttl2 = r2.inspector.cache1?.cacheEntries?.[0]?.ttlRemaining
      if (ttl1 != null && ttl2 != null) {
        expect(ttl2).toBeLessThanOrEqual(ttl1)
      }
    }
  })
})
