import type { CanvasNode } from '../../../store/canvasStore'
import { ComponentModel } from '../ComponentModel'
import type { SimulationState } from '../types'

const BASE_CAPACITY_PER_PARTITION = 2000

export class MessageQueueModel extends ComponentModel {
  constructor(node: CanvasNode) {
    super(node)
  }

  private get partitions(): number {
    const n = Number(this.node.config.partitions ?? 4)
    return Number.isFinite(n) && n > 0 ? Math.min(32, Math.floor(n)) : 4
  }

  private get capacityMultiplier(): number {
    return 1
  }

  maxCapacityQps(): number {
    const override = Number(this.node.config.nodeCapacityRps)
    if (Number.isFinite(override) && override > 0) return override
    return BASE_CAPACITY_PER_PARTITION * this.partitions * this.capacityMultiplier
  }

  processRequest(loadQps: number, concurrentConnections: number): SimulationState {
    const capacity = this.maxCapacityQps()
    const utilization = capacity > 0 ? loadQps / capacity : 2
    const baseLatency = 3

    let latency: number
    let errorRate: number
    let isHealthy: boolean

    if (utilization > 1) {
      latency = baseLatency * 5
      errorRate = Math.min(1, utilization - 1)
      isHealthy = false
    } else {
      latency = baseLatency * (1 + utilization * 0.5)
      errorRate = 0
      isHealthy = true
    }

    return {
      cpuUsagePercent: Math.min(100, utilization * 75),
      memoryUsageGb: Math.max(
        0.1,
        loadQps * (0.000015 + utilization * 0.00002) +
          concurrentConnections * 0.00012
      ),
      latencyMs: latency,
      errorRate,
      isHealthy,
      currentConnections: concurrentConnections,
      throughputQps: loadQps,
    }
  }
}
