import {
  backendEngineOrDefault,
  backendSupportsReplicas,
  BACKEND_SUPPORTS_SHARDING,
} from './backendCapabilities'
import { backendComponentToCanvasType, canvasToBackend } from './typeMapping'
import type { CanvasNode, CanvasSnapshot, CanvasEdge } from '../editor-core/stores/canvasStore'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import type { DeploymentDesign, DeploymentHistoryTopology } from './api'
import {
  ensureLoadBalancerForReplicas,
  ensureLoadBalancerForReplicasInSnapshot,
} from './ensureLoadBalancerForReplicas'
import { normalizeReadConsistencyForDeploy } from './readConsistency'
import {
  clampAppServerReplicas,
  clampReadReplicas,
  clampWorkerReplicas,
  lbAlgorithmForDeploy,
  normalizeReplicationModeForDeploy,
} from './replicaConfig'
import { normalizeRedisEvictionPolicy } from './redisEvictionPolicy'
import {
  isProxyOrLegacyCacheStrategy,
} from './cacheTopologyStrategy'
import {
  defaultProxyResourceProfile,
  normalizeProxyInstanceSize,
  redisProfileFromConfig,
} from './cacheProxyResources'
import {
  normalizeWriteBehindIntervalSeconds,
  showsWriteBehindIntervalControl,
} from './writeBehindInterval'
import {
  normalizePurchaseMode,
  templateSupportsPurchaseMode,
  seedEventCapacityFromConfig,
  seedEventNameFromConfig,
} from './purchaseMode'
import { deployCacheTtlSeconds } from './cacheTtl'
import { autoArrangeByDependencyLayers } from './autoArrange'
import { normalizeInstanceSizes } from './instanceSizes'

/**
 * Backend topology validation and env derivation typically read `strategy` on cache
 * nodes. The canvas inspector uses `cacheStrategy`. Keep both in sync on the wire.
 */
export function deployConfigForNode(
  n: CanvasNode,
  templateId?: string | null,
): Record<string, unknown> {
  const config = { ...n.config } as Record<string, unknown>
  // Prelaunch gating: keep payloads minimal and avoid emitting inactive knobs.
  delete config.maxMemory
  delete config.maxMemoryMB
  // evictionPolicy is live — BE maps it to redis --maxmemory-policy (do not strip).
  delete config.durableQueues
  delete config.durable
  delete config.storageSize
  delete config.storageGB
  delete config.maxConnections
  // Sharding is an SVG packing visual; the deployer provisions one instance.
  if (!BACKEND_SUPPORTS_SHARDING) {
    delete config.shards
  }
  const engine = backendEngineOrDefault(n.type, config.engine ?? config.cacheEngine)
  if (engine === undefined) {
    delete config.engine
    delete config.cacheEngine
  } else {
    config.engine = engine
    if (n.type === 'cache') config.cacheEngine = engine
  }
  if (n.type === 'compute') {
    config.replicas = clampAppServerReplicas(config.replicas ?? 1)
    const sizes = normalizeInstanceSizes(config, Number(config.replicas))
    config.instanceSizes = sizes
    config.instanceSize = sizes[0]
    if (templateSupportsPurchaseMode(templateId)) {
      config.purchaseMode = normalizePurchaseMode(config.purchaseMode)
      config.seedEventName = seedEventNameFromConfig(config)
      config.seedEventCapacity = seedEventCapacityFromConfig(config)
    } else {
      delete config.purchaseMode
      delete config.seedEventName
      delete config.seedEventCapacity
    }
  } else if (n.type === 'worker') {
    config.replicas = clampWorkerReplicas(config.replicas ?? 1)
    const sizes = normalizeInstanceSizes(config, Number(config.replicas))
    config.instanceSizes = sizes
    config.instanceSize = sizes[0]
  } else if (n.type === 'database') {
    delete config.replicas
    const readReplicas = clampReadReplicas(config.readReplicas)
    config.readReplicas = readReplicas
    const sizes = normalizeInstanceSizes(config, 1 + readReplicas)
    config.instanceSizes = sizes
    config.instanceSize = sizes[0]
    config.replicationMode = normalizeReplicationModeForDeploy(
      config.replicationMode,
      readReplicas,
    )
    config.readConsistency = normalizeReadConsistencyForDeploy(
      config.readConsistency,
      readReplicas,
    )
  } else if (!backendSupportsReplicas(n.type)) {
    // Force single instance on the wire; SVG packing may still show multi-unit demos.
    delete config.replicas
    delete config.readReplicas
  }
  if (n.type === 'load_balancer') {
    const algo = lbAlgorithmForDeploy(config.algorithm ?? config.lbAlgorithm)
    config.lbAlgorithm = algo
    config.algorithm = algo
    config.weightByInstanceSize = Boolean(config.weightByInstanceSize)
    const n = Math.floor(Number(config.rateLimitPerIp ?? 0))
    config.rateLimitPerIp =
      Number.isFinite(n) && n > 0 ? Math.min(100, n) : 0
  }
  if (n.type === 'cache') {
    const strat = String(
      config.cacheStrategy ?? config.strategy ?? 'cache-aside',
    )
    config.cacheStrategy = strat
    config.strategy = strat
    config.evictionPolicy = normalizeRedisEvictionPolicy(config.evictionPolicy)

    // Sync instanceSize ↔ resourceProfile (BE normalize also does this).
    const redisSize =
      String(config.resourceProfile ?? '').trim() ||
      String(config.instanceSize ?? '').trim() ||
      'small'
    config.instanceSize = redisSize
    config.resourceProfile = redisSize

    if (isProxyOrLegacyCacheStrategy(strat)) {
      // Sync proxyInstanceSize ↔ proxyResourceProfile; default from Redis size.
      const explicit =
        String(config.proxyResourceProfile ?? '').trim() ||
        String(config.proxyInstanceSize ?? '').trim()
      const proxySize = explicit
        ? normalizeProxyInstanceSize(explicit)
        : defaultProxyResourceProfile(redisProfileFromConfig(config))
      config.proxyInstanceSize = proxySize
      config.proxyResourceProfile = proxySize
    } else {
      delete config.proxyInstanceSize
      delete config.proxyResourceProfile
    }

    // URL-shortener write-behind only — omit inactive/unsupported values on the wire.
    if (showsWriteBehindIntervalControl(templateId, strat)) {
      config.writeBehindIntervalSeconds = normalizeWriteBehindIntervalSeconds(
        config.writeBehindIntervalSeconds,
      )
    } else {
      delete config.writeBehindIntervalSeconds
    }

    // Cache-node-owned TTL; omit when missing/invalid so BE uses the image default.
    const ttl = deployCacheTtlSeconds(config.cacheTtlSeconds)
    if (ttl === undefined) {
      delete config.cacheTtlSeconds
    } else {
      config.cacheTtlSeconds = ttl
    }
  }
  return config
}

export function snapshotToDeploymentDesign(
  snapshot: CanvasSnapshot,
  opts?: { sessionMinutes?: number; mutateCanvas?: boolean },
): DeploymentDesign {
  if (opts?.mutateCanvas === false) {
    snapshot = ensureLoadBalancerForReplicasInSnapshot(snapshot)
  } else {
    ensureLoadBalancerForReplicas()
    snapshot = useCanvasStore.getState().exportJSON()
  }
  const clientIds = new Set(
    snapshot.nodes.filter((n) => n.type === 'client').map((n) => n.id),
  )
  const nodes = snapshot.nodes
    .filter((n) => n.type !== 'client')
    .map((n) => ({
      id: n.id,
      type: canvasToBackend[n.type],
      name: n.label,
      config: deployConfigForNode(n, snapshot.templateId),
      position: [...n.position] as [number, number, number],
    }))
  const connections = snapshot.edges
    .filter(
      (e) => !clientIds.has(e.sourceId) && !clientIds.has(e.targetId),
    )
    .map((e) => ({
      sourceId: e.sourceId,
      targetId: e.targetId,
      protocol: e.protocol,
    }))
  if (!snapshot.templateId?.trim()) {
    throw new Error('no template selected')
  }
  const design: DeploymentDesign = {
    version: snapshot.version,
    template: snapshot.templateId,
    archetype: 'standard',
    nodes,
    connections,
  }
  if (opts?.sessionMinutes != null) {
    design.sessionMinutes = opts.sessionMinutes
  }
  return design
}

export function deploymentDesignToSnapshot(
  design: DeploymentDesign,
  templateId: string
): CanvasSnapshot {
  const now = new Date().toISOString()

  let nodes: CanvasNode[] = design.nodes.map((n) => {
    const type = backendComponentToCanvasType[n.type] ?? 'compute'
    const raw = { ...n.config } as Record<string, unknown>
    if (type === 'cache' && raw.cacheStrategy == null && raw.strategy != null) {
      raw.cacheStrategy = raw.strategy
    }
    const hasPosition =
      Array.isArray(n.position) &&
      n.position.length === 3 &&
      n.position.every((v) => Number.isFinite(v))
    return {
      id: n.id,
      type,
      position: hasPosition
        ? [n.position![0], n.position![1], n.position![2]]
        : [0, 0.3, 0],
      label: n.name || n.id,
      config: raw,
      status: 'idle',
    }
  })

  const edges: CanvasEdge[] = design.connections.map((c, idx) => ({
    id: `edge-${idx}`,
    sourceId: c.sourceId,
    targetId: c.targetId,
    protocol: c.protocol === 'tcp' ? 'tcp' : 'http',
    animated: false,
  }))

  const needsArrange = design.nodes.some(
    (n) =>
      !Array.isArray(n.position) ||
      n.position.length !== 3 ||
      !n.position.every((v) => Number.isFinite(v)),
  )
  if (needsArrange && nodes.length > 0) {
    const arranged = autoArrangeByDependencyLayers(nodes, edges)
    nodes = nodes.map((node) => ({
      ...node,
      position: arranged[node.id] ?? node.position,
    }))
  }

  return {
    version: '1.0',
    templateId,
    nodes,
    edges,
    exportedAt: now,
  }
}

export function historyTopologyToSnapshot(
  topology: DeploymentHistoryTopology,
  templateId: string,
): CanvasSnapshot {
  const design: DeploymentDesign = {
    version: '1.0',
    template: templateId,
    archetype: 'standard',
    nodes: topology.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      name: n.id,
      config: {},
      position: n.position,
    })),
    connections: topology.connections,
  }
  return deploymentDesignToSnapshot(design, templateId)
}
