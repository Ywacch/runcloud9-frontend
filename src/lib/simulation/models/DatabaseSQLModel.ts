import type { CanvasNode } from '../../../store/canvasStore'
import { ComponentModel } from '../ComponentModel'
import type {
  ReplicaBreakdownContext,
  ReplicaMetrics,
  SimulationState,
} from '../types'

const INSTANCE_CAPACITY: Record<string, number> = {
  small: 500,
  medium: 2000,
  large: 5000,
  xlarge: 10000,
}

const ENGINE_FACTORS: Record<string, [number, number, number]> = {
  postgresql: [1.0, 0.8, 5.0],
  mysql: [1.2, 0.9, 4.0],
}

export class DatabaseSQLModel extends ComponentModel {
  constructor(node: CanvasNode) {
    super(node)
  }

  private get engine(): string {
    return String(this.node.config.engine ?? 'postgresql')
  }

  /** RunCloud9 inspector has no DB instance size; derive from storage hint. */
  private get instanceType(): string {
    const gb = Number(this.node.config.storageGB ?? 10)
    if (gb <= 10) return 'small'
    if (gb <= 30) return 'medium'
    return 'large'
  }

  private get readReplicas(): number {
    const n = Number(this.node.config.readReplicas ?? 0)
    return Number.isFinite(n) && n >= 0 ? Math.min(10, Math.floor(n)) : 0
  }

  private get maxConnections(): number {
    const n = Number(this.node.config.maxConnections ?? 100)
    return Number.isFinite(n) ? n : 100
  }

  private getCapacity(): { read: number; write: number; baseLatency: number } {
    const baseQps = INSTANCE_CAPACITY[this.instanceType] ?? 2000
    const [readFactor, writeFactor, baseLat] =
      ENGINE_FACTORS[this.engine] ?? [1, 1, 5]
    const readQps = baseQps * readFactor * (1 + this.readReplicas)
    const writeQps = baseQps * writeFactor
    return { read: readQps, write: writeQps, baseLatency: baseLat }
  }

  maxCapacityQps(): number {
    const override = Number(this.node.config.nodeCapacityRps)
    if (Number.isFinite(override) && override > 0) return override
    const { read, write } = this.getCapacity()
    return (read + write) / 2
  }

  processRequest(loadQps: number, concurrentConnections: number): SimulationState {
    const { read, write, baseLatency } = this.getCapacity()
    const override = Number(this.node.config.nodeCapacityRps)
    const capacity =
      Number.isFinite(override) && override > 0
        ? override
        : read * 0.8 + write * 0.2
    const utilization = capacity > 0 ? loadQps / capacity : 2

    let latency: number
    let errorRate: number
    let isHealthy: boolean

    if (utilization >= 1) {
      latency = baseLatency * 10
      errorRate = Math.min(1, utilization - 1)
      isHealthy = false
    } else {
      latency = baseLatency / Math.sqrt(1 - utilization)
      errorRate = 0
      isHealthy = true
    }

    const maxConns = this.maxConnections
    if (concurrentConnections > maxConns) {
      errorRate += 0.1
      latency += 50
    }

    return {
      cpuUsagePercent: Math.min(100, utilization * 80),
      memoryUsageGb: Math.max(
        0.25,
        Number(this.node.config.storageGB ?? 10) * (0.08 + Math.min(0.22, utilization * 0.18)) +
          concurrentConnections * 0.01
      ),
      latencyMs: latency,
      errorRate: Math.min(1, errorRate),
      isHealthy,
      currentConnections: concurrentConnections,
      throughputQps: loadQps,
    }
  }

  override computeReplicaBreakdown(
    totalQps: number,
    ctx?: ReplicaBreakdownContext
  ): ReplicaMetrics[] {
    const rr = this.readReplicas
    if (rr <= 0) return []
    const { baseLatency } = this.getCapacity()
    const readFrac = Math.max(0, Math.min(1, ctx?.readFraction ?? 0.8))
    const writeFrac = 1 - readFrac
    const totalReadQps = totalQps * readFrac
    const totalWriteQps = totalQps * writeFrac
    const baseQps = INSTANCE_CAPACITY[this.instanceType] ?? 2000
    const [readFactor, writeFactor] =
      ENGINE_FACTORS[this.engine] ?? [1, 1, 5]
    const primaryReadCap = baseQps * readFactor
    const primaryWriteCap = baseQps * writeFactor
    const replicaReadCap = baseQps * readFactor
    // Primary handles all writes + its share of reads
    const readPerNode = totalReadQps / (1 + rr)
    const primaryQps = readPerNode + totalWriteQps
    const primaryCap = primaryReadCap * 0.5 + primaryWriteCap
    const primaryUtil = primaryCap > 0 ? primaryQps / primaryCap : 2
    const primaryLat = primaryUtil >= 1
      ? baseLatency * 10
      : baseLatency / Math.sqrt(1 - primaryUtil)
    const out: ReplicaMetrics[] = [{
      label: 'Primary (R+W)',
      qps: primaryQps,
      cpuPercent: Math.min(100, primaryUtil * 80),
      memoryGb: 0,
      latencyMs: primaryLat,
      errorRate: primaryUtil >= 1 ? Math.min(1, primaryUtil - 1) : 0,
      utilizationPct: Math.min(2, primaryUtil),
    }]
    for (let i = 0; i < rr; i++) {
      const replicaUtil = replicaReadCap > 0 ? readPerNode / replicaReadCap : 2
      const replicaLat = replicaUtil >= 1
        ? baseLatency * 10
        : baseLatency / Math.sqrt(1 - replicaUtil)
      out.push({
        label: `Read Replica ${i + 1}`,
        qps: readPerNode,
        cpuPercent: Math.min(100, replicaUtil * 80),
        memoryGb: 0,
        latencyMs: replicaLat,
        errorRate: replicaUtil >= 1 ? Math.min(1, replicaUtil - 1) : 0,
        utilizationPct: Math.min(2, replicaUtil),
      })
    }
    return out
  }
}
