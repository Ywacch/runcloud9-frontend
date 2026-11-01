import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { composeGlyph } from '../compose/composeGlyph'
import { resolveDisplayUnits } from '../compose/resolveDisplayUnits'
import { useReducedMotion } from '../fx/reducedMotion'
import { getDragLive, subscribeDragLive } from '../store/dragLiveStore'
import { useExpanded } from '../store/expandStore'
import {
  motionKeyForNode,
  retarget,
  subscribeUnitMotion,
  type MotionUnit,
} from '../store/unitMotionStore'
import { resolveSkin } from '../skins/engineSkins'
import type { SvgNode } from '../store/svgTypes'
import type { HealthVisualState } from '../../canvas/utils/healthVisual'
import { useCanvasStore } from '../../editor-core/stores/canvasStore'
import { useChaosStore } from '../../editor-core/stores/chaosStore'
import { useMetricsStore } from '../../editor-core/stores/metricsStore'
import { sortedCanvasInstanceIds } from '../../lib/canvasInstanceScope'
import { ClientLoadgenGlyph } from './ClientLoadgenGlyph'
import { RedisBrandGlyph } from './RedisBrandGlyph'
import { SpriteBackedGlyph } from './SpriteBackedGlyph'

type NodeGlyphProps = {
  node: SvgNode
  x: number
  y: number
  selected?: boolean
  interactive?: boolean
  healthVisual?: HealthVisualState
  onPointerDown?: (e: ReactPointerEvent<SVGGElement>) => void
  onPointerEnter?: (e: ReactPointerEvent<SVGGElement>) => void
  onPointerLeave?: (e: ReactPointerEvent<SVGGElement>) => void
  onUnitPointerDown?: (unitIndex: number, e: ReactPointerEvent<SVGGElement>) => void
  onUnitPointerEnter?: (unitIndex: number) => void
  onUnitPointerLeave?: (unitIndex: number) => void
}

function motionUnitsFromKey(key: string, fallback: MotionUnit[]): MotionUnit[] {
  if (!key) return fallback
  return key.split('|').filter(Boolean).map((part) => {
    const colon = part.indexOf(':')
    const id = part.slice(0, colon)
    const [dx, dy, opacity, scale, leaving] = part.slice(colon + 1).split(',').map(Number)
    return { id, dx, dy, opacity, scale, leaving: leaving === 1 }
  })
}

function NodeGlyphInner({
  node,
  x,
  y,
  selected,
  interactive,
  healthVisual,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onUnitPointerDown,
  onUnitPointerEnter,
  onUnitPointerLeave,
}: NodeGlyphProps) {
  const canvasMode = useCanvasStore((s) => s.mode)
  const canvasNode = useCanvasStore((s) => s.nodes[node.id])
  const nodeMetrics = useMetricsStore((s) => s.metrics[node.id])
  const podKillActive = useChaosStore((s) => {
    const active = s.active
    if (!active || active.scenario !== 'pod_kill') return false
    if (node.archetype === 'app-server') return s.isTargetActive('app-server')
    if (node.archetype === 'worker') return s.isTargetActive('worker')
    return false
  })
  const chaosUnitIds = (nodeMetrics?.podReplicas ?? [])
    .filter((pod) => pod.ready === false)
    .map((pod) => pod.name)
  const stableHealthRim = canvasMode === 'live'
  const skin = resolveSkin(node.archetype, node.engine)
  const expanded = useExpanded(node)
  const chaosProps = {
    chaosWholeStack: podKillActive && !expanded,
    perUnitChaos: podKillActive && expanded,
    chaosUnitIds,
  }
  const resolved = useMemo(
    () => resolveDisplayUnits(node, expanded),
    [
      node,
      expanded,
      node.topology.replicas,
      node.topology.shards,
      node.topology.packing,
      node.archetype,
      node.engine,
    ],
  )
  const unitsKey = resolved.units.map((u) => `${u.dx},${u.dy}`).join('|')
  const layerUnitIds = useMemo(
    () =>
      canvasNode
        ? sortedCanvasInstanceIds(canvasNode, nodeMetrics, resolved.units.length)
        : [],
    [canvasNode, nodeMetrics, resolved.units.length],
  )
  const layerIdsKey = layerUnitIds.join(',')
  const topologyKey = `${node.topology.replicas}:${node.topology.shards}:${node.topology.packing}:${expanded ? 1 : 0}:${layerIdsKey}`
  const prevTopologyKeyRef = useRef(topologyKey)
  const staticUnits: MotionUnit[] = useMemo(
    () =>
      resolved.units.map((u, i) => ({
        id: layerUnitIds[i] ?? `u${i}`,
        dx: u.dx,
        dy: u.dy,
        opacity: 1,
        scale: 1,
      })),
    [unitsKey, layerIdsKey],
  )

  useEffect(() => {
    const topologyChanged = prevTopologyKeyRef.current !== topologyKey
    prevTopologyKeyRef.current = topologyKey
    const animateSpawn = canvasMode !== 'live' || topologyChanged
    const targetIds =
      layerUnitIds.length === resolved.units.length ? layerUnitIds : undefined
    retarget(node.id, resolved.units, { dx: 0, dy: 0 }, { animateSpawn, targetIds })
  }, [node.id, unitsKey, topologyKey, layerIdsKey, resolved.units, canvasMode, layerUnitIds])

  const motionKey = useSyncExternalStore(
    subscribeUnitMotion,
    () => motionKeyForNode(node.id),
    () => '',
  )
  const units = motionUnitsFromKey(motionKey, staticUnits)

  const reducedMotion = useReducedMotion()
  const isDragging = useSyncExternalStore(
    subscribeDragLive,
    () => getDragLive()?.idSet.has(node.id) ?? false,
    () => false,
  )
  const isAnimating = motionKey !== ''
  const [selectScale, setSelectScale] = useState(1)
  useEffect(() => {
    if (!selected || reducedMotion || isDragging || isAnimating) {
      setSelectScale(1)
      return
    }
    setSelectScale(1.02)
    const t = window.setTimeout(() => setSelectScale(1), 120)
    return () => window.clearTimeout(t)
  }, [selected, reducedMotion, isDragging, isAnimating, node.id])

  const composed = composeGlyph(node)
  const health = healthVisual ?? node.healthVisual ?? 'off'
  const common = {
    x: 0,
    y: 0,
    label: node.label,
    selected,
    interactive,
    healthVisual: health,
    onPointerDown,
    onPointerEnter,
    onPointerLeave,
    onUnitPointerDown,
    onUnitPointerEnter,
    onUnitPointerLeave,
  }

  let glyph: ReactElement
  if (composed.brandBody === 'redis') {
    glyph = <RedisBrandGlyph {...common} units={units} />
  } else {
    switch (node.archetype) {
      case 'client':
        glyph = <ClientLoadgenGlyph {...common} />
        break
      case 'database':
        glyph = (
          <SpriteBackedGlyph
            {...common}
            kind="database"
            units={units}
            logoId={skin.logoId}
            tint={skin.brandTint}
            stableHealthRim={stableHealthRim}
            {...chaosProps}
          />
        )
        break
      case 'cache':
        glyph = (
          <SpriteBackedGlyph
            {...common}
            kind="cache"
            units={units}
            logoId={skin.logoId}
            tint={skin.brandTint}
            stableHealthRim={stableHealthRim}
            {...chaosProps}
          />
        )
        break
      case 'message-queue':
        glyph = (
          <SpriteBackedGlyph
            {...common}
            kind="message-queue"
            units={units}
            logoId={skin.logoId}
            tint={skin.brandTint}
            stableHealthRim={stableHealthRim}
            {...chaosProps}
          />
        )
        break
      case 'load-balancer':
        glyph = (
          <SpriteBackedGlyph
            {...common}
            kind="load-balancer"
            units={[{ id: 'u0', dx: 0, dy: 0, opacity: 1, scale: 1 }]}
            logoId={skin.logoId}
            tint={skin.brandTint}
            stableHealthRim={stableHealthRim}
            {...chaosProps}
          />
        )
        break
      case 'worker':
        glyph = (
          <SpriteBackedGlyph
            {...common}
            kind="worker"
            units={units}
            logoId={skin.logoId}
            tint={skin.brandTint}
            stableHealthRim={stableHealthRim}
            {...chaosProps}
          />
        )
        break
      case 'app-server':
      default:
        glyph = (
          <SpriteBackedGlyph
            {...common}
            kind="app-server"
            units={units}
            logoId={skin.logoId}
            tint={skin.brandTint}
            stableHealthRim={stableHealthRim}
            {...chaosProps}
          />
        )
    }
  }

  return (
    <g
      transform={`translate(${x} ${y}) scale(${selectScale})`}
      style={{
        transition: reducedMotion ? undefined : 'transform 120ms ease-out',
      }}
    >
      {glyph}
    </g>
  )
}

function nodeGlyphPropsEqual(a: NodeGlyphProps, b: NodeGlyphProps): boolean {
  return (
    a.node.id === b.node.id &&
    a.x === b.x &&
    a.y === b.y &&
    a.selected === b.selected &&
    a.interactive === b.interactive &&
    a.healthVisual === b.healthVisual &&
    a.node.archetype === b.node.archetype &&
    a.node.engine === b.node.engine &&
    a.node.label === b.node.label &&
    a.node.healthVisual === b.node.healthVisual &&
    a.node.topology.replicas === b.node.topology.replicas &&
    a.node.topology.shards === b.node.topology.shards &&
    a.node.topology.packing === b.node.topology.packing &&
    a.onPointerDown === b.onPointerDown &&
    a.onPointerEnter === b.onPointerEnter &&
    a.onPointerLeave === b.onPointerLeave &&
    a.onUnitPointerDown === b.onUnitPointerDown &&
    a.onUnitPointerEnter === b.onUnitPointerEnter &&
    a.onUnitPointerLeave === b.onUnitPointerLeave
  )
}

export const NodeGlyph = memo(NodeGlyphInner, nodeGlyphPropsEqual)