import type { CanvasNode } from '../editor-core/stores/canvasStore'
import type { TopologyLimits } from './userTier'

export interface TopologyViolation {
  kind: 'load_balancer' | 'async' | 'replicas'
  message: string
}

/** Client-side preview of deployer.ValidateTierTopology for free-tier guardrails. */
export function findTopologyViolations(
  nodes: Record<string, CanvasNode>,
  limits: TopologyLimits,
): TopologyViolation[] {
  const violations: TopologyViolation[] = []
  for (const node of Object.values(nodes)) {
    if (node.type === 'load_balancer' && !limits.allowLoadBalancer) {
      violations.push({
        kind: 'load_balancer',
        message:
          'Load balancers require an Engineer subscription — remove the load balancer or upgrade.',
      })
    }
    if (
      (node.type === 'message_queue' || node.type === 'worker') &&
      !limits.allowMQWorker
    ) {
      violations.push({
        kind: 'async',
        message:
          'Message queues and workers require an Engineer subscription — remove async components or upgrade.',
      })
    }
    if (node.type === 'compute') {
      const replicas = Math.floor(Number(node.config.replicas ?? 1))
      if (
        limits.maxAppServerReplicas > 0 &&
        replicas > limits.maxAppServerReplicas
      ) {
        violations.push({
          kind: 'replicas',
          message: `App server replicas (${replicas}) exceed your plan limit of ${limits.maxAppServerReplicas} — reduce replicas or upgrade.`,
        })
      }
    }
  }
  return violations
}
