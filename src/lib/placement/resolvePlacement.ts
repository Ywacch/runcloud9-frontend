import type { CanvasNode } from '../../editor-core/stores/canvasStore'
import { backendEngineOrDefault } from '../backendCapabilities'
import {
  resolvedJobNodeIds,
} from '../engines/jobsPanelModel'
import { canvasToBackend } from '../typeMapping'
import { JOB_COMPONENTS } from './jobComponents'
import type { PlacementJob, PlacementNode, PlacementTopology } from './types'

export interface ResolvePlacementInput {
  templateId: string
  nodes: CanvasNode[]
  jobBindings?: Record<string, string> | null
  jobComponents?: Record<string, string>
}

function nodeEngine(node: CanvasNode): string {
  return (
    backendEngineOrDefault(node.type, node.config.engine ?? node.config.cacheEngine) ??
    ''
  )
}

/** Design-mode resolver: jobs and node types only; members stay empty. */
export function resolvePlacement(input: ResolvePlacementInput): PlacementTopology {
  const components = input.jobComponents ?? JOB_COMPONENTS
  const resolved = resolvedJobNodeIds(input.templateId, input.nodes, input.jobBindings)
  const jobsOnNode: Record<string, number> = {}
  for (const nodeId of Object.values(resolved)) {
    jobsOnNode[nodeId] = (jobsOnNode[nodeId] ?? 0) + 1
  }

  const nodeJobs: Record<string, string[]> = {}
  for (const [job, nodeId] of Object.entries(resolved)) {
    if (!nodeJobs[nodeId]) nodeJobs[nodeId] = []
    nodeJobs[nodeId].push(job)
  }
  for (const id of Object.keys(nodeJobs)) {
    nodeJobs[id].sort()
  }

  const sorted = [...input.nodes].sort((a, b) => a.id.localeCompare(b.id))
  const nodes: PlacementNode[] = sorted.map((n) => ({
    nodeId: n.id,
    nodeType: canvasToBackend[n.type] ?? n.type,
    engine: nodeEngine(n) || undefined,
    members: [],
    jobs: nodeJobs[n.id] ? [...nodeJobs[n.id]] : undefined,
  }))

  const jobs: PlacementJob[] = Object.entries(resolved)
    .map(([job, nodeId]) => {
      const node = input.nodes.find((n) => n.id === nodeId)
      return {
        job,
        component: components[job] ?? '',
        nodeId,
        engine: node ? nodeEngine(node) : '',
        shared: jobsOnNode[nodeId] > 1,
        explicit: Boolean(input.jobBindings?.[job]?.trim()),
      }
    })
    .sort((a, b) => a.job.localeCompare(b.job))

  return { nodes, jobs }
}

export function placementForView(
  backend: PlacementTopology | undefined,
  design: PlacementTopology,
): PlacementTopology {
  return backend ?? design
}

export function componentsOnNode(topo: PlacementTopology, nodeId: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const j of topo.jobs) {
    if (j.nodeId !== nodeId) continue
    if (seen.has(j.component)) continue
    seen.add(j.component)
    out.push(j.component)
  }
  return out.sort()
}

export function nodeForComponent(
  topo: PlacementTopology,
  alias: string,
): PlacementNode | undefined {
  const job = topo.jobs.find((j) => j.component === alias)
  if (!job) return undefined
  return topo.nodes.find((n) => n.nodeId === job.nodeId)
}

/** True when only work_queue sits on this cache node (Redis Streams layout). */
export function isQueueOnlyNode(
  nodeId: string,
  templateId: string | null | undefined,
  nodes: CanvasNode[],
  jobBindings?: Record<string, string> | null,
): boolean {
  const resolved = resolvedJobNodeIds(templateId, nodes, jobBindings)
  if (resolved.work_queue !== nodeId) return false
  if (resolved.timeline === nodeId || resolved.hot_cache === nodeId) return false
  const node = nodes.find((n) => n.id === nodeId)
  if (!node || node.type !== 'cache') return false
  const eng = String(node.config.cacheEngine ?? node.config.engine ?? '')
    .trim()
    .toLowerCase()
  return eng === '' || eng === 'redis'
}