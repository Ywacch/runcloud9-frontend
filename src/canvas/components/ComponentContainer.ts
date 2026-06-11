import {
  Container,
  Graphics,
  Rectangle,
  Text,
  TextStyle,
  type FederatedPointerEvent,
  type Ticker,
} from 'pixi.js'
import type { Viewport } from 'pixi-viewport'
import { TILE_W, TILE_H, isoToScreen, screenToIso } from '../constants'
import { COMPONENT_COLORS } from '../config/componentColors'
import {
  addCollapsedReplicaStack,
  addProceduralSlab,
  collapsedStackSilhouette,
  collapsedStackTopY,
  inflatePoly,
  isoBoxSilhouette,
} from './proceduralComponent'
import { expandedSlotOffset } from './replicaSlots'
import { USE_SPRITE_COMPONENTS } from '../config/renderMode'
import {
  DEFAULT_SPRITE_LAYOUT,
  SPRITE_LAYOUT,
  spriteBodyBounds,
} from '../config/spriteLayout'
import { spriteHealthRimPoly } from '../config/spriteHealthRim'
import { isAtlasReady } from '../sprites/atlasState'
import { spriteFrameForType } from '../sprites/spriteFrames'
import { SpriteComponent } from '../sprites/SpriteComponent'
import { nodeToIso, isoToNode, clampIsoCell } from '../utils/positionAdapter'
import { defaultEdgeProtocol } from '../../lib/defaultEdgeProtocol'
import {
  isCanvasEditMode,
  isMetricsViewportMode,
  useCanvasStore,
  type CanvasNode,
} from '../../editor-core/stores/canvasStore'
import { getApp } from '../engine/app'
import {
  walkthroughNodeAlpha,
  type WalkthroughNodeRole,
} from '../utils/walkthroughVisual'
import {
  healthRimAlpha,
  healthRimStyle,
  type HealthVisualState,
} from '../utils/healthVisual'
import { type ConnectNodeRole } from '../utils/connectVisual'

const REPLICA_STACK_TYPES = new Set<CanvasNode['type']>([
  'compute',
  'worker',
  'cache',
  'database',
])

/** Capped visible replica count (databases show primary + read replicas). */
function visualReplicaCount(node: CanvasNode): number {
  if (node.type === 'database') {
    const raw = Math.floor(Number(node.config.readReplicas ?? 0))
    const safe = Number.isFinite(raw) ? Math.max(0, raw) : 0
    return Math.min(3, safe + 1)
  }
  const raw = Math.floor(Number(node.config.replicas ?? 1))
  const safe = Number.isFinite(raw) ? Math.max(1, raw) : 1
  return Math.min(3, safe)
}

function nodeHasReplicaStack(node: CanvasNode): boolean {
  return REPLICA_STACK_TYPES.has(node.type) && visualReplicaCount(node) > 1
}

export class ComponentContainer extends Container {
  private readonly nodeId: string
  private readonly viewport: Viewport
  private isDragging = false
  private _draggedToNewCell = false
  private dragStartIso = { col: 0, row: 0 }
  private selectionOverlay: Graphics | null = null
  private walkthroughOverlay: Graphics | null = null
  private walkthroughRole: WalkthroughNodeRole = 'off'
  private walkthroughTickerFn: ((ticker: Ticker) => void) | null = null
  private narrativeHighlighted = false
  private narrativeOverlay: Graphics | null = null
  private narrativeTickerFn: ((ticker: Ticker) => void) | null = null
  private healthVisual: HealthVisualState = 'off'
  private healthOverlay: Graphics | null = null
  private healthTickerFn: ((ticker: Ticker) => void) | null = null
  private connectRole: ConnectNodeRole = 'off'
  private connectOverlay: Graphics | null = null
  private connectTickerFn: ((ticker: Ticker) => void) | null = null
  private statusDot!: Graphics
  private labelText!: Text
  private replicaBadge: Text | null = null
  private spriteBody: SpriteComponent | null = null
  private expanded = false
  private _prevType: CanvasNode['type']
  private _prevVisualReplicas: number
  private _prevExpanded = false

  constructor(node: CanvasNode, viewport: Viewport) {
    super()
    this.nodeId = node.id
    this.viewport = viewport
    this.eventMode = 'static'
    this.interactiveChildren = false
    this.cursor = 'pointer'
    this.sortableChildren = false
    this.label = node.id
    this._prevType = node.type
    this._prevVisualReplicas = visualReplicaCount(node)
    this._syncPosition(node.position)
    this._build(node)
    this._updateHitArea()
    this._wireEvents()
  }

  /** Bounding box encompassing every drawn slab (collapsed cake or exploded slots). */
  private _componentBounds(): { x: number; y: number; w: number; h: number } {
    if (USE_SPRITE_COMPONENTS && isAtlasReady() && !this._prevExpanded) {
      const spec = spriteFrameForType(this._prevType)
      if (spec) {
        const layout = SPRITE_LAYOUT[spec.frame] ?? DEFAULT_SPRITE_LAYOUT
        const spriteBounds = spriteBodyBounds(layout)
        if (spriteBounds) return spriteBounds
      }
    }

    const sH = COMPONENT_COLORS[this._prevType]?.sideHeight ?? 30
    const layers = this._prevVisualReplicas

    let left = 0
    let top = -TILE_H / 2 - sH
    let right = TILE_W
    let bottom = TILE_H / 2 + sH + 30

    if (this._prevExpanded && layers > 1) {
      for (let i = 0; i < layers; i++) {
        const o = expandedSlotOffset(i)
        left = Math.min(left, o.x)
        top = Math.min(top, o.y - TILE_H / 2 - sH)
        right = Math.max(right, o.x + TILE_W)
        bottom = Math.max(bottom, o.y + TILE_H / 2 + sH + 30)
      }
    } else if (layers > 1) {
      top = collapsedStackTopY(this._prevType, layers)
    }

    return { x: left, y: top, w: right - left, h: bottom - top }
  }

  /**
   * Iso silhouette polygon(s) of the drawn slabs — the health rim traces the
   * actual box outline rather than a 2D bounding rect. One hexagon for a single
   * box or collapsed stack; one per tile in the expanded fan.
   */
  private _healthRimPolys(): number[][] {
    if (USE_SPRITE_COMPONENTS && isAtlasReady()) {
      const spec = spriteFrameForType(this._prevType)
      if (spec) {
        const layout = SPRITE_LAYOUT[spec.frame] ?? DEFAULT_SPRITE_LAYOUT
        const polyAt = (off: { x: number; y: number }) =>
          spriteHealthRimPoly(spec.frame, layout, off)
        const layers = this._prevVisualReplicas
        if (this._prevExpanded && layers > 1) {
          return Array.from({ length: layers }, (_, i) => polyAt(expandedSlotOffset(i))).filter(
            (p): p is number[] => p !== null,
          )
        }
        const single = polyAt({ x: 0, y: 0 })
        if (single) return [single]
      }
    }

    const sH = COMPONENT_COLORS[this._prevType]?.sideHeight ?? 30
    const layers = this._prevVisualReplicas

    if (this._prevExpanded && layers > 1) {
      const polys: number[][] = []
      for (let i = 0; i < layers; i++) {
        const o = expandedSlotOffset(i)
        polys.push(isoBoxSilhouette(o.x, o.y, o.y, sH))
      }
      return polys
    }
    if (layers > 1) {
      return [collapsedStackSilhouette(this._prevType, layers)]
    }
    return [isoBoxSilhouette(0, 0, 0, sH)]
  }

  /** removeChildren() destroys overlay graphics — drop stale refs so setters redraw. */
  private _clearOverlayRefs(): void {
    this.selectionOverlay = null
    this.healthOverlay = null
    this.walkthroughOverlay = null
    this.narrativeOverlay = null
    this.connectOverlay = null
  }

  private _restoreDecorations(): void {
    this.setWalkthroughVisual(this.walkthroughRole)
    this.setNarrativeHighlight(this.narrativeHighlighted)
    this.setHealthVisual(this.healthVisual)
    this.setConnectVisual(this.connectRole)
  }

  private _isSelectedInStore(): boolean {
    return useCanvasStore.getState().selectedIds.includes(this.nodeId)
  }

  private _updateHitArea(): void {
    const b = this._componentBounds()
    const pad = 8
    this.hitArea = new Rectangle(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2)
  }

  private _syncPosition(pos: [number, number, number]): void {
    const { col, row } = nodeToIso(pos)
    const screen = isoToScreen(col, row)
    this.position.set(screen.x, screen.y)
    this.zIndex = col + row
  }

  private _build(node: CanvasNode): void {
    this._clearOverlayRefs()
    this.removeChildren()
    this.replicaBadge = null
    if (this.spriteBody?.destroyed) this.spriteBody = null

    const colors = COMPONENT_COLORS[node.type]
    const sH = colors.sideHeight
    const layers = visualReplicaCount(node)
    const hasStack = nodeHasReplicaStack(node)

    this._prevType = node.type
    this._prevVisualReplicas = layers
    this._prevExpanded = hasStack && this.expanded

    if (this._useSpriteBody(node)) {
      this._mountSpriteBody(node, layers, hasStack)
    } else {
      if (this.spriteBody) {
        this.spriteBody.destroy()
        this.spriteBody = null
      }
      if (hasStack && this.expanded) {
        this._drawExpandedStack(node, sH, layers)
      } else if (hasStack) {
        this._drawCollapsedStack(node, layers)
      } else {
        this._drawSingle(node)
      }
    }

    this._buildLabel(node, hasStack, layers)

    this.statusDot = new Graphics()
    const statusOff = this.expanded && hasStack ? expandedSlotOffset(0) : { x: 0, y: 0 }
    this.statusDot.position.set(TILE_W + 2 + statusOff.x, -TILE_H / 2 + statusOff.y)
    this._updateStatusDot(node.status)
    this.addChild(this.statusDot)

    this._restoreDecorations()
    if (this._isSelectedInStore()) this.setSelected(true)
  }

  private _drawSingle(node: CanvasNode): void {
    addProceduralSlab(this, node, 0, 0)
  }

  /** Sprite rendering only when the flag is on, the atlas loaded, and the type has a frame. */
  private _useSpriteBody(node: CanvasNode): boolean {
    return (
      USE_SPRITE_COMPONENTS &&
      isAtlasReady() &&
      spriteFrameForType(node.type) !== null
    )
  }

  /** Body drop below the tile diamond for slot-label placement in sprite mode. */
  private _spriteBodyDrop(node: CanvasNode): number {
    const spec = spriteFrameForType(node.type)
    if (!spec) return COMPONENT_COLORS[node.type].sideHeight
    return (SPRITE_LAYOUT[spec.frame] ?? DEFAULT_SPRITE_LAYOUT).offsetY
  }

  /**
   * Mount (or re-mount after removeChildren) the persistent SpriteComponent so
   * expand/collapse can tween instead of rebuilding sprites from scratch.
   */
  private _mountSpriteBody(
    node: CanvasNode,
    layers: number,
    hasStack: boolean,
  ): void {
    if (!this.spriteBody) this.spriteBody = new SpriteComponent()
    this.addChild(this.spriteBody)
    const expanded = hasStack && this.expanded
    this.spriteBody.update({
      nodeType: node.type,
      replicaCount: layers,
      expanded,
    })

    if (expanded) {
      const drop = this._spriteBodyDrop(node)
      for (let idx = 0; idx < layers; idx++) {
        const off = expandedSlotOffset(idx)
        const text =
          idx === 0
            ? '\u02c4 collapse\nprimary'
            : node.type === 'database'
              ? `read ${idx}`
              : `replica ${idx}`
        this._addSlotLabel(
          off.x + TILE_W / 2,
          off.y + TILE_H / 2 + drop + 4,
          text,
        )
      }
    }
  }

  /** Vertical "cake": full base + thin caps (see proceduralComponent). */
  private _drawCollapsedStack(node: CanvasNode, layers: number): void {
    addCollapsedReplicaStack(this, node, layers)
  }

  /** Exploded view: full-height procedural tiles fanned with labels + leaders. */
  private _drawExpandedStack(
    node: CanvasNode,
    _sH: number,
    layers: number,
  ): void {
    const slots = Array.from({ length: layers }, (_, idx) => ({
      idx,
      off: expandedSlotOffset(idx),
    }))
    const primary = expandedSlotOffset(0)
    const sH = COMPONENT_COLORS[node.type].sideHeight

    for (const s of slots) {
      if (s.idx === 0) continue
      const g = new Graphics()
      g.eventMode = 'none'
      const sx = s.off.x + TILE_W / 2
      const sy = s.off.y + TILE_H / 2 + sH / 2
      const px = primary.x + TILE_W / 2
      const py = primary.y + TILE_H / 2 + sH / 2
      const segs = 8
      for (let i = 0; i < segs; i += 2) {
        const t0 = i / segs
        const t1 = Math.min((i + 1) / segs, 1)
        g.moveTo(sx + (px - sx) * t0, sy + (py - sy) * t0)
          .lineTo(sx + (px - sx) * t1, sy + (py - sy) * t1)
          .stroke({ color: 0x9ca3af, width: 1, alpha: 0.45 })
      }
      this.addChild(g)
    }

    for (const s of [...slots].sort((a, b) => a.off.y - b.off.y)) {
      const factor = s.idx === 0 ? 1 : 1 - s.idx * 0.08
      addProceduralSlab(this, node, s.off.x, s.off.y, {
        factor,
        outline: true,
        showGlyph: true,
      })
    }

    for (const s of slots) {
      const text =
        s.idx === 0
          ? '\u02c4 collapse\nprimary'
          : node.type === 'database'
            ? `read ${s.idx}`
            : `replica ${s.idx}`
      this._addSlotLabel(
        s.off.x + TILE_W / 2,
        s.off.y + TILE_H / 2 + sH + 4,
        text,
      )
    }
  }

  private _addSlotLabel(x: number, y: number, text: string): void {
    const label = new Text({
      text,
      style: new TextStyle({
        fontSize: 9,
        fill: 0xe4e4e7,
        align: 'center',
        lineHeight: 11,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      }),
    })
    label.eventMode = 'none'
    label.anchor.set(0.5, 0)
    label.position.set(x, y)
    const bg = new Graphics()
    bg.eventMode = 'none'
    bg.roundRect(
      x - label.width / 2 - 3,
      y - 2,
      label.width + 6,
      label.height + 4,
      3,
    ).fill({ color: 0x000000, alpha: 0.6 })
    this.addChild(bg)
    this.addChild(label)
  }

  private _buildLabel(
    node: CanvasNode,
    hasStack: boolean,
    layers: number,
  ): void {
    const bounds = this._componentBounds()
    this.labelText = new Text({
      text: node.label,
      style: new TextStyle({
        fontSize: 12,
        fontWeight: '600',
        fill: 0xffffff,
        fontFamily: 'Inter, system-ui, sans-serif',
        dropShadow: { color: 0x000000, alpha: 0.8, blur: 2, distance: 1 },
      }),
    })
    this.labelText.eventMode = 'none'
    this.labelText.anchor.set(0.5, 1)
    this.labelText.position.set(TILE_W / 2, bounds.y - 6)
    this.addChild(this.labelText)

    if (hasStack) {
      const count =
        node.type === 'database'
          ? `+${layers - 1} read`
          : `×${layers}`
      this.replicaBadge = new Text({
        text: count,
        style: new TextStyle({
          fontSize: 10,
          fill: 0xfbbf24,
          fontWeight: 'bold',
          fontFamily: 'Inter, system-ui, sans-serif',
        }),
      })
      this.replicaBadge.eventMode = 'none'
      this.replicaBadge.anchor.set(0, 1)
      this.replicaBadge.position.set(
        TILE_W / 2 + this.labelText.width / 2 + 4,
        bounds.y - 6,
      )
      this.addChild(this.replicaBadge)

      if (!this.expanded) {
        const hint = new Text({
          text: '\u02c4 expand',
          style: new TextStyle({
            fontSize: 8,
            fill: 0xa1a1aa,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }),
        })
        hint.eventMode = 'none'
        hint.anchor.set(0.5, 1)
        hint.position.set(TILE_W / 2, bounds.y + 8)
        this.addChild(hint)
      }
    }
  }

  private _updateStatusDot(status: CanvasNode['status']): void {
    this.statusDot.clear()
    const color =
      status === 'healthy'
        ? 0x22c55e
        : status === 'provisioning'
          ? 0xfbbf24
          : status === 'degraded'
            ? 0xef4444
            : 0x475569
    this.statusDot.circle(0, 0, 5).fill({ color })
  }

  private _wireEvents(): void {
    this.on('pointerdown', this._onPointerDown)
    this.on('pointertap', this._onPointerTap)
    this.on('pointerover', this._onPointerOver)
    this.on('pointerout', this._onPointerOut)
  }

  private _canToggleExpand(): boolean {
    const state = useCanvasStore.getState()
    const node = state.nodes[this.nodeId]
    if (!node || !nodeHasReplicaStack(node)) return false
    if (isMetricsViewportMode(state.mode)) return true
    return isCanvasEditMode(state.mode) && state.designTool === 'select'
  }

  private _onPointerTap = (): void => {
    if (this._draggedToNewCell) {
      this._draggedToNewCell = false
      return
    }
    if (!this._canToggleExpand()) return
    const node = useCanvasStore.getState().nodes[this.nodeId]
    if (!node) return
    this.expanded = !this.expanded
    this._build(node)
    this._updateHitArea()
  }

  private _onPointerDown = (e: FederatedPointerEvent): void => {
    e.stopPropagation()
    const state = useCanvasStore.getState()
    const node = state.nodes[this.nodeId]
    if (!node) return

    if (state.mode === 'live') {
      state.selectNode(this.nodeId)
      return
    }

    if (!isCanvasEditMode(state.mode)) return

    const tool = state.designTool
    this.cursor = tool === 'connect' ? 'crosshair' : tool === 'erase' ? 'cell' : 'pointer'

    if (tool === 'erase') {
      if (node.type !== 'client') state.removeNode(this.nodeId)
      return
    }

    if (tool === 'connect') {
      this._handleConnect(state, node)
      return
    }

    state.setPendingSource(null)
    state.selectNode(this.nodeId)
    if (state.movementLocked) return
    this._beginDrag(e)
  }

  private _handleConnect(
    state: ReturnType<typeof useCanvasStore.getState>,
    node: CanvasNode,
  ): void {
    const pending = state.pendingSourceId
    if (pending === null) {
      state.setPendingSource(this.nodeId)
      state.selectNode(this.nodeId)
      return
    }
    if (pending === this.nodeId) {
      state.setPendingSource(null)
      return
    }
    const sourceNode = state.nodes[pending]
    if (!sourceNode) {
      state.setPendingSource(null)
      return
    }
    state.addEdge({
      id: crypto.randomUUID(),
      sourceId: pending,
      targetId: this.nodeId,
      protocol: defaultEdgeProtocol(sourceNode.type, node.type),
      animated: false,
    })
    state.setPendingSource(null)
    state.selectNode(this.nodeId)
  }

  private _onPointerOver = (): void => {
    const state = useCanvasStore.getState()
    if (isMetricsViewportMode(state.mode) && !this.isDragging) {
      state.setHoveredNodeId(this.nodeId)
    }
    if (!isCanvasEditMode(state.mode) || state.designTool !== 'connect') return
    if (state.pendingSourceId && state.pendingSourceId !== this.nodeId) {
      state.setConnectHoverTargetId(this.nodeId)
    }
  }

  private _onPointerOut = (): void => {
    const state = useCanvasStore.getState()
    if (state.hoveredNodeId === this.nodeId) {
      state.setHoveredNodeId(null)
    }
    if (state.connectHoverTargetId === this.nodeId) {
      state.setConnectHoverTargetId(null)
    }
  }

  private _beginDrag(e: FederatedPointerEvent): void {
    useCanvasStore.getState().setHoveredNodeId(null)
    this.isDragging = true
    this._draggedToNewCell = false
    const world = this.viewport.toWorld(e.global.x, e.global.y)
    const iso = screenToIso(world.x, world.y)
    this.dragStartIso = { col: Math.round(iso.col), row: Math.round(iso.row) }
    this.viewport.plugins.pause('drag')
    this.viewport.on('pointermove', this._onDragMove)
    this.viewport.on('pointerup', this._onDragEnd)
    this.viewport.on('pointerupoutside', this._onDragEnd)
  }

  private _onDragMove = (e: FederatedPointerEvent): void => {
    if (!this.isDragging) return
    const world = this.viewport.toWorld(e.global.x, e.global.y)
    const iso = screenToIso(world.x, world.y)
    const { col, row } = clampIsoCell(iso.col, iso.row)
    const snapped = isoToScreen(col, row)
    this.position.set(snapped.x, snapped.y)
    this.zIndex = col + row
  }

  private _onDragEnd = (e: FederatedPointerEvent): void => {
    if (!this.isDragging) return
    this.isDragging = false
    this.viewport.plugins.resume('drag')
    this.viewport.off('pointermove', this._onDragMove)
    this.viewport.off('pointerup', this._onDragEnd)
    this.viewport.off('pointerupoutside', this._onDragEnd)
    const world = this.viewport.toWorld(e.global.x, e.global.y)
    const iso = screenToIso(world.x, world.y)
    const { col, row } = clampIsoCell(iso.col, iso.row)
    if (col !== this.dragStartIso.col || row !== this.dragStartIso.row) {
      this._draggedToNewCell = true
      useCanvasStore.getState().updateNodePosition(this.nodeId, isoToNode(col, row))
    }
  }

  syncNode(node: CanvasNode): void {
    const layers = visualReplicaCount(node)
    const effExpanded = this.expanded && nodeHasReplicaStack(node)
    const needsRebuild =
      node.type !== this._prevType ||
      layers !== this._prevVisualReplicas ||
      effExpanded !== this._prevExpanded
    if (needsRebuild) {
      this._build(node)
      this._updateHitArea()
    } else {
      if (this.labelText.text !== node.label) this.labelText.text = node.label
      this._updateStatusDot(node.status)
    }
    this._syncPosition(node.position)
    if (!needsRebuild) {
      this._restoreDecorations()
      if (this._isSelectedInStore()) this.setSelected(true)
    }
  }

  setConnectVisual(role: ConnectNodeRole): void {
    const connectLive = !!this.connectOverlay && this.connectOverlay.parent === this
    if (role === this.connectRole && (role === 'off' ? !connectLive : connectLive)) {
      return
    }
    this.connectRole = role
    this._stopConnectPulse()

    if (this.connectOverlay) {
      this.removeChild(this.connectOverlay)
      this.connectOverlay.destroy()
      this.connectOverlay = null
    }

    if (role === 'off') return

    this.connectOverlay = new Graphics()
    this.connectOverlay.eventMode = 'none'
    this.addChild(this.connectOverlay)
    this._drawConnectOverlay(role, Date.now() / 1000)
    if (role === 'pendingSource') this._startConnectPulse()
  }

  private _drawConnectOverlay(role: Exclude<ConnectNodeRole, 'off'>, elapsedSec: number): void {
    if (!this.connectOverlay) return
    const g = this.connectOverlay
    g.clear()

    const color = 0x4a90d9
    const alpha =
      role === 'pendingSource'
        ? 0.42 + Math.sin(elapsedSec * 3) * 0.28
        : 0.55

    for (const poly of this._healthRimPolys()) {
      if (role === 'pendingSource') {
        g.poly(inflatePoly(poly, 6)).stroke({
          color,
          width: 3,
          alpha,
          join: 'round',
        })
        continue
      }

      g.poly(inflatePoly(poly, 5)).stroke({
        color,
        width: 2.5,
        alpha,
        join: 'round',
      })
      g.poly(inflatePoly(poly, 8)).stroke({
        color,
        width: 4,
        alpha: 0.15,
        join: 'round',
      })
    }
  }

  private _startConnectPulse(): void {
    if (this.connectTickerFn) return
    this.connectTickerFn = () => {
      if (this.connectRole !== 'pendingSource' || !this.connectOverlay) return
      this._drawConnectOverlay('pendingSource', Date.now() / 1000)
    }
    getApp().ticker.add(this.connectTickerFn)
  }

  private _stopConnectPulse(): void {
    if (!this.connectTickerFn) return
    getApp().ticker.remove(this.connectTickerFn)
    this.connectTickerFn = null
  }

  setHealthVisual(state: HealthVisualState): void {
    const style = healthRimStyle(state)
    const overlayLive = !!this.healthOverlay && this.healthOverlay.parent === this
    if (state === this.healthVisual && !!style === overlayLive) return
    this.healthVisual = state
    this._stopHealthPulse()

    if (this.healthOverlay) {
      this.removeChild(this.healthOverlay)
      this.healthOverlay.destroy()
      this.healthOverlay = null
    }

    if (!style) return

    this.healthOverlay = new Graphics()
    this.healthOverlay.eventMode = 'none'
    this.addChild(this.healthOverlay)
    this._drawHealthOverlay(style, Date.now() / 1000)
    if (style.pulseSpeed > 0) this._startHealthPulse(style)
  }

  private _drawHealthOverlay(style: NonNullable<ReturnType<typeof healthRimStyle>>, elapsedSec: number): void {
    if (!this.healthOverlay) return
    const alpha = healthRimAlpha(style, elapsedSec)
    const g = this.healthOverlay
    g.clear()
    for (const poly of this._healthRimPolys()) {
      g.poly(inflatePoly(poly, 4)).stroke({
        color: style.color,
        width: 2.5,
        alpha,
        join: 'round',
      })
      g.poly(inflatePoly(poly, 6)).stroke({
        color: style.color,
        width: 5,
        alpha: alpha * 0.25,
        join: 'round',
      })
    }
  }

  private _startHealthPulse(style: NonNullable<ReturnType<typeof healthRimStyle>>): void {
    if (this.healthTickerFn) return
    this.healthTickerFn = () => {
      if (!this.healthOverlay) return
      this._drawHealthOverlay(style, Date.now() / 1000)
    }
    getApp().ticker.add(this.healthTickerFn)
  }

  private _stopHealthPulse(): void {
    if (!this.healthTickerFn) return
    getApp().ticker.remove(this.healthTickerFn)
    this.healthTickerFn = null
  }

  setNarrativeHighlight(highlighted: boolean): void {
    const narrativeLive =
      !!this.narrativeOverlay && this.narrativeOverlay.parent === this
    if (highlighted === this.narrativeHighlighted && narrativeLive) return
    this.narrativeHighlighted = highlighted
    this._stopNarrativePulse()

    if (this.narrativeOverlay) {
      this.removeChild(this.narrativeOverlay)
      this.narrativeOverlay.destroy()
      this.narrativeOverlay = null
    }

    if (!highlighted) return

    this.narrativeOverlay = new Graphics()
    this.narrativeOverlay.eventMode = 'none'
    this.addChild(this.narrativeOverlay)
    this._drawNarrativeOverlay(1)
    this._startNarrativePulse()
  }

  private _drawNarrativeOverlay(pulse = 1): void {
    if (!this.narrativeOverlay) return
    const { x, y, w, h } = this._walkthroughBounds()
    const g = this.narrativeOverlay
    g.clear()

    const glow = 0.35 + pulse * 0.4
    g.roundRect(x, y, w, h, 6).stroke({ color: 0xc4b5fd, width: 3, alpha: glow })
    g.roundRect(x - 2, y - 2, w + 4, h + 4, 8).stroke({
      color: 0xa78bfa,
      width: 6,
      alpha: 0.1 + pulse * 0.14,
    })
  }

  private _startNarrativePulse(): void {
    if (this.narrativeTickerFn) return
    this.narrativeTickerFn = () => {
      if (!this.narrativeHighlighted) return
      const pulse = 0.45 + Math.sin(Date.now() * 0.004) * 0.15
      this._drawNarrativeOverlay(pulse)
    }
    getApp().ticker.add(this.narrativeTickerFn)
  }

  private _stopNarrativePulse(): void {
    if (!this.narrativeTickerFn) return
    getApp().ticker.remove(this.narrativeTickerFn)
    this.narrativeTickerFn = null
  }

  setWalkthroughVisual(role: WalkthroughNodeRole): void {
    this.walkthroughRole = role
    this.alpha = walkthroughNodeAlpha(role)
    this._stopWalkthroughPulse()

    if (this.walkthroughOverlay) {
      this.removeChild(this.walkthroughOverlay)
      this.walkthroughOverlay.destroy()
      this.walkthroughOverlay = null
    }

    if (role === 'off' || role === 'participating' || role === 'hidden') return

    this.walkthroughOverlay = new Graphics()
    this.walkthroughOverlay.eventMode = 'none'
    this.addChild(this.walkthroughOverlay)

    if (role === 'active') {
      this._drawWalkthroughOverlay('active', 1)
      this._startWalkthroughPulse()
    } else {
      this._drawWalkthroughOverlay(role)
    }
  }

  private _walkthroughBounds(): {
    x: number
    y: number
    w: number
    h: number
    pad: number
  } {
    const pad = 8
    const b = this._componentBounds()
    return {
      pad,
      x: b.x - pad,
      y: b.y - pad,
      w: b.w + pad * 2,
      h: b.h + pad * 2,
    }
  }

  private _drawWalkthroughOverlay(role: 'active' | 'visited', pulse = 1): void {
    if (!this.walkthroughOverlay) return
    const { x, y, w, h } = this._walkthroughBounds()
    const g = this.walkthroughOverlay
    g.clear()

    if (role === 'active') {
      const glow = 0.35 + pulse * 0.4
      g.roundRect(x, y, w, h, 6).stroke({ color: 0x22d3ee, width: 3, alpha: glow })
      g.roundRect(x - 2, y - 2, w + 4, h + 4, 8).stroke({
        color: 0x22d3ee,
        width: 6,
        alpha: 0.08 + pulse * 0.12,
      })
      return
    }

    g.roundRect(x, y, w, h, 6).stroke({ color: 0x22d3ee, width: 2, alpha: 0.35 })
  }

  private _startWalkthroughPulse(): void {
    if (this.walkthroughTickerFn) return
    this.walkthroughTickerFn = () => {
      if (this.walkthroughRole !== 'active') return
      const pulse = 0.45 + Math.sin(Date.now() * 0.004) * 0.15
      this._drawWalkthroughOverlay('active', pulse)
    }
    getApp().ticker.add(this.walkthroughTickerFn)
  }

  private _stopWalkthroughPulse(): void {
    if (!this.walkthroughTickerFn) return
    getApp().ticker.remove(this.walkthroughTickerFn)
    this.walkthroughTickerFn = null
  }

  setSelected(selected: boolean): void {
    if (!selected) {
      if (this.selectionOverlay) {
        this.removeChild(this.selectionOverlay)
        this.selectionOverlay.destroy()
        this.selectionOverlay = null
      }
      if (this.expanded) {
        this.expanded = false
        const node = useCanvasStore.getState().nodes[this.nodeId]
        if (node) {
          this._build(node)
          this._updateHitArea()
        }
      }
      return
    }
    if (this.selectionOverlay) {
      this.removeChild(this.selectionOverlay)
      this.selectionOverlay.destroy()
    }
    const g = new Graphics()
    const pad = 10
    const b = this._componentBounds()
    g.roundRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2, 8)
    g.stroke({ color: 0x00aeef, width: 2, alpha: 0.8 })

    this.selectionOverlay = g
    this.addChild(g)
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this._stopWalkthroughPulse()
    this._stopNarrativePulse()
    this._stopHealthPulse()
    this._stopConnectPulse()
    this.off('pointerdown', this._onPointerDown)
    this.off('pointertap', this._onPointerTap)
    this.off('pointerover', this._onPointerOver)
    this.off('pointerout', this._onPointerOut)
    this.viewport.off('pointermove', this._onDragMove)
    this.viewport.off('pointerup', this._onDragEnd)
    this.viewport.off('pointerupoutside', this._onDragEnd)
    super.destroy(options)
  }
}
