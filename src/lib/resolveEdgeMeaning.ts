import type { CanvasEdge, CanvasNode } from '../editor-core/stores/canvasStore'
import { withCacheEngineName, type TopologyFlags } from './componentRole'
import {
  canvasTypeToSemantic,
  classifyCanvasEdge,
  type EdgeSemanticResult,
  type SemanticComponentType,
  platformActiveMeaning,
  semanticPairKey,
} from './connectionSemantics'
import { matchesWhen } from './storytellingEngine'
import type { StorytellingSpec } from './storytellingTypes'

/**
 * Template-aware active-edge copy. Prefer storytelling.edges[source->target],
 * then platform defaults, then a generic line.
 */
export function resolveEdgeMeaning(
  source: SemanticComponentType,
  target: SemanticComponentType,
  topology: TopologyFlags,
  storytelling: StorytellingSpec | null | undefined,
): string {
  const key = semanticPairKey(source, target)
  const spec = storytelling?.edges?.[key]
  if (spec) {
    if (spec.variants) {
      for (const v of spec.variants) {
        if (matchesWhen(v.when, topology) && v.label) {
          return v.label
        }
      }
    }
    if (spec.base) return spec.base
  }
  return (
    platformActiveMeaning(source, target) ??
    `Valid ${source} → ${target} connection for this template.`
  )
}

/**
 * Classify an edge for the meaning strip: structural class from connectionSemantics,
 * active message from template storytelling when present.
 */
export function classifyCanvasEdgeMeaning(
  edge: Pick<CanvasEdge, 'id' | 'sourceId' | 'targetId'>,
  nodes: Record<string, CanvasNode>,
  supportsWorker: boolean,
  topology: TopologyFlags,
  storytelling: StorytellingSpec | null | undefined,
): EdgeSemanticResult | null {
  const result = classifyCanvasEdge(edge, nodes, supportsWorker)
  if (!result || result.class !== 'active') return result

  const sourceNode = nodes[edge.sourceId]
  const targetNode = nodes[edge.targetId]
  if (!sourceNode || !targetNode) return result

  const source = canvasTypeToSemantic(sourceNode.type)
  const target = canvasTypeToSemantic(targetNode.type)
  if (!source || source === 'client' || !target || target === 'client') {
    return result
  }

  const cacheNode = [sourceNode, targetNode].find((node) => node.type === 'cache')
  const cacheEngine = cacheNode
    ? String(cacheNode.config.cacheEngine ?? cacheNode.config.engine ?? 'redis')
    : null
  return {
    ...result,
    message: withCacheEngineName(
      resolveEdgeMeaning(source, target, topology, storytelling),
      cacheEngine,
    ),
  }
}
