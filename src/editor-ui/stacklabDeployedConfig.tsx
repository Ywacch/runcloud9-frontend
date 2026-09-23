import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { isProxyCacheStrategy } from '../lib/cacheTopologyStrategy'
import { fmtCpuMilliCores, fmtMemMB } from '../lib/format'
import { lbConnectedComputeNodes } from '../lib/lbInspectorMetrics'
import { normalizeRedisEvictionPolicy } from '../lib/redisEvictionPolicy'
import { getResourceProfilesCached } from '../lib/resourceProfileStore'
import {
  clampAppServerReplicas,
  clampReadReplicas,
  clampWorkerReplicas,
  lbAlgorithmForDeploy,
  replicationModeFromConfig,
} from '../lib/replicaConfig'
import {
  formatProvisionedShort,
  resolveProvisionedLimits,
} from '../lib/resolveProvisionedLimits'
import { compactPodName } from '../lib/replicaMetricsDisplay'
import { normalizeWriteBehindIntervalSeconds } from '../lib/writeBehindInterval'
import { SlKv, SlKvList } from './stacklabPanePrimitives'

export type DeployedConfigRow = {
  key: string
  value: string
  tone?: string
}

function targets(
  nodeId: string,
  edges: Record<string, CanvasEdge>,
  nodes: Record<string, CanvasNode>,
  type?: CanvasNode['type'],
): CanvasNode[] {
  return Object.values(edges)
    .filter((edge) => edge.sourceId === nodeId)
    .map((edge) => nodes[edge.targetId])
    .filter((node): node is CanvasNode => Boolean(node) && (!type || node.type === type))
}

function sources(
  nodeId: string,
  edges: Record<string, CanvasEdge>,
  nodes: Record<string, CanvasNode>,
  type?: CanvasNode['type'],
): CanvasNode[] {
  return Object.values(edges)
    .filter((edge) => edge.targetId === nodeId)
    .map((edge) => nodes[edge.sourceId])
    .filter((node): node is CanvasNode => Boolean(node) && (!type || node.type === type))
}

function serviceSlug(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, '-')
}

function replicaLine(m?: MetricsBucket, count = 1): string {
  const pods = m?.podReplicas ?? []
  if (pods.length > 0) {
    const names = pods.map((pod) => compactPodName(pod.name) || pod.name).join(', ')
    return `${pods.length} · ${names}`
  }
  if (count <= 1) return '1'
  const names = Array.from({ length: count }, (_, i) => `roll-${String.fromCharCode(97 + i)}`).join(
    ', ',
  )
  return `${count} · ${names}`
}

function provisionedShort(node: CanvasNode): string {
  return formatProvisionedShort(
    resolveProvisionedLimits(node.type, node.config, getResourceProfilesCached()),
  )
}

function cpuLimitLine(node: CanvasNode, m?: MetricsBucket): string {
  if (m && m.cpuLimit > 0) {
    return m.cpuLimit >= 1 ? `${m.cpuLimit} vCPU` : fmtCpuMilliCores(m.cpuLimit)
  }
  return provisionedShort(node).split(' · ')[0] ?? '—'
}

function memLimitLine(node: CanvasNode, m?: MetricsBucket): string {
  if (m && m.memoryLimit > 0) return fmtMemMB(m.memoryLimit)
  const parts = provisionedShort(node).split(' · ')
  return parts[1] ?? '—'
}

function lbAlgorithmLabel(raw: unknown): string {
  const algo = lbAlgorithmForDeploy(raw)
  return algo.replace(/_/g, '-')
}

export function deployedConfigRows(
  node: CanvasNode,
  nodes: Record<string, CanvasNode>,
  edges: Record<string, CanvasEdge>,
  m?: MetricsBucket,
): DeployedConfigRow[] {
  const c = node.config

  switch (node.type) {
    case 'compute': {
      const replicas = clampAppServerReplicas(c.replicas ?? 1)
      const cache = targets(node.id, edges, nodes, 'cache')[0]
      const db = targets(node.id, edges, nodes, 'database')[0]
      const rows: DeployedConfigRow[] = [
        { key: 'replicas', value: replicaLine(m, replicas) },
        { key: 'cpu limit', value: cpuLimitLine(node, m) },
        { key: 'mem limit', value: memLimitLine(node, m) },
      ]
      const maxConn = m?.maxConnections || Number(c.maxConnections ?? 0)
      if (maxConn > 0) rows.push({ key: 'max conns', value: String(maxConn) })
      if (cache) {
        rows.push({
          key: 'upstream cache',
          value: `redis://${serviceSlug(cache.label)}:6379`,
        })
      }
      if (db) {
        rows.push({ key: 'store', value: `postgres://${serviceSlug(db.label)}:5432` })
      }
      return rows
    }

    case 'database': {
      const readReplicas = clampReadReplicas(c.readReplicas)
      const mode = replicationModeFromConfig(c.replicationMode)
      const rows: DeployedConfigRow[] = [
        {
          key: 'topology',
          value:
            readReplicas > 0
              ? `1 primary + ${readReplicas} read replica${readReplicas > 1 ? 's' : ''}`
              : 'single primary',
        },
        { key: 'cpu limit', value: cpuLimitLine(node, m) },
        { key: 'memory', value: memLimitLine(node, m) },
      ]
      const maxConn = m?.maxConnections || Number(c.maxConnections ?? 0)
      if (maxConn > 0) rows.push({ key: 'max connections', value: String(maxConn) })
      if (readReplicas > 0) {
        rows.push({ key: 'replica sync', value: `${mode} · replica-1` })
      }
      return rows
    }

    case 'cache': {
      const strategy = String(m?.cacheStrategy ?? c.cacheStrategy ?? 'cache-aside').trim()
      const policy = normalizeRedisEvictionPolicy(c.evictionPolicy)
      const clients = sources(node.id, edges, nodes, 'compute')
      const rows: DeployedConfigRow[] = [
        { key: 'strategy', value: strategy },
      ]
      if (isProxyCacheStrategy(strategy)) {
        rows.push({ key: 'sync mode', value: 'async' })
        const interval = normalizeWriteBehindIntervalSeconds(c.writeBehindIntervalSeconds)
        rows.push({
          key: 'flush mode',
          value: strategy === 'write-behind' ? `batch · every ${interval} s` : 'inline',
        })
      }
      rows.push(
        { key: 'maxmemory', value: memLimitLine(node, m) },
        { key: 'policy', value: policy },
      )
      if (clients.length > 0) {
        rows.push({
          key: 'client',
          value: `${clients.map((client) => client.label).join(', ')} pool`,
        })
      }
      return rows
    }

    case 'message_queue': {
      const workers = targets(node.id, edges, nodes, 'worker')
      const queueName = String(c.queueName ?? 'orders').trim() || 'orders'
      const durable = c.queueDurable !== false
      const rows: DeployedConfigRow[] = [
        { key: 'queue', value: `${queueName} · ${durable ? 'durable' : 'transient'}` },
        { key: 'broker memory', value: memLimitLine(node, m) },
      ]
      const prefetch = Number(c.workerPrefetch ?? m?.workerSaturation ?? 0)
      if (prefetch > 0) rows.push({ key: 'prefetch', value: String(Math.round(prefetch)) })
      rows.push({ key: 'ack mode', value: 'manual · batch' })
      if (workers.length > 0) {
        rows.push({
          key: 'consumers',
          value: workers.map((worker) => `${worker.label} ×1`).join(', '),
        })
      }
      return rows
    }

    case 'worker': {
      const replicas = clampWorkerReplicas(c.replicas ?? 1)
      const mq = sources(node.id, edges, nodes, 'message_queue')[0]
      const rows: DeployedConfigRow[] = [
        { key: 'replicas', value: replicaLine(m, replicas) },
        { key: 'cpu limit', value: cpuLimitLine(node, m) },
        { key: 'mem limit', value: memLimitLine(node, m) },
      ]
      const prefetch = Number(c.workerPrefetch ?? 0)
      if (prefetch > 0) rows.push({ key: 'prefetch', value: String(prefetch) })
      const concurrency = Number(c.workerConcurrency ?? 0)
      if (concurrency > 0) rows.push({ key: 'concurrency', value: String(concurrency) })
      if (mq) {
        rows.push({
          key: 'upstream',
          value: `rabbit://${serviceSlug(mq.label)}:5672`,
        })
      }
      return rows
    }

    case 'load_balancer': {
      const backends = lbConnectedComputeNodes(node.id, edges, nodes)
      const backendLabels = backends.map((backend) => backend.label).join(', ')
      const rows: DeployedConfigRow[] = [
        { key: 'algorithm', value: lbAlgorithmLabel(c.algorithm ?? c.lbAlgorithm) },
      ]
      if (backendLabels) rows.push({ key: 'backends', value: backendLabels })
      const maxConn =
        m && m.lbConnectionLimit > 0 ? m.lbConnectionLimit : Number(c.maxConnections ?? 1024)
      if (maxConn > 0) rows.push({ key: 'max connections', value: String(maxConn) })
      rows.push(
        { key: 'health check', value: 'GET /healthz · 2 s · 3 fail threshold' },
        { key: 'keep-alive', value: '60 s' },
      )
      return rows
    }

    default:
      return []
  }
}

export function StacklabDeployedConfig({
  node,
  nodes,
  edges,
  metrics,
}: {
  node: CanvasNode
  nodes: Record<string, CanvasNode>
  edges: Record<string, CanvasEdge>
  metrics?: MetricsBucket
}) {
  const rows = deployedConfigRows(node, nodes, edges, metrics)
  if (rows.length === 0) {
    return (
      <p className="note">
        <b>i</b>No effective config to show for this component.
      </p>
    )
  }
  return (
    <SlKvList flush>
      {rows.map((row) => (
        <SlKv key={row.key} keyLabel={row.key} value={row.value} tone={row.tone} />
      ))}
    </SlKvList>
  )
}
