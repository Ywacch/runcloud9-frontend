import {
  Container,
  Graphics,
  Rectangle,
  Text,
  TextStyle,
  type FederatedPointerEvent,
} from 'pixi.js'
import type { Viewport } from 'pixi-viewport'
import { TILE_W, TILE_H, isoToScreen, screenToIso } from '../constants'
import { COMPONENT_COLORS } from '../config/componentColors'
import { nodeToIso, isoToNode } from '../utils/positionAdapter'
import { defaultEdgeProtocol } from '../../lib/defaultEdgeProtocol'
import {
  isCanvasEditMode,
  useCanvasStore,
  type CanvasNode,
} from '../../editor-core/stores/canvasStore'

export class ComponentContainer extends Container {
  private readonly nodeId: string
  private readonly viewport: Viewport
  private isDragging = false
  private dragStartIso = { col: 0, row: 0 }
  private selectionOverlay: Graphics | null = null
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
    this.hitArea = new Rectangle(-TILE_W / 2 - 8, -8, TILE_W + 16, h)
  }

  private _syncPosition(pos: [number, number, number]): void {
    const { col, row } = nodeToIso(pos)
    const screen = isoToScreen(col, row)
    this.position.set(screen.x, screen.y)
    this.zIndex = col + row
  }

  private _build(node: CanvasNode): void {
    this.removeChildren()
    this.selectionOverlay = null
    this.replicaBadge = null

    const colors = COMPONENT_COLORS[node.type]
    const replicas = typeof node.config.replicas === 'number' ? node.config.replicas : 1
    const sH = colors.sideHeight

    const cappedLayers = Math.min(replicas, 3)

    for (let i = cappedLayers - 1; i >= 0; i--) {
      const ox = i * 7
      const oy = -i * 7
      const g = new Graphics()

      if (i === 0) {
        g.poly([
          ox,
          oy,
          ox + TILE_W / 2,
          oy + TILE_H / 2,
          ox,
          oy + TILE_H,
          ox - TILE_W / 2,
          oy + TILE_H / 2,
        ]).fill({ color: colors.top })
        g.poly([
          ox - TILE_W / 2,
          oy + TILE_H / 2,
          ox,
          oy + TILE_H,
          ox,
          oy + TILE_H + sH,
          ox - TILE_W / 2,
          oy + TILE_H / 2 + sH,
        ]).fill({ color: colors.left })
        g.poly([
          ox,
          oy + TILE_H,
          ox + TILE_W / 2,
          oy + TILE_H / 2,
          ox + TILE_W / 2,
          oy + TILE_H / 2 + sH,
          ox,
          oy + TILE_H + sH,
        ]).fill({ color: colors.right })
      } else {
        const darken = (hex: number) => {
          const r = Math.floor(((hex >> 16) & 0xff) * 0.72)
          const gr = Math.floor(((hex >> 8) & 0xff) * 0.72)
          const b = Math.floor((hex & 0xff) * 0.72)
          return (r << 16) | (gr << 8) | b
        }
        g.poly([
          ox,
          oy,
          ox + TILE_W / 2,
          oy + TILE_H / 2,
          ox,
          oy + TILE_H,
          ox - TILE_W / 2,
          oy + TILE_H / 2,
        ])
          .fill({ color: darken(colors.top) })
          .stroke({ color: 0x000000, width: 0.5, alpha: 0.3 })
      }

      this.addChild(g)
    }

    this.labelText = new Text({
      text: node.label,
      style: new TextStyle({
        fontSize: 11,
        fill: 0xe2e8f0,
        fontFamily: 'Inter, system-ui, sans-serif',
      }),
    })
    this.labelText.eventMode = 'none'
    this.labelText.anchor.set(0.5, 0)
    this.labelText.position.set(0, TILE_H + sH + 8)
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
      this.replicaBadge.position.set(TILE_W / 2 + topLayerOffset + 4, -topLayerOffset - 4)
      this.addChild(this.replicaBadge)
    }

    this.statusDot = new Graphics()
    this.statusDot.position.set(TILE_W / 2 + 4, TILE_H / 2 - 6)
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
    const col = Math.round(iso.col)
    const row = Math.round(iso.row)
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
    const col = Math.round(iso.col)
    const row = Math.round(iso.row)
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
    if (this.selectionOverlay) this.setSelected(true)
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
    const diamond = [
      0,
      0,
      TILE_W / 2,
      TILE_H / 2,
      0,
      TILE_H,
      -TILE_W / 2,
      TILE_H / 2,
    ] as number[]

    g.poly(diamond).stroke({ color: 0xa78bfa, width: 8, alpha: 0.22, alignment: 0.5 })
    g.poly(diamond).stroke({ color: 0xc4b5fd, width: 2.5, alignment: 0.5 })

    this.selectionOverlay = g
    this.addChild(g)
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.off('pointerdown', this._onPointerDown)
    this.off('pointerover', this._onPointerOver)
    this.off('pointerout', this._onPointerOut)
    this.viewport.off('pointermove', this._onDragMove)
    this.viewport.off('pointerup', this._onDragEnd)
    this.viewport.off('pointerupoutside', this._onDragEnd)
    super.destroy(options)
  }
}
