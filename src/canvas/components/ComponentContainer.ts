import {
  ColorMatrixFilter,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  TextStyle,
  Texture,
  type FederatedPointerEvent,
  type Ticker,
} from 'pixi.js'
import type { Viewport } from 'pixi-viewport'
import { TILE_W, TILE_H, isoToScreen, screenToIso, tileTopFacePoly } from '../constants'
import { COMPONENT_COLORS } from '../config/componentColors'
import { DEFAULT_SPRITE_LAYOUT, SPRITE_LAYOUT } from '../config/spriteLayout'
import { nodeToIso, isoToNode, clampIsoCell } from '../utils/positionAdapter'
import { defaultEdgeProtocol } from '../../lib/defaultEdgeProtocol'
import {
  isCanvasEditMode,
  useCanvasStore,
  type CanvasNode,
} from '../../editor-core/stores/canvasStore'
import { getApp } from '../engine/app'
import {
  walkthroughNodeAlpha,
  type WalkthroughNodeRole,
} from '../utils/walkthroughVisual'

const ASSET_MAP: Record<string, string> = {
  'cache:redis': 'redis-cache',
  cache: 'redis-cache',
  database: 'database',
  'load-balancer': 'lb',
  load_balancer: 'lb',
  'app-server': 'server',
  compute: 'server',
  worker: 'worker',
  'message-queue': 'MQ',
  message_queue: 'MQ',
}

function getAssetKey(node: CanvasNode): string | null {
  const engine =
    node.type === 'cache'
      ? node.config?.cacheEngine ?? node.config?.engine
      : node.config?.engine
  const engineKey = `${node.type}:${engine}`
  return ASSET_MAP[engineKey] ?? ASSET_MAP[node.type] ?? null
}

export class ComponentContainer extends Container {
  private readonly nodeId: string
  private readonly viewport: Viewport
  private isDragging = false
  private dragStartIso = { col: 0, row: 0 }
  private selectionOverlay: Graphics | null = null
  private walkthroughOverlay: Graphics | null = null
  private walkthroughRole: WalkthroughNodeRole = 'off'
  private walkthroughTickerFn: ((ticker: Ticker) => void) | null = null
  private statusDot!: Graphics
  private labelText!: Text
  private replicaBadge: Text | null = null
  private _prevType: CanvasNode['type']
  private _prevReplicas: number

  constructor(node: CanvasNode, viewport: Viewport) {
    super()
    this.nodeId = node.id
    this.viewport = viewport
    this.eventMode = 'static'
    this.interactiveChildren = false
    this.cursor = 'pointer'
    this.sortableChildren = false
    this.label = node.id
    const replicas = typeof node.config.replicas === 'number' ? node.config.replicas : 1
    this._prevType = node.type
    this._prevReplicas = replicas
    this._syncPosition(node.position)
    this._updateHitArea(node.type)
    this._build(node)
    this._wireEvents()
  }

  private _updateHitArea(type: CanvasNode['type']): void {
    const sH = COMPONENT_COLORS[type].sideHeight
    const h = TILE_H + sH + 36
    this.hitArea = new Rectangle(-8, -TILE_H / 2 - 8, TILE_W + 16, h)
  }

  private _syncPosition(pos: [number, number, number]): void {
    const { col, row } = nodeToIso(pos)
    const screen = isoToScreen(col, row)
    this.position.set(screen.x, screen.y)
    this.zIndex = col + row
  }

  private _drawIsoPlatform(
    ox: number,
    oy: number,
    colors: (typeof COMPONENT_COLORS)[CanvasNode['type']],
    sH: number,
  ): void {
    const g = new Graphics()
    g.poly(tileTopFacePoly(ox, oy)).fill({ color: colors.top })
    g.poly([
      ox,
      oy,
      ox + TILE_W / 2,
      oy + TILE_H / 2,
      ox + TILE_W / 2,
      oy + TILE_H / 2 + sH,
      ox,
      oy + sH,
    ]).fill({ color: colors.left })
    g.poly([
      ox + TILE_W,
      oy,
      ox + TILE_W / 2,
      oy + TILE_H / 2,
      ox + TILE_W / 2,
      oy + TILE_H / 2 + sH,
      ox + TILE_W,
      oy + sH,
    ]).fill({ color: colors.right })
    this.addChild(g)
  }

  private _build(node: CanvasNode): void {
    this.removeChildren()
    this.selectionOverlay = null
    this.replicaBadge = null

    const colors = COMPONENT_COLORS[node.type]
    const replicas = typeof node.config.replicas === 'number' ? node.config.replicas : 1
    const sH = colors.sideHeight
    const assetKey = getAssetKey(node)

    const cappedLayers = Math.min(replicas, 3)

    if (assetKey) {
      const texture = Texture.from(assetKey)
      const layout = SPRITE_LAYOUT[assetKey] ?? DEFAULT_SPRITE_LAYOUT

      for (let i = cappedLayers - 1; i >= 0; i--) {
        const replicaOffsetX = i * 7
        const replicaOffsetY = -i * 7

        const sprite = new Sprite(texture)
        sprite.anchor.set(layout.anchor.x, layout.anchor.y)
        sprite.scale.set(layout.scale)
        sprite.position.set(
          TILE_W / 2 + layout.offsetX + replicaOffsetX,
          TILE_H / 2 + layout.offsetY + replicaOffsetY,
        )
        if (i > 0) {
          const matrix = new ColorMatrixFilter()
          matrix.brightness(0.72, false)
          sprite.filters = [matrix]
        }
        this.addChild(sprite)
      }
    } else {
      for (let i = cappedLayers - 1; i >= 0; i--) {
        const ox = i * 7
        const oy = -i * 7

        if (i === 0) {
          this._drawIsoPlatform(ox, oy, colors, sH)
        } else {
          const g = new Graphics()
          const darken = (hex: number) => {
            const r = Math.floor(((hex >> 16) & 0xff) * 0.72)
            const gr = Math.floor(((hex >> 8) & 0xff) * 0.72)
            const b = Math.floor((hex & 0xff) * 0.72)
            return (r << 16) | (gr << 8) | b
          }
          g.poly(tileTopFacePoly(ox, oy))
            .fill({ color: darken(colors.top) })
            .stroke({ color: 0x000000, width: 0.5, alpha: 0.3 })
          this.addChild(g)
        }
      }
    }

    this.labelText = new Text({
      text: node.label,
      style: new TextStyle({
        fontSize: 12,
        fontWeight: '600',
        fill: 0xffffff,
        fontFamily: 'Inter, system-ui, sans-serif',
        dropShadow: {
          color: 0x000000,
          alpha: 0.8,
          blur: 2,
          distance: 1,
        },
      }),
    })
    this.labelText.eventMode = 'none'
    this.labelText.anchor.set(0.5, 0)
    this.labelText.position.set(TILE_W / 2, TILE_H / 2 + sH + 8)
    this.addChild(this.labelText)

    if (replicas > 1) {
      this.replicaBadge = new Text({
        text: `×${replicas}`,
        style: new TextStyle({
          fontSize: 10,
          fill: 0xfbbf24,
          fontWeight: 'bold',
          fontFamily: 'Inter, system-ui, sans-serif',
        }),
      })
      this.replicaBadge.anchor.set(0, 1)
      const topLayerOffset = (cappedLayers - 1) * 7
      this.replicaBadge.position.set(
        TILE_W + topLayerOffset + 4,
        -topLayerOffset - TILE_H / 2 - 4,
      )
      this.addChild(this.replicaBadge)
    }

    this.statusDot = new Graphics()
    this.statusDot.position.set(TILE_W + 2, -TILE_H / 2 - sH / 2)
    this._updateStatusDot(node.status)
    this.addChild(this.statusDot)
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
    this.on('pointerover', this._onPointerOver)
    this.on('pointerout', this._onPointerOut)
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
    if (!isCanvasEditMode(state.mode) || state.designTool !== 'connect') return
    if (state.pendingSourceId && state.pendingSourceId !== this.nodeId) {
      state.setConnectHoverTargetId(this.nodeId)
    }
  }

  private _onPointerOut = (): void => {
    if (useCanvasStore.getState().connectHoverTargetId === this.nodeId) {
      useCanvasStore.getState().setConnectHoverTargetId(null)
    }
  }

  private _beginDrag(e: FederatedPointerEvent): void {
    this.isDragging = true
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
      useCanvasStore.getState().updateNodePosition(this.nodeId, isoToNode(col, row))
    }
  }

  syncNode(node: CanvasNode): void {
    const replicas = typeof node.config.replicas === 'number' ? node.config.replicas : 1
    const needsRebuild = node.type !== this._prevType || replicas !== this._prevReplicas
    if (needsRebuild) {
      this._build(node)
      this._prevType = node.type
      this._prevReplicas = replicas
      this._updateHitArea(node.type)
    } else {
      if (this.labelText.text !== node.label) this.labelText.text = node.label
      this._updateStatusDot(node.status)
    }
    this._syncPosition(node.position)
    this.setWalkthroughVisual(this.walkthroughRole)
    if (this.selectionOverlay) this.setSelected(true)
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
    const sH = COMPONENT_COLORS[this._prevType]?.sideHeight ?? 30
    const pad = 8
    return {
      pad,
      x: -pad,
      y: -TILE_H / 2 - sH - pad,
      w: TILE_W + pad * 2,
      h: TILE_H + sH + 30 + pad * 2,
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
      return
    }
    if (this.selectionOverlay) {
      this.removeChild(this.selectionOverlay)
      this.selectionOverlay.destroy()
    }
    const g = new Graphics()
    const colors = COMPONENT_COLORS[this._prevType]
    const sH = colors?.sideHeight ?? 30
    const pad = 8
    g.roundRect(
      -pad,
      -TILE_H / 2 - sH - pad,
      TILE_W + pad * 2,
      TILE_H + sH + 30 + pad * 2,
      6,
    )
    g.stroke({ color: 0x00aeef, width: 2, alpha: 0.8 })

    this.selectionOverlay = g
    this.addChild(g)
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this._stopWalkthroughPulse()
    this.off('pointerdown', this._onPointerDown)
    this.off('pointerover', this._onPointerOver)
    this.off('pointerout', this._onPointerOut)
    this.viewport.off('pointermove', this._onDragMove)
    this.viewport.off('pointerup', this._onDragEnd)
    this.viewport.off('pointerupoutside', this._onDragEnd)
    super.destroy(options)
  }
}
