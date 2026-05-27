import type { CanvasNode } from '../../../stores/canvasStore'
import { ComponentModel } from '../ComponentModel'
import type {
  ReplicaBreakdownContext,
  ReplicaMetrics,
  SimulationState,
} from '../types'

const INSTANCE_CAPACITY_REDIS = 50000

function strategyToReadWrite(cacheStrategy: string): {
  readStrategy: string
  writeStrategy: string
} {
  switch (cacheStrategy) {
    case 'write-through':
      return { readStrategy: 'read-through', writeStrategy: 'write-through' }
    case 'write-behind':
      return { readStrategy: 'cache-aside', writeStrategy: 'write-behind' }
    default:
      return { readStrategy: 'cache-aside', writeStrategy: 'write-around' }
  }
}

export class CacheModel extends ComponentModel {
  constructor(node: CanvasNode) {
    super(node)
  }

  private get instances(): number {
    const n = Number(this.node.config.replicas ?? 1)
    return Number.isFinite(n) && n > 0 ? Math.min(20, Math.floor(n)) : 1
  }

  override get hitRate(): number {
    const c = this.node.config
    const strategy = String(c.cacheStrategy ?? 'cache-aside')
    const { readStrategy, writeStrategy } = strategyToReadWrite(strategy)
    const evictionPolicy = String(c.evictionPolicy ?? 'allkeys-lru')
    const defaultTtl = 3600

    const strategyBonus = readStrategy === 'read-through' ? 0.05 : 0
    const ttlFactor = Math.min(1, defaultTtl / 7200)
    const writeMod =
      writeStrategy === 'write-through'
        ? 0.02
        : writeStrategy === 'write-behind'
          ? -0.01
          : 0
    const evictionMod =
      evictionPolicy === 'lfu'
        ? 0.02
        : evictionPolicy === 'volatile-ttl'
          ? 0.01
        : evictionPolicy === 'volatile-lru' || evictionPolicy === 'noeviction'
          ? -0.02
          : 0

    return Math.min(
      0.98,
      Math.max(0.1, 0.75 + strategyBonus + ttlFactor * 0.15 + writeMod + evictionMod)
    )
  }

  maxCapacityQps(): number {
    const override = Number(this.node.config.nodeCapacityRps)
    if (Number.isFinite(override) && override > 0) return override
    const nodes = Math.max(1, this.instances)
    return INSTANCE_CAPACITY_REDIS * nodes
  }

  processRequest(loadQps: number, concurrentConnections: number): SimulationState {
    const capacity = this.maxCapacityQps()
    const utilization = capacity > 0 ? loadQps / capacity : 2
    const maxMemoryMb = Number(this.node.config.maxMemoryMB ?? 512)
    const maxMemoryGb = Math.max(0.128, maxMemoryMb / 1024) * this.instances
    const baseLatency = 0.5
    let latency: number
    let errorRate: number
    let isHealthy: boolean

    if (utilization > 1) {
      latency = baseLatency * 5
      errorRate = Math.min(1, utilization - 1)
      isHealthy = false
    } else {
      latency = baseLatency * (1 + utilization * 0.3)
      errorRate = 0
      isHealthy = true
    }

    return {
      cpuUsagePercent: Math.min(100, utilization * 90),
      memoryUsageGb: Math.min(maxMemoryGb, Math.max(0.05, maxMemoryGb * utilization * 0.85)),
      latencyMs: latency,
      errorRate,
      isHealthy,
      currentConnections: concurrentConnections,
      throughputQps: loadQps,
    }
  }

  override computeReplicaBreakdown(
    totalQps: number,
    ctx?: ReplicaBreakdownContext
  ): ReplicaMetrics[] {
    const n = this.instances
    if (n <= 1) return []
    const override = Number(this.node.config.nodeCapacityRps)
    const perCap = Number.isFinite(override) && override > 0
      ? override / n
      : INSTANCE_CAPACITY_REDIS
    const weights = Array.from({ length: n }, (_, i) => {
      const skew = 1 + 0.1 * Math.sin(i * 1103515245 + (ctx?.tick ?? 0) * 0.1)
      return Math.max(1e-6, skew)
    })
    const sum = weights.reduce((a, b) => a + b, 0)
    const shares =
      sum > 0 ? weights.map((w) => w / sum) : Array.from({ length: n }, () => 1 / n)
    const out: ReplicaMetrics[] = []
    for (let i = 0; i < n; i++) {
      const perQps = totalQps * shares[i]
      const util = perCap > 0 ? perQps / perCap : 2
      const baseLat = 0.5
      const lat = util > 1 ? baseLat * 5 : baseLat * (1 + util * 0.3)
      out.push({
        label: `Node ${i + 1}`,
        qps: perQps,
        cpuPercent: Math.min(100, util * 90),
        memoryGb: 0,
        latencyMs: lat,
        errorRate: util > 1 ? Math.min(1, util - 1) : 0,
        utilizationPct: Math.min(2, util),
      })
    }
    return out
  }
}
