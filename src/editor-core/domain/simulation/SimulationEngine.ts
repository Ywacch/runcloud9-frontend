import type { CanvasEdge, CanvasNode } from '../../stores/canvasStore'
import { ComponentModel } from './ComponentModel'
import {
  AppServerModel,
  CacheModel,
  ClientModel,
  DatabaseSQLModel,
  GenericModel,
  LoadBalancerModel,
  MessageQueueModel,
  WorkerModel,
} from './models'
import {
  readWriteFractions,
  type RequestArchetype,
  type WorkloadProfile,
} from './workload'
import { classifyEdges, type EdgeSemantics } from './TopologyInference'
import type {
  ReplicaBreakdownContext,
  ReplicaMetrics,
  SimCacheEntry,
  SimDbQuerySample,
  SimMqMessage,
  SimulationState,
  SimulationTickResult,
  SimNodeInspector,
  SimWorkerJob,
} from './types'

const RAMP_TICKS = 40

const FLOW_PRIORITY: Partial<Record<CanvasNode['type'], number>> = {
  cache: 1,
  database: 2,
  message_queue: 3,
  worker: 4,
  compute: 5,
  load_balancer: 6,
  client: 99,
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function normalizeLbAlgo(raw: string): string {
  return String(raw ?? 'round-robin')
    .toLowerCase()
    .trim()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

interface CacheEntryState {
  key: string
  hitCount: number
  ttlRemaining?: number
  sizeBytes: number
  lastTouchedTick: number
}

function topologicalSort(
  nodeIds: string[],
  adjacency: Map<string, string[]>
): string[] {
  const inDegree = new Map<string, number>()
  for (const id of nodeIds) inDegree.set(id, 0)
  for (const [, targets] of adjacency) {
    for (const t of targets) {
      inDegree.set(t, (inDegree.get(t) ?? 0) + 1)
    }
  }
  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }
  const sorted: string[] = []
  while (queue.length > 0) {
    const node = queue.shift()!
    sorted.push(node)
    for (const succ of adjacency.get(node) ?? []) {
      const newDeg = (inDegree.get(succ) ?? 1) - 1
      inDegree.set(succ, newDeg)
      if (newDeg === 0) queue.push(succ)
    }
  }
  if (sorted.length < nodeIds.length) {
    for (const id of nodeIds) {
      if (!sorted.includes(id)) sorted.push(id)
    }
  }
  return sorted
}

const MODEL_FACTORIES: Partial<
  Record<CanvasNode['type'], new (n: CanvasNode) => ComponentModel>
> = {
  client: ClientModel,
  load_balancer: LoadBalancerModel,
  compute: AppServerModel,
  cache: CacheModel,
  database: DatabaseSQLModel,
  message_queue: MessageQueueModel,
  worker: WorkerModel,
}

export class SimulationEngine {
  private readonly models = new Map<string, ComponentModel>()
  private readonly adjacency = new Map<string, string[]>()
  private readonly reverseAdj = new Map<string, string[]>()
  private readonly nodeTypes = new Map<string, CanvasNode['type']>()
  private executionOrder: string[] = []
  private readonly clientIds: string[] = []
  private edgeSemantics = new Map<string, EdgeSemantics>()
  private srcTgtToConnId = new Map<string, string>()
  private connections: CanvasEdge[]
  private nodes: CanvasNode[]
  private workloadProfile: WorkloadProfile | undefined
  loadFactor = 1
  private simTime = 0
  private tickIndex = 0
  private rampTick = 0
  private readonly mqQueues = new Map<string, number>()
  private lastTickMetrics = new Map<string, SimulationState>()
  private prevReplicaBreakdown = new Map<string, ReplicaMetrics[]>()
  private cacheEntriesByNode = new Map<string, Map<string, CacheEntryState>>()

  constructor(
    nodes: CanvasNode[],
    edges: CanvasEdge[],
    workloadProfile?: WorkloadProfile
  ) {
    this.nodes = nodes
    this.connections = edges
    this.workloadProfile = workloadProfile
    this.buildGraph()
  }

  /** Replace topology while preserving simulated time counters. */
  reinit(nodes: CanvasNode[], edges: CanvasEdge[]): void {
    this.nodes = nodes
    this.connections = edges
    this.rampTick = 0
    this.mqQueues.clear()
    this.lastTickMetrics.clear()
    this.prevReplicaBreakdown.clear()
    this.cacheEntriesByNode.clear()
    this.buildGraph()
  }

  setWorkloadProfile(p: WorkloadProfile | undefined): void {
    this.workloadProfile = p
  }

  setLoadFactor(f: number): void {
    this.loadFactor = Math.max(0.05, Math.min(3, f))
  }

  private buildGraph(): void {
    this.models.clear()
    this.clientIds.length = 0
    this.srcTgtToConnId.clear()
    this.adjacency.clear()
    this.reverseAdj.clear()
    this.nodeTypes.clear()
    this.cacheEntriesByNode.clear()

    const nodeIds: string[] = []
    for (const node of this.nodes) {
      const Factory = MODEL_FACTORIES[node.type] ?? GenericModel
      this.models.set(node.id, new Factory(node))
      this.adjacency.set(node.id, [])
      this.reverseAdj.set(node.id, [])
      this.nodeTypes.set(node.id, node.type)
      nodeIds.push(node.id)
      if (node.type === 'client') this.clientIds.push(node.id)
      if (node.type === 'cache') this.cacheEntriesByNode.set(node.id, new Map())
    }
    for (const conn of this.connections) {
      const key = `${conn.sourceId}:${conn.targetId}`
      if (!this.srcTgtToConnId.has(key)) {
        this.srcTgtToConnId.set(key, conn.id)
      }
      const targets = this.adjacency.get(conn.sourceId)
      if (targets) targets.push(conn.targetId)
      const preds = this.reverseAdj.get(conn.targetId)
      if (preds) preds.push(conn.sourceId)
    }
    this.executionOrder = topologicalSort(nodeIds, this.adjacency)
    this.edgeSemantics = classifyEdges(this.nodes, this.connections)
  }

  private upstreamLbAlgo(nodeId: string): string | undefined {
    const preds = this.reverseAdj.get(nodeId) ?? []
    for (const pid of preds) {
      if (this.nodeTypes.get(pid) === 'load_balancer') {
        return normalizeLbAlgo(this.getLBAlgorithmRaw(pid))
      }
    }
    return undefined
  }

  private workloadReadFraction(): number {
    if (!this.workloadProfile?.archetypes.length) return 0.8
    return readWriteFractions(this.workloadProfile).read
  }

  private addEdgeFlow(
    edgeFlows: Map<string, number>,
    sourceId: string,
    targetId: string,
    qps: number
  ): void {
    if (qps <= 0) return
    const connId = this.srcTgtToConnId.get(`${sourceId}:${targetId}`)
    if (!connId) return
    edgeFlows.set(connId, (edgeFlows.get(connId) ?? 0) + qps)
  }

  /**
   * Canonical deploy topology uses dependency edges (`worker -> mq`), while
   * simulation queue-drain logic needs the logical consumer linked to the queue.
   * Support both directions during transition.
   */
  private linkedWorkerForMq(mqNodeId: string): string | undefined {
    const outgoing = this.adjacency.get(mqNodeId) ?? []
    const outWorker = outgoing.find((id) => this.nodeTypes.get(id) === 'worker')
    if (outWorker) return outWorker

    const incoming = this.reverseAdj.get(mqNodeId) ?? []
    const inWorker = incoming.find((id) => this.nodeTypes.get(id) === 'worker')
    return inWorker
  }

  private getClientBaseQps(clientId: string): number {
    const node = this.nodes.find((n) => n.id === clientId)
    if (!node) return 1000
    const rps = node.config.requestsPerSecond
    return typeof rps === 'number' && rps > 0 ? rps : 1000
  }

  private getLBAlgorithmRaw(nodeId: string): string {
    const node = this.nodes.find((n) => n.id === nodeId)
    return String(node?.config.algorithm ?? 'round-robin')
  }

  private missFractionForCacheEdge(cacheNodeId: string): number {
    const model = this.models.get(cacheNodeId)
    const hr = model instanceof CacheModel ? model.hitRate : 0.85
    if (!this.workloadProfile?.archetypes.length) return 1 - hr
    const { read, write } = readWriteFractions(this.workloadProfile)
    return read * (1 - hr) + write
  }

  /**
   * For the parallel cache-aside pattern (source → cache AND source → db),
   * find the sibling cache node so we can read its hit rate.
   */
  private siblingCacheId(sourceId: string, dbTargetId: string): string | undefined {
    for (const conn of this.connections) {
      if (conn.sourceId !== sourceId || conn.targetId === dbTargetId) continue
      if (this.nodeTypes.get(conn.targetId) === 'cache') return conn.targetId
    }
    return undefined
  }

  private rngFor(nodeId: string): () => number {
    return mulberry32(hashString(nodeId) ^ (this.tickIndex * 2654435761))
  }

  private pickFrom<T>(items: T[], fallback: T, rng: () => number): T {
    if (items.length === 0) return fallback
    const idx = Math.floor(rng() * items.length)
    return items[Math.max(0, Math.min(items.length - 1, idx))]
  }

  private expandPattern(pattern: string, sampleId: string, rng: () => number): string {
    const userId = `u-${100 + Math.floor(rng() * 900)}`
    const postId = `p-${100 + Math.floor(rng() * 900)}`
    const q = this.pickFrom(['laptop', 'desk', 'usb-c hub'], 'item', rng)
    return pattern
      .replace(/\{id\}/g, sampleId)
      .replace(/\{userId\}/g, userId)
      .replace(/\{postId\}/g, postId)
      .replace(/\{q\}/g, q)
  }

  private cacheKeySamples(nodeId: string): string[] {
    const rng = this.rngFor(nodeId)
    const archetypes = this.workloadProfile?.archetypes ?? []
    const withPattern = archetypes.filter(
      (a) => typeof a.cacheKeyPattern === 'string' && a.cacheKeyPattern.length > 0
    )
    const out: string[] = []
    for (const a of withPattern) {
      const sid = this.pickFrom(a.sampleIds, `${a.id}-${this.tickIndex}`, rng)
      out.push(this.expandPattern(a.cacheKeyPattern!, sid, rng))
      if (out.length >= 6) break
    }
    return out.slice(0, 6)
  }

  private buildCacheEntries(nodeId: string): SimCacheEntry[] {
    const node = this.nodes.find((n) => n.id === nodeId)
    const policy = String(node?.config.evictionPolicy ?? 'allkeys-lru').toLowerCase()
    const ttlEnabled = policy.includes('ttl') || policy.includes('volatile')
    const baseTtl = Math.max(30, Number(node?.config.defaultTtl ?? 3600))
    const maxMemoryMb = Math.max(64, Number(node?.config.maxMemoryMB ?? 256))
    const maxEntries = Math.max(24, Math.floor(maxMemoryMb / 4))
    const rng = this.rngFor(nodeId)
    const keys = this.cacheKeySamples(nodeId)
    const state = this.cacheEntriesByNode.get(nodeId) ?? new Map<string, CacheEntryState>()
    this.cacheEntriesByNode.set(nodeId, state)

    // Age TTL keys and remove expired entries for TTL-like policies.
    if (ttlEnabled) {
      for (const [k, item] of state.entries()) {
        if (item.ttlRemaining != null) {
          item.ttlRemaining = Math.max(0, item.ttlRemaining - 1)
          if (item.ttlRemaining <= 0) state.delete(k)
        }
      }
    }

    // Simulate ongoing traffic touching/inserting keys.
    const touches = Math.max(2, Math.min(14, Math.floor(4 + (keys.length || 1) * 1.5)))
    for (let i = 0; i < touches; i++) {
      const key = this.pickFrom(keys, `cache:${nodeId}:${this.tickIndex}:${i}`, rng)
      const ex = state.get(key)
      if (ex) {
        ex.hitCount += Math.max(1, Math.floor(1 + rng() * 10))
        ex.lastTouchedTick = this.tickIndex
        if (ttlEnabled && ex.ttlRemaining != null && rng() > 0.55) {
          ex.ttlRemaining = Math.min(baseTtl, ex.ttlRemaining + Math.floor(1 + rng() * 4))
        }
      } else {
        state.set(key, {
          key,
          hitCount: Math.max(1, Math.floor(3 + rng() * 8)),
          ttlRemaining: ttlEnabled ? Math.max(1, Math.floor(baseTtl * (0.4 + rng() * 0.6))) : undefined,
          sizeBytes: 120 + Math.floor(rng() * 1800),
          lastTouchedTick: this.tickIndex,
        })
      }
    }

    const evictionScore = (e: CacheEntryState): number => {
      if (policy.includes('ttl')) return e.ttlRemaining ?? Number.MAX_SAFE_INTEGER
      if (policy.includes('lfu')) return e.hitCount
      // LRU-ish: older entries have smaller score
      return e.lastTouchedTick
    }

    if (!policy.includes('noeviction')) {
      while (state.size > maxEntries) {
        const victim = [...state.values()]
          .sort((a, b) => evictionScore(a) - evictionScore(b))[0]
        if (!victim) break
        state.delete(victim.key)
      }
    }

    const values = [...state.values()]
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, 12)
    if (values.length === 0) return []

    const hotSet = new Set(values.slice(0, 2).map((v) => v.key))
    const evictionCandidateKey = policy.includes('noeviction')
      ? undefined
      : [...state.values()].sort((a, b) => evictionScore(a) - evictionScore(b))[0]?.key
    const fallbackCandidateKey =
      evictionCandidateKey && values.some((v) => v.key === evictionCandidateKey)
        ? evictionCandidateKey
        : (!policy.includes('noeviction') ? values[values.length - 1]?.key : undefined)

    return values.map((e) => ({
      key: e.key,
      ttlRemaining: e.ttlRemaining,
      hitCount: e.hitCount,
      isHotKey: hotSet.has(e.key),
      evictionCandidate: fallbackCandidateKey === e.key,
      sizeBytes: e.sizeBytes,
    }))
  }

  private buildDbQuerySamples(nodeId: string, dbQps: number): SimDbQuerySample[] {
    if (dbQps <= 0) return []
    const rng = this.rngFor(`${nodeId}:db`)
    const archetypes = (this.workloadProfile?.archetypes ?? []).filter((a) => a.dbLabel)
    if (archetypes.length === 0) {
      return [{
        label: 'SELECT * FROM records WHERE id = ?',
        boundParams: [`id-${Math.floor(rng() * 9999)}`],
        latencyMs: 5 + rng() * 8,
        rowsReturned: 1,
      }]
    }
    return archetypes.slice(0, 5).map((a) => {
      const sid = this.pickFrom(a.sampleIds, `${a.id}-${this.tickIndex}`, rng)
      const rwBoost = a.method === 'write' ? 1.3 : 1
      return {
        label: a.dbLabel!,
        boundParams: [sid],
        latencyMs: Number((4 + rng() * 20 * rwBoost).toFixed(2)),
        rowsReturned: a.method === 'read' ? 1 + Math.floor(rng() * 50) : Math.floor(rng() * 2),
      }
    })
  }

  private buildMqMessages(nodeId: string, depth: number): SimMqMessage[] {
    const rng = this.rngFor(`${nodeId}:mq`)
    const archetypes = this.workloadProfile?.archetypes ?? []
    const sampleCount = Math.max(1, Math.min(5, archetypes.length || 3))
    const fallback: RequestArchetype = {
      id: 'task',
      label: 'Background task',
      method: 'write',
      weight: 1,
      sampleIds: ['job-1'],
    }
    return Array.from({ length: sampleCount }, (_, i) => {
      const a = this.pickFrom(archetypes, fallback, rng)
      const sid = this.pickFrom(a.sampleIds ?? [], `job-${i + 1}`, rng)
      return {
        topic: a.mqLabel ?? a.label,
        payload: `${a.id}:${sid}`,
        ageMs: Math.round((depth > 0 ? depth : 1) * (10 + rng() * 15)),
        deliveryAttempt: rng() > 0.9 ? 2 + Math.floor(rng() * 2) : 1,
      }
    })
  }

  private buildWorkerJobs(nodeId: string): SimWorkerJob[] {
    const rng = this.rngFor(`${nodeId}:worker`)
    const archetypes = this.workloadProfile?.archetypes ?? []
    const sampleCount = Math.max(2, Math.min(4, archetypes.length || 2))
    const fallback: RequestArchetype = {
      id: 'task',
      label: 'Process task',
      method: 'write',
      weight: 1,
      sampleIds: ['task-1'],
    }
    return Array.from({ length: sampleCount }, (_, i) => {
      const a = this.pickFrom(archetypes, fallback, rng)
      const pMs = 20 + Math.floor(rng() * 180)
      const r = rng()
      return {
        label: `${a.label} #${i + 1}`,
        processingTimeMs: pMs,
        status: r > 0.92 ? 'failed' : r > 0.35 ? 'processing' : 'completed',
      }
    })
  }

  private databaseBreakdown(dbQps: number): { label: string; qps: number }[] {
    if (dbQps <= 0) return []
    if (!this.workloadProfile?.archetypes.length) {
      return [{ label: 'SQL queries (aggregated)', qps: dbQps }]
    }
    const { read, write } = readWriteFractions(this.workloadProfile)
    const items = this.workloadProfile.archetypes
      .filter((a) => a.dbLabel)
      .map((a) => {
        const rw = a.method === 'read' ? read : write
        return { label: a.dbLabel!, weight: a.weight * rw }
      })
    const sum = items.reduce((s, x) => s + x.weight, 0)
    if (sum <= 0) return [{ label: 'SQL queries (aggregated)', qps: dbQps }]
    return items.map(({ label, weight }) => ({
      label,
      qps: (dbQps * weight) / sum,
    }))
  }

  private getBackendWeights(lbId: string, successors: string[]): number[] {
    const node = this.nodes.find((n) => n.id === lbId)
    const raw = node?.config.backendWeights
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const o = raw as Record<string, unknown>
      return successors.map((s) => {
        const w = Number(o[s])
        return Number.isFinite(w) && w > 0 ? w : 1
      })
    }
    return successors.map(() => 1)
  }

  private backendRef(
    s: string,
    prevMetrics: Map<string, SimulationState>
  ): SimulationState | undefined {
    return prevMetrics.get(s) ?? this.lastTickMetrics.get(s)
  }

  private distributeLBLoad(
    nodeId: string,
    inputQps: number,
    successors: string[],
    nodeLoads: Map<string, number>,
    prevMetrics: Map<string, SimulationState>,
    lbBackendQps: Map<string, Map<string, number>>,
    edgeFlows: Map<string, number>
  ): void {
    if (successors.length === 0 || inputQps <= 0) return
    let rawAlgo = normalizeLbAlgo(this.getLBAlgorithmRaw(nodeId))
    if (rawAlgo === 'weightedrr' || rawAlgo === 'wrr') rawAlgo = 'weighted'

    let inner = lbBackendQps.get(nodeId)
    if (!inner) {
      inner = new Map()
      lbBackendQps.set(nodeId, inner)
    }

    const addTrack = (s: string, q: number): void => {
      inner!.set(s, (inner!.get(s) ?? 0) + q)
      this.addEdgeFlow(edgeFlows, nodeId, s, q)
    }

    const applyShares = (shares: number[]): void => {
      const sum = shares.reduce((a, b) => a + b, 0)
      if (sum <= 0) {
        const per = inputQps / successors.length
        for (const s of successors) {
          nodeLoads.set(s, (nodeLoads.get(s) ?? 0) + per)
          addTrack(s, per)
        }
        return
      }
      for (let i = 0; i < successors.length; i++) {
        const q = (inputQps * shares[i]) / sum
        const s = successors[i]!
        nodeLoads.set(s, (nodeLoads.get(s) ?? 0) + q)
        addTrack(s, q)
      }
    }

    if (rawAlgo === 'round-robin') {
      const per = inputQps / successors.length
      for (const s of successors) {
        nodeLoads.set(s, (nodeLoads.get(s) ?? 0) + per)
        addTrack(s, per)
      }
      return
    }

    if (rawAlgo === 'weighted' || rawAlgo === 'weighted-round-robin') {
      const weights = this.getBackendWeights(nodeId, successors)
      applyShares(weights)
      return
    }

    if (rawAlgo === 'least-connections') {
      const scores = successors.map((s) => {
        const st = this.backendRef(s, prevMetrics)
        const conns = st?.currentConnections ?? 0
        return 1 / (1 + conns)
      })
      applyShares(scores)
      return
    }

    if (rawAlgo === 'weighted-least-connections') {
      const weights = this.getBackendWeights(nodeId, successors)
      const scores = successors.map((s, i) => {
        const st = this.backendRef(s, prevMetrics)
        const conns = st?.currentConnections ?? 0
        const w = weights[i] ?? 1
        return w / (1 + conns)
      })
      applyShares(scores)
      return
    }

    if (rawAlgo === 'ip-hash' || rawAlgo === 'iphash') {
      const mix =
        (this.simTime * 1000003 +
          this.tickIndex * 1103515245 +
          hashString(nodeId)) >>>
        0
      const idx = successors.length > 0 ? mix % successors.length : 0
      const target = successors[idx]!
      nodeLoads.set(target, (nodeLoads.get(target) ?? 0) + inputQps)
      addTrack(target, inputQps)
      return
    }

    if (rawAlgo === 'least-response-time') {
      const scores = successors.map((s) => {
        const st = this.backendRef(s, prevMetrics)
        const lat = Math.max(0.5, st?.latencyMs ?? 15)
        return 1 / lat
      })
      applyShares(scores)
      return
    }

    if (rawAlgo === 'least-bandwidth') {
      const scores = successors.map((s) => {
        const st = this.backendRef(s, prevMetrics)
        const bw = st?.throughputQps ?? 0
        return 1 / (1 + bw)
      })
      applyShares(scores)
      return
    }

    if (rawAlgo === 'random') {
      const rng = mulberry32(hashString(nodeId) ^ (this.tickIndex * 2654435761))
      const rawW = successors.map(() => Math.max(1e-9, rng()))
      applyShares(rawW)
      return
    }

    const per = inputQps / successors.length
    for (const s of successors) {
      nodeLoads.set(s, (nodeLoads.get(s) ?? 0) + per)
      addTrack(s, per)
    }
  }

  private collectDiagnostics(
    metrics: SimulationTickResult['metrics'],
    mqDepth: Record<string, number>,
    mqIngress: Map<string, number>,
    lbBackendQps: Map<string, Map<string, number>>,
    ingressByNode: Map<string, number>
  ): string[] {
    const out: string[] = []
    const write = this.workloadProfile?.archetypes.length
      ? readWriteFractions(this.workloadProfile!).write
      : 0.3

    if (write > 0.45) {
      out.push(
        'Workload is write-heavy; expect more cache churn and DB pressure than a read-mostly profile.'
      )
    }

    const unevenAlgosSkip = new Set([
      'round-robin',
      'ip-hash',
      'iphash',
      'random',
      'weighted',
      'weighted-round-robin',
      'weighted-rr',
      'weightedrr',
      'wrr',
    ])

    for (const nodeId of this.executionOrder) {
      const t = this.nodeTypes.get(nodeId)
      if (t === 'load_balancer') {
        const succs = this.adjacency.get(nodeId) ?? []
        const dist = succs.filter((s) => {
          const conn = this.connections.find(
            (c) => c.sourceId === nodeId && c.targetId === s
          )
          if (!conn) return false
          return this.edgeSemantics.get(conn.id) === 'load-distribute'
        })
        const ingress = ingressByNode.get(nodeId) ?? 0
        if (dist.length === 0 && ingress > 1) {
          out.push(
            `Load balancer "${this.nodes.find((n) => n.id === nodeId)?.label ?? nodeId}" has no load-distribute targets.`
          )
        }
        const track = lbBackendQps.get(nodeId)
        const na = normalizeLbAlgo(this.getLBAlgorithmRaw(nodeId))
        if (
          track &&
          [...track.values()].some((v) => v > 0) &&
          !unevenAlgosSkip.has(na)
        ) {
          const vals = [...track.values()].filter((v) => v > 0)
          const mx = Math.max(...vals)
          const mn = Math.min(...vals)
          if (mn > 0 && mx / mn > 2.5) {
            out.push(
              `Uneven backend split under ${this.getLBAlgorithmRaw(nodeId)}; check capacity or connection counts.`
            )
          }
        }
      }

      if (t === 'message_queue') {
        const inQ = mqIngress.get(nodeId) ?? 0
        const depth = mqDepth[nodeId] ?? 0
        const workerId = this.linkedWorkerForMq(nodeId)
        const cap = workerId
          ? (this.models.get(workerId) as WorkerModel).getEffectiveThroughput()
          : 0
        if (cap > 0 && inQ > cap * 1.8) {
          out.push(
            `Queue "${this.nodes.find((n) => n.id === nodeId)?.label ?? nodeId}" ingress is high vs consumer capacity (~${Math.round(cap)} qps).`
          )
        }
        if (depth > cap * 2 && cap > 0) {
          out.push(
            `Backlog on "${this.nodes.find((n) => n.id === nodeId)?.label ?? nodeId}" is growing; scale workers or reduce producers.`
          )
        }
      }

      const m = metrics[nodeId]
      if (m && !m.isHealthy && m.errorRate > 0.05) {
        out.push(
          `Component "${this.nodes.find((n) => n.id === nodeId)?.label ?? nodeId}" is unhealthy (errors ~${(m.errorRate * 100).toFixed(0)}%).`
        )
      }
    }

    return [...new Set(out)]
  }

  private buildInspector(
    ingressByNode: Map<string, number>,
    metrics: SimulationTickResult['metrics'],
    lbBackendQps: Map<string, Map<string, number>>,
    cacheHitsQps: Map<string, number>,
    cacheMissesQps: Map<string, number>,
    mqIngress: Map<string, number>,
    mqDepth: Record<string, number>
  ): Record<string, SimNodeInspector> {
    const inspector: Record<string, SimNodeInspector> = {}

    for (const nodeId of this.executionOrder) {
      const nodeType = this.nodeTypes.get(nodeId)!
      const m = metrics[nodeId]
      if (!m) continue

      const base: SimNodeInspector = {
        ingressQps: ingressByNode.get(nodeId) ?? 0,
        servedQps: m.throughputQps,
      }

      const model = this.models.get(nodeId)
      if (model && nodeType !== 'client') {
        const cap = model.maxCapacityQps()
        if (Number.isFinite(cap) && cap > 0 && cap < 1e7) {
          base.capacityRps = cap
          const ing = ingressByNode.get(nodeId) ?? 0
          base.utilizationPct = cap > 0 ? ing / cap : 0
        }
        const prev = this.prevReplicaBreakdown.get(nodeId) ?? []
        const ctx: ReplicaBreakdownContext = {
          tick: this.tickIndex,
          lbAlgo: nodeType === 'compute' ? this.upstreamLbAlgo(nodeId) : undefined,
          prevReplicaUtils: prev.map((r) => r.utilizationPct),
          prevReplicaLatencies: prev.map((r) => r.latencyMs),
          prevReplicaQps: prev.map((r) => r.qps),
          readFraction: nodeType === 'database' ? this.workloadReadFraction() : undefined,
        }
        const rb = model.computeReplicaBreakdown(
          ingressByNode.get(nodeId) ?? 0,
          ctx
        )
        if (rb && rb.length > 0) {
          base.replicaBreakdown = rb
          this.prevReplicaBreakdown.set(nodeId, rb)
        } else {
          this.prevReplicaBreakdown.delete(nodeId)
        }
      }

      if (nodeType === 'load_balancer') {
        const inner = lbBackendQps.get(nodeId)
        if (inner && inner.size > 0) {
          base.backendSplit = [...inner.entries()]
            .filter(([, q]) => q > 0)
            .map(([nid, qps]) => ({ nodeId: nid, qps }))
            .sort((a, b) => b.qps - a.qps)
        }
      }

      if (nodeType === 'cache') {
        const h = cacheHitsQps.get(nodeId) ?? 0
        const miss = cacheMissesQps.get(nodeId) ?? 0
        if (h > 0 || miss > 0) {
          base.cacheHitsQps = h
          base.cacheMissesQps = miss
        }
        const samples = this.cacheKeySamples(nodeId)
        if (samples.length) base.cacheKeySamples = samples
        const entries = this.buildCacheEntries(nodeId)
        if (entries.length) base.cacheEntries = entries
      }

      if (nodeType === 'database') {
        base.databaseBreakdown = this.databaseBreakdown(m.throughputQps)
        const q = this.buildDbQuerySamples(nodeId, m.throughputQps)
        if (q.length) base.dbQuerySamples = q
      }

      if (nodeType === 'message_queue') {
        base.mqIngressQps = mqIngress.get(nodeId)
        base.mqQueueDepth = mqDepth[nodeId]
        const workerId = this.linkedWorkerForMq(nodeId)
        if (workerId) {
          const wm = this.models.get(workerId) as WorkerModel
          base.workerCapacityQps = wm.getEffectiveThroughput()
          base.mqDrainQps = metrics[workerId]?.throughputQps
        }
        const msgs = this.buildMqMessages(nodeId, mqDepth[nodeId] ?? 0)
        if (msgs.length) base.mqMessages = msgs
      }

      if (nodeType === 'worker') {
        const wm = this.models.get(nodeId) as WorkerModel
        base.workerCapacityQps = wm.getEffectiveThroughput()
        const jobs = this.buildWorkerJobs(nodeId)
        if (jobs.length) base.workerJobs = jobs
      }

      inspector[nodeId] = base
    }

    return inspector
  }

  step(_dtMs: number): SimulationTickResult {
    const edgeFlows = new Map<string, number>()
    this.simTime += 1
    this.tickIndex += 1

    const wave = 1 + Math.sin(this.simTime / 10) * 0.1
    const baseFactor = this.loadFactor * wave
    const rampRatio = Math.min(1, (this.rampTick / RAMP_TICKS) ** 2)

    const loads = new Map<string, number>()
    for (const id of this.executionOrder) loads.set(id, 0)

    for (const cid of this.clientIds) {
      loads.set(cid, this.getClientBaseQps(cid) * baseFactor * rampRatio)
    }

    if (this.clientIds.length === 0) {
      const roots = this.executionOrder.filter(
        (id) => !this.connections.some((c) => c.targetId === id)
      )
      for (const rid of roots) {
        loads.set(rid, 1000 * baseFactor * rampRatio)
      }
    }

    this.rampTick += 1

    const prevMetrics = new Map<string, SimulationState>()
    const metrics: SimulationTickResult['metrics'] = {}
    let cacheHitsDelta = 0
    let cacheMissesDelta = 0
    const mqDepth: Record<string, number> = {}

    const lbBackendQps = new Map<string, Map<string, number>>()
    const cacheHitsQps = new Map<string, number>()
    const cacheMissesQps = new Map<string, number>()
    const mqIngress = new Map<string, number>()
    const ingressByNode = new Map<string, number>()

    for (const nodeId of this.executionOrder) {
      const nodeType = this.nodeTypes.get(nodeId)!
      const inputQps = loads.get(nodeId) ?? 0
      ingressByNode.set(nodeId, inputQps)

      if (nodeType === 'message_queue') {
        mqIngress.set(nodeId, inputQps)
        const model = this.models.get(nodeId)! as MessageQueueModel
        const conns = Math.max(0, Math.floor(inputQps / 10))
        const state = model.processRequest(inputQps, conns)
        prevMetrics.set(nodeId, state)
        metrics[nodeId] = state

        const workerId = this.linkedWorkerForMq(nodeId)
        if (workerId) {
          const wm = this.models.get(workerId) as WorkerModel
          const cap = wm.getEffectiveThroughput()
          const prevQ = this.mqQueues.get(nodeId) ?? 0
          const total = prevQ + inputQps
          const served = Math.min(total, cap)
          this.mqQueues.set(nodeId, total - served)
          loads.set(workerId, (loads.get(workerId) ?? 0) + served)
          if (served > 0) {
            this.addEdgeFlow(edgeFlows, nodeId, workerId, served)
          }
        }
        mqDepth[nodeId] = this.mqQueues.get(nodeId) ?? 0
        continue
      }

      const model = this.models.get(nodeId)!
      const conns = Math.max(0, Math.floor(inputQps / 10))
      const state = model.processRequest(inputQps, conns)
      prevMetrics.set(nodeId, state)
      metrics[nodeId] = state

      const successors = this.adjacency.get(nodeId) ?? []
      if (successors.length === 0 || inputQps <= 0) continue

      const sorted = [...successors].sort(
        (a, b) =>
          (FLOW_PRIORITY[this.nodeTypes.get(a)!] ?? 99) -
          (FLOW_PRIORITY[this.nodeTypes.get(b)!] ?? 99)
      )

      const toDistribute: string[] = []
      for (const s of sorted) {
        const conn = this.connections.find(
          (c) => c.sourceId === nodeId && c.targetId === s
        )
        if (!conn) continue
        const role =
          this.edgeSemantics.get(conn.id) ?? 'passthrough-compute'

        if (role === 'absorb-on-hit') {
          const missFrac = this.missFractionForCacheEdge(s)
          const missQps = inputQps * missFrac
          const hitQps = inputQps * (1 - missFrac)
          cacheMissesDelta += missQps
          cacheHitsDelta += hitQps
          cacheMissesQps.set(s, (cacheMissesQps.get(s) ?? 0) + missQps)
          cacheHitsQps.set(s, (cacheHitsQps.get(s) ?? 0) + hitQps)
          this.addEdgeFlow(edgeFlows, nodeId, s, inputQps)
          loads.set(s, (loads.get(s) ?? 0) + missQps)
        } else if (role === 'cache-miss-forward') {
          // Parallel cache-aside: this edge (source → db) only carries miss traffic.
          // Find the sibling cache to read its hit rate.
          const cacheId = this.siblingCacheId(nodeId, s)
          const missFrac = cacheId
            ? this.missFractionForCacheEdge(cacheId)
            : 0.15
          const missQps = inputQps * missFrac
          this.addEdgeFlow(edgeFlows, nodeId, s, missQps)
          loads.set(s, (loads.get(s) ?? 0) + missQps)
        } else if (role === 'load-distribute') {
          toDistribute.push(s)
        } else if (role === 'async-decouple') {
          this.addEdgeFlow(edgeFlows, nodeId, s, inputQps)
          loads.set(s, (loads.get(s) ?? 0) + inputQps)
        } else {
          this.addEdgeFlow(edgeFlows, nodeId, s, inputQps)
          loads.set(s, (loads.get(s) ?? 0) + inputQps)
        }
      }

      if (toDistribute.length > 0) {
        this.distributeLBLoad(
          nodeId,
          inputQps,
          toDistribute,
          loads,
          prevMetrics,
          lbBackendQps,
          edgeFlows
        )
      }
    }

    for (const mqId of this.mqQueues.keys()) {
      mqDepth[mqId] = this.mqQueues.get(mqId) ?? 0
    }

    this.lastTickMetrics = new Map(
      Object.entries(metrics) as [string, SimulationState][]
    )

    const inspector = this.buildInspector(
      ingressByNode,
      metrics,
      lbBackendQps,
      cacheHitsQps,
      cacheMissesQps,
      mqIngress,
      mqDepth
    )

    const diagnostics = this.collectDiagnostics(
      metrics,
      mqDepth,
      mqIngress,
      lbBackendQps,
      ingressByNode
    )

    return {
      tick: this.tickIndex,
      metrics,
      cacheHitsDelta,
      cacheMissesDelta,
      mqQueueDepth: mqDepth,
      inspector,
      diagnostics,
      edgeFlows: Object.fromEntries(edgeFlows),
    }
  }
}
