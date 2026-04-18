import type { CanvasNode } from '../../../store/canvasStore'
import { ComponentModel } from '../ComponentModel'
import type {
  ReplicaBreakdownContext,
  ReplicaMetrics,
  SimulationState,
} from '../types'

const INSTANCE_CAPACITY: Record<string, number> = {
  small: 500,
  medium: 1500,
  large: 4000,
  xlarge: 8000,
}

export class AppServerModel extends ComponentModel {
  constructor(node: CanvasNode) {
    super(node)
  }

  private get instanceSize(): string {
    return String(this.node.config.instanceSize ?? 'medium')
  }

  private get replicas(): number {
    const n = Number(this.node.config.replicas ?? 1)
    return Number.isFinite(n) && n > 0 ? Math.min(5, n) : 1
  }

  maxCapacityQps(): number {
    const override = Number(this.node.config.nodeCapacityRps)
    if (Number.isFinite(override) && override > 0) return override
    const per = INSTANCE_CAPACITY[this.instanceSize] ?? 1500
    return per * this.replicas
  }

  processRequest(loadQps: number, concurrentConnections: number): SimulationState {
    const capacity = this.maxCapacityQps()
    const activeInstances = this.replicas
    const utilization = capacity > 0 ? loadQps / capacity : 2

    const baseLatency = 15
    let latency: number
    let errorRate: number
    let isHealthy: boolean

    if (utilization > 1) {
      latency = baseLatency * 8
      errorRate = Math.min(1, utilization - 1)
      isHealthy = false
    } else if (utilization > 0.8) {
      latency = baseLatency / Math.sqrt(1 - utilization)
      errorRate = 0
      isHealthy = true
    } else {
      latency = baseLatency * (1 + utilization * 0.2)
      errorRate = 0
      isHealthy = true
    }

    return {
      cpuUsagePercent: Math.min(100, utilization * 90),
      memoryUsageGb: activeInstances * 0.5,
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
    const perInstanceCap =
      (INSTANCE_CAPACITY[this.instanceSize] ?? 1500)
    const override = Number(this.node.config.nodeCapacityRps)
    const perCap = Number.isFinite(override) && override > 0
      ? override / n
      : perInstanceCap
    const algo = ctx?.lbAlgo ?? 'round-robin'
    const prevUtils = ctx?.prevReplicaUtils ?? []
    const prevLat = ctx?.prevReplicaLatencies ?? []
    const prevQps = ctx?.prevReplicaQps ?? []

    let weights: number[]
    switch (algo) {
      case 'least-connections':
      case 'weighted-least-connections':
        weights = Array.from({ length: n }, (_, i) => 1 / (1 + (prevUtils[i] ?? 0)))
        break
      case 'least-response-time':
        weights = Array.from(
          { length: n },
          (_, i) => 1 / Math.max(0.5, prevLat[i] ?? 15)
        )
        break
      case 'least-bandwidth':
        weights = Array.from({ length: n }, (_, i) => 1 / (1 + (prevQps[i] ?? 0)))
        break
      case 'ip-hash':
      case 'iphash': {
        const idx = Math.abs(ctx?.tick ?? 0) % n
        weights = Array.from({ length: n }, (_, i) => (i === idx ? 1 : 0))
        break
      }
      case 'random':
        weights = Array.from({ length: n }, (_, i) => {
          return Math.max(1e-6, Math.abs(Math.sin(i * 2654435761 + (ctx?.tick ?? 0))))
        })
        break
      default:
        weights = Array.from({ length: n }, () => 1)
    }
    const sum = weights.reduce((a, b) => a + b, 0)
    const shares =
      sum > 0 ? weights.map((w) => w / sum) : Array.from({ length: n }, () => 1 / n)

    const out: ReplicaMetrics[] = []
    for (let i = 0; i < n; i++) {
      const perQps = totalQps * shares[i]
      const util = perCap > 0 ? perQps / perCap : 2
      const baseLatency = 15
      const lat = util > 1 ? baseLatency * 8
        : util > 0.8 ? baseLatency / Math.sqrt(1 - util)
        : baseLatency * (1 + util * 0.2)
      out.push({
        label: i === 0 ? 'Primary' : `Replica ${i}`,
        qps: perQps,
        cpuPercent: Math.min(100, util * 90),
        memoryGb: 0.5,
        latencyMs: lat,
        errorRate: util > 1 ? Math.min(1, util - 1) : 0,
        utilizationPct: Math.min(2, util),
      })
    }
    return out
  }
}
