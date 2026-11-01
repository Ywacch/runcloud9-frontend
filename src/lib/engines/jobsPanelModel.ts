import type { CanvasNode, CanvasSnapshot } from '../../editor-core/stores/canvasStore'
import type { MetaJobsResponse } from '../api'
import { backendEngineOrDefault } from '../backendCapabilities'
import {
  templateJobDefs,
  type TemplateJobDef,
} from './templateJobCatalog'

export interface JobsPanelRow {
  jobId: string
  jobLabel: string
  required: boolean
  /** Node id this job resolves to (explicit or default). */
  nodeId: string | null
  nodeLabel: string | null
  engine: string | null
  explicitBinding: boolean
  candidateNodeIds: string[]
  allowedEngines: readonly string[]
}

function nodeEngine(node: CanvasNode): string {
  return (
    backendEngineOrDefault(node.type, node.config.engine ?? node.config.cacheEngine) ??
    ''
  )
}

function isTimelineStoreCache(node: CanvasNode): boolean {
  if (node.type !== 'cache') return false
  const s = String(node.config.cacheStrategy ?? node.config.strategy ?? '')
  return s === 'timeline-store'
}

function defaultNodeForJob(
  job: TemplateJobDef,
  nodes: CanvasNode[],
): CanvasNode | null {
  const sorted = [...nodes].sort((a, b) => a.id.localeCompare(b.id))
  if (job.id === 'timeline') {
    for (const n of sorted) {
      if (isTimelineStoreCache(n)) return n
    }
    if (job.defaultNodeType === 'cache') {
      return sorted.find((n) => n.type === 'cache') ?? null
    }
    return null
  }
  return sorted.find((n) => n.type === job.defaultNodeType) ?? null
}

function candidatesForJob(job: TemplateJobDef, nodes: CanvasNode[]): string[] {
  const ids: string[] = []
  for (const n of nodes) {
    if (job.id === 'timeline') {
      if (n.type === 'cache' || n.type === 'database') ids.push(n.id)
      continue
    }
    if (job.id === 'work_queue') {
      if (n.type === 'cache' || n.type === 'message_queue') ids.push(n.id)
      continue
    }
    if (n.type === job.defaultNodeType) ids.push(n.id)
  }
  return ids.sort()
}

function resolveNodeId(
  job: TemplateJobDef,
  snapshot: CanvasSnapshot,
  nodes: CanvasNode[],
): { nodeId: string | null; explicit: boolean } {
  const explicit = snapshot.jobBindings?.[job.id]?.trim()
  if (explicit) {
    return { nodeId: explicit, explicit: true }
  }
  const def = defaultNodeForJob(job, nodes)
  return { nodeId: def?.id ?? null, explicit: false }
}

/** Pure view-model for the sidebar jobs panel. */
export function buildJobsPanelModel(
  snapshot: CanvasSnapshot,
  catalog: MetaJobsResponse | null,
): JobsPanelRow[] {
  const defs = templateJobDefs(snapshot.templateId)
  if (defs.length === 0) return []

  const nodes = snapshot.nodes
  const labels = new Map(catalog?.jobs.map((j) => [j.id, j.label]) ?? [])

  return defs.map((job) => {
    const { nodeId, explicit } = resolveNodeId(job, snapshot, nodes)
    const node = nodeId ? nodes.find((n) => n.id === nodeId) : undefined
    return {
      jobId: job.id,
      jobLabel: labels.get(job.id) ?? job.id,
      required: job.required,
      nodeId: nodeId ?? null,
      nodeLabel: node?.label ?? null,
      engine: node ? nodeEngine(node) : null,
      explicitBinding: explicit,
      candidateNodeIds: candidatesForJob(job, nodes),
      allowedEngines: job.allowedEngines,
    }
  })
}

/** Job labels to show on a canvas node badge strip. */
export function jobBadgeLabelsForNode(
  nodeId: string,
  rows: JobsPanelRow[],
): string[] {
  const out: string[] = []
  for (const row of rows) {
    if (row.nodeId === nodeId) out.push(row.jobLabel)
  }
  return out
}
