import type { CanvasNode } from '../editor-core/stores/canvasStore'
import { isProxyOrLegacyCacheStrategy } from './cacheTopologyStrategy'
import type { TopologyLimits } from './userTier'

export interface TopologyViolation {
  kind: 'load_balancer' | 'async' | 'replicas' | 'proxy_cache'
  message: string
}

function cacheStrategyForNode(node: CanvasNode): string {
  return String(node.config.cacheStrategy ?? node.config.strategy ?? 'cache-aside')
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
        message: 'Load balancers need Engineer. Remove them or upgrade.',
      })
    }
    if (
      (node.type === 'message_queue' || node.type === 'worker') &&
      !limits.allowMQWorker
    ) {
      violations.push({
        kind: 'async',
        message:
          'Message queues and workers need Engineer. Remove them or upgrade.',
      })
    }
    if (node.type === 'cache' && !limits.allowProxyCache) {
      const strategy = cacheStrategyForNode(node)
      if (isProxyOrLegacyCacheStrategy(strategy)) {
        violations.push({
          kind: 'proxy_cache',
          message:
            'That cache strategy needs Engineer. Use cache-aside or timeline-store, or upgrade.',
        })
      }
    }
    if (node.type === 'compute') {
      const replicas = Math.floor(Number(node.config.replicas ?? 1))
      if (
        limits.maxAppServerReplicas > 0 &&
        replicas > limits.maxAppServerReplicas
      ) {
        violations.push({
          kind: 'replicas',
          message: `Your plan allows ${limits.maxAppServerReplicas} App Server replicas. Lower the count or upgrade.`,
        })
      }
    }
  }
  return violations
}
