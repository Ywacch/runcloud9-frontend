import type { CanvasNode } from '../../../store/canvasStore'
import { ComponentModel } from '../ComponentModel'
import type {
  ReplicaBreakdownContext,
  ReplicaMetrics,
  SimulationState,
} from '../types'

const CONCURRENCY_FACTOR: Record<string, number> = {
  'io-bound': 10,
  mixed: 3,
  'cpu-bound': 1,
}

const INSTANCE_TYPE_MULTIPLIER: Record<string, number> = {
  small: 0.5,
  medium: 1.0,
  large: 2.0,
  xlarge: 4.0,
}

export class WorkerModel extends ComponentModel {
  constructor(node: CanvasNode) {
    super(node)
  }

  private get processingTimeMs(): number {
    const n = Number(this.node.config.processingTimeMs ?? 50)
    return Number.isFinite(n) && n > 0 ? n : 50
  }

  private get jobType(): string {
    return String(this.node.config.jobType ?? 'io-bound')
  }

  private get instanceSize(): string {
    return String(this.node.config.instanceSize ?? 'medium')
  }

  private get replicas(): number {
    const n = Number(this.node.config.replicas ?? 1)
    return Number.isFinite(n) && n > 0 ? Math.min(10, n) : 1
  }

  getEffectiveThroughput(): number {
    const override = Number(this.node.config.nodeCapacityRps)
    if (Number.isFinite(override) && override > 0) return override
    const concurrency = CONCURRENCY_FACTOR[this.jobType] ?? CONCURRENCY_FACTOR.mixed
    const typeMultiplier = INSTANCE_TYPE_MULTIPLIER[this.instanceSize] ?? 1
    return (
      this.replicas *
      concurrency *
      (1000 / Math.max(this.processingTimeMs, 1)) *
      typeMultiplier
    )
  }

  maxCapacityQps(): number {
    return this.getEffectiveThroughput()
  }

  processRequest(loadQps: number, concurrentConnections: number): SimulationState {
    const capacity = this.getEffectiveThroughput()
    const utilization = capacity > 0 ? loadQps / capacity : 2
    const baseLatency = this.processingTimeMs

    let latency: number
    let errorRate: number
    let isHealthy: boolean

    if (utilization > 1) {
      latency = baseLatency * 4
      errorRate = Math.min(1, utilization - 1)
      isHealthy = false
    } else {
      latency = baseLatency * (1 + utilization * 0.5)
      errorRate = 0
      isHealthy = true
    }

    return {
      cpuUsagePercent: Math.min(100, utilization * 85),
      memoryUsageGb: this.replicas * 0.25,
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
    const n = this.replicas
    if (n <= 1) return []
    const concurrency = CONCURRENCY_FACTOR[this.jobType] ?? CONCURRENCY_FACTOR.mixed
    const typeMultiplier = INSTANCE_TYPE_MULTIPLIER[this.instanceSize] ?? 1
    const override = Number(this.node.config.nodeCapacityRps)
    const perCap = Number.isFinite(override) && override > 0
      ? override / n
      : concurrency * (1000 / Math.max(this.processingTimeMs, 1)) * typeMultiplier
    const weights = Array.from({ length: n }, (_, i) => {
      const jitter = 1 + 0.05 * Math.sin(i * 2654435761 + (ctx?.tick ?? 0))
      return Math.max(1e-6, perCap * jitter)
    })
    const sum = weights.reduce((a, b) => a + b, 0)
    const shares =
      sum > 0 ? weights.map((w) => w / sum) : Array.from({ length: n }, () => 1 / n)
    const out: ReplicaMetrics[] = []
    for (let i = 0; i < n; i++) {
      const perQps = totalQps * shares[i]
      const util = perCap > 0 ? perQps / perCap : 2
      const baseLat = this.processingTimeMs
      const lat = util > 1 ? baseLat * 4 : baseLat * (1 + util * 0.5)
      out.push({
        label: `Worker ${i + 1}`,
        qps: perQps,
        cpuPercent: Math.min(100, util * 85),
        memoryGb: 0.25,
        latencyMs: lat,
        errorRate: util > 1 ? Math.min(1, util - 1) : 0,
        utilizationPct: Math.min(2, util),
      })
    }
    return out
  }
}
