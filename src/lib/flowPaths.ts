import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import type { MetricsBucket } from '../editor-core/stores/metricsStore'
import { classifyEdges, type EdgeSemantics } from '../editor-core/domain/simulation/TopologyInference'
import type { SimNodeInspector } from '../editor-core/domain/simulation/types'

export interface FlowHop {
  nodeId: string
  label: string
  type: CanvasNode['type']
  incomingEdgeId?: string
  edgeSemantics?: EdgeSemantics
  qps: number
  latencyMs: number
  errorRate: number
  note?: string
}

export interface FlowPath {
  id: string
  name: string
  hops: FlowHop[]
  totalLatencyMs: number
  asyncContinuation: boolean
}

interface WalkState {
  nodeId: string
  incomingEdgeId?: string
  edgeSemantics?: EdgeSemantics
  qpsOverride?: number
  note?: string
  hops: FlowHop[]
  asyncContinuation: boolean
  variants: Set<string>
}

function nodeQps(
  nodeId: string,
  metrics: Record<string, MetricsBucket>,
  inspector: Record<string, SimNodeInspector>,
  override?: number
): number {
  if (override != null) return Math.max(0, override)
  const s = inspector[nodeId]
  if (s?.ingressQps != null) return Math.max(0, s.ingressQps)
  if (s?.servedQps != null) return Math.max(0, s.servedQps)
  return Math.max(0, metrics[nodeId]?.requestRate ?? 0)
}

function buildHop(
  node: CanvasNode,
  metrics: Record<string, MetricsBucket>,
  inspector: Record<string, SimNodeInspector>,
  state: WalkState
): FlowHop {
  const m = metrics[node.id]
  return {
    nodeId: node.id,
    label: node.label,
    type: node.type,
    incomingEdgeId: state.incomingEdgeId,
    edgeSemantics: state.edgeSemantics,
    qps: nodeQps(node.id, metrics, inspector, state.qpsOverride),
    latencyMs: Math.max(0, m?.p99Latency ?? 0),
    errorRate: Math.max(0, m?.errorRate ?? 0),
    note: state.note,
  }
}

function pathName(variants: Set<string>, index: number): string {
  if (variants.has('cache-hit')) return 'Read path (cache hit)'
  if (variants.has('cache-miss')) return 'Read path (cache miss)'
  if (variants.has('async')) return 'Async path'
  return `Path ${index}`
}

export function buildFlowPaths(
  nodesById: Record<string, CanvasNode>,
  edgesById: Record<string, CanvasEdge>,
  metrics: Record<string, MetricsBucket>,
  inspector: Record<string, SimNodeInspector>
): FlowPath[] {
  const nodes = Object.values(nodesById)
  const edges = Object.values(edgesById)
  if (nodes.length === 0) return []

  const adjacency = new Map<string, CanvasEdge[]>()
  const reverseAdj = new Map<string, CanvasEdge[]>()
  for (const e of edges) {
    const arr = adjacency.get(e.sourceId) ?? []
    arr.push(e)
    adjacency.set(e.sourceId, arr)
    const rev = reverseAdj.get(e.targetId) ?? []
    rev.push(e)
    reverseAdj.set(e.targetId, rev)
  }
  const semantics = classifyEdges(nodes, edges)
  const sinkPaths: { hops: FlowHop[]; asyncContinuation: boolean; variants: Set<string> }[] = []
  const maxDepth = nodes.length + 4

  const visit = (state: WalkState, visited: Set<string>) => {
    const node = nodesById[state.nodeId]
    if (!node) return

    const hop = buildHop(node, metrics, inspector, state)
    const hops = [...state.hops, hop]
    const nextEdges = adjacency.get(node.id) ?? []

    if (nextEdges.length === 0 || hops.length > maxDepth) {
      sinkPaths.push({
        hops,
        asyncContinuation: state.asyncContinuation,
        variants: new Set(state.variants),
      })
      return
    }

    for (const edge of nextEdges) {
      const target = nodesById[edge.targetId]
      if (!target) continue
      if (visited.has(target.id)) {
        sinkPaths.push({
          hops,
          asyncContinuation: state.asyncContinuation,
          variants: new Set(state.variants),
        })
        continue
      }
      const sem = semantics.get(edge.id) ?? 'passthrough-compute'

      if (sem === 'load-distribute') {
        const split = inspector[node.id]?.backendSplit?.find((b) => b.nodeId === target.id)
        visit(
          {
            nodeId: target.id,
            incomingEdgeId: edge.id,
            edgeSemantics: sem,
            qpsOverride: split?.qps,
            hops,
            asyncContinuation: state.asyncContinuation,
            variants: new Set(state.variants),
          },
          new Set(visited).add(target.id)
        )
        continue
      }

      if (sem === 'absorb-on-hit') {
        const cacheStats = inspector[target.id]
        const hitQps = Math.max(0, cacheStats?.cacheHitsQps ?? 0)
        const missQps = Math.max(0, cacheStats?.cacheMissesQps ?? 0)

        sinkPaths.push({
          hops: [
            ...hops,
            buildHop(target, metrics, inspector, {
              nodeId: target.id,
              incomingEdgeId: edge.id,
              edgeSemantics: sem,
              qpsOverride: hitQps,
              note: 'Cache hit response served here.',
              hops: [],
              asyncContinuation: state.asyncContinuation,
              variants: new Set(state.variants),
            }),
          ],
          asyncContinuation: state.asyncContinuation,
          variants: new Set(state.variants).add('cache-hit'),
        })

        visit(
          {
            nodeId: target.id,
            incomingEdgeId: edge.id,
            edgeSemantics: sem,
            qpsOverride: missQps,
            note: 'Cache miss; request continues to downstream data store.',
            hops,
            asyncContinuation: state.asyncContinuation,
            variants: new Set(state.variants).add('cache-miss'),
          },
          new Set(visited).add(target.id)
        )
        continue
      }

      if (sem === 'async-decouple' && target.type === 'message_queue') {
        sinkPaths.push({
          hops: [
            ...hops,
            buildHop(target, metrics, inspector, {
              nodeId: target.id,
              incomingEdgeId: edge.id,
              edgeSemantics: sem,
              note: 'Request is enqueued; synchronous path ends.',
              hops: [],
              asyncContinuation: state.asyncContinuation,
              variants: new Set(state.variants),
            }),
          ],
          asyncContinuation: state.asyncContinuation,
          variants: new Set(state.variants),
        })

        visit(
          {
            nodeId: target.id,
            incomingEdgeId: edge.id,
            edgeSemantics: sem,
            note: 'Async worker processing continuation.',
            hops,
            asyncContinuation: true,
            variants: new Set(state.variants).add('async'),
          },
          new Set(visited).add(target.id)
        )

        // Dependency-direction canonical edges may be worker -> mq.
        // Continue async path from queue to its worker dependents (incoming worker edges).
        const incoming = reverseAdj.get(target.id) ?? []
        for (const inEdge of incoming) {
          const worker = nodesById[inEdge.sourceId]
          if (!worker || worker.type !== 'worker') continue
          if (visited.has(worker.id)) continue
          visit(
            {
              nodeId: worker.id,
              incomingEdgeId: inEdge.id,
              edgeSemantics: sem,
              note: 'Async worker processing continuation.',
              hops: [...hops, buildHop(target, metrics, inspector, {
                nodeId: target.id,
                incomingEdgeId: edge.id,
                edgeSemantics: sem,
                note: 'Request is enqueued; synchronous path ends.',
                hops: [],
                asyncContinuation: state.asyncContinuation,
                variants: new Set(state.variants),
              })],
              asyncContinuation: true,
              variants: new Set(state.variants).add('async'),
            },
            new Set(visited).add(target.id).add(worker.id)
          )
        }
        continue
      }

      visit(
        {
          nodeId: target.id,
          incomingEdgeId: edge.id,
          edgeSemantics: sem,
          hops,
          asyncContinuation: state.asyncContinuation,
          variants: new Set(state.variants),
        },
        new Set(visited).add(target.id)
      )
    }
  }

  const clients = nodes.filter((n) => n.type === 'client')
  const roots = nodes.filter(
    (n) => !edges.some((e) => e.targetId === n.id && n.type !== 'client')
  )
  const seeds = clients.length > 0 ? clients : roots

  for (const seed of seeds) {
    visit(
      {
        nodeId: seed.id,
        hops: [],
        asyncContinuation: false,
        variants: new Set(),
      },
      new Set([seed.id])
    )
  }

  const unique = sinkPaths.filter((p, idx, arr) => {
    const sig = p.hops.map((h) => h.nodeId).join('>')
    return arr.findIndex((x) => x.hops.map((h) => h.nodeId).join('>') === sig) === idx
  })

  return unique.map((p, idx) => ({
    id: `flow-${idx + 1}`,
    name: pathName(p.variants, idx + 1),
    totalLatencyMs: p.hops.reduce((sum, hop) => sum + hop.latencyMs, 0),
    asyncContinuation: p.asyncContinuation,
    hops: p.hops,
  }))
}
