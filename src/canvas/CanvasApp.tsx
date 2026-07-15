import { useEffect, useRef } from 'react'
import { Assets, type FederatedPointerEvent } from 'pixi.js'
import type { Viewport } from 'pixi-viewport'
import { createApp, destroyApp } from './engine/app'
import { createViewport } from './engine/viewport'
import { GridLayer } from './layers/GridLayer'
import { ConnectionLayer } from './layers/ConnectionLayer'
import { ConnectionPreview } from './layers/ConnectionPreview'
import { TrafficLayer } from './layers/TrafficLayer'
import { ComponentLayer } from './layers/ComponentLayer'
import { screenToIso } from './constants'
import { isoToNode, clampIsoCell } from './utils/positionAdapter'
import {
  registerCanvasFitScheduler,
  unregisterCanvasFitScheduler,
} from './utils/canvasFitBridge'
import {
  registerCanvasViewport,
  unregisterCanvasViewport,
} from './utils/canvasViewportBridge'
import { CanvasNodeTooltipOverlay } from './CanvasNodeTooltipOverlay'
import { CanvasContextMenu } from '../editor-ui/CanvasContextMenu'
import {
  fitViewportToNodes,
  nodeTopologyKey,
  shouldFitViewportToNodes,
} from './utils/viewportFit'
import { useCanvasStore, type CanvasNode, isCanvasEditMode } from '../editor-core/stores/canvasStore'
import { useCanvasContextMenuStore } from '../editor-core/stores/contextMenuStore'
import { placeFromPicker } from '../lib/pickerPlacement'
import {
  canvasClientToWorldPos,
  findNodeIdAtClientPoint,
} from '../lib/canvasContextHitTest'
import { canPlaceOnCanvas } from '../lib/canvasContextMenuCatalog'
import { SPAWN_AT_SCREEN, type SpawnAtScreenDetail } from '../lib/spawnEvents'
import { USE_SPRITE_COMPONENTS } from './config/renderMode'
import { markAtlasReady } from './sprites/atlasState'
import { EXPECTED_ATLAS_FRAMES } from './sprites/spriteFrames'

function placePickerNode(
  nodeType: CanvasNode['type'],
  position: [number, number, number],
): void {
  const state = useCanvasStore.getState()
  placeFromPicker({
    nodeType,
    position,
    nodes: state.nodes,
    addNode: state.addNode,
    updateNodeConfig: state.updateNodeConfig,
    selectNode: state.selectNode,
  })
  state.setPlacingNodeType(null)
}

const PALETTE_TYPES = new Set<CanvasNode['type']>([
  'load_balancer',
  'compute',
  'database',
  'cache',
  'message_queue',
  'worker',
])

function isPaletteNodeType(raw: string): raw is CanvasNode['type'] {
  return PALETTE_TYPES.has(raw as CanvasNode['type'])
}

function placeAtScreenCoords(
  viewport: Viewport,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  nodeType: CanvasNode['type'],
): void {
  const rect = canvas.getBoundingClientRect()
  const canvasX = clientX - rect.left
  const canvasY = clientY - rect.top
  const world = viewport.toWorld(canvasX, canvasY)
  const iso = screenToIso(world.x, world.y)
  const { col, row } = clampIsoCell(iso.col, iso.row)
  placePickerNode(nodeType, isoToNode(col, row))
}

export default function CanvasApp() {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef<Viewport | null>(null)

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return

    let disposed = false
    let fitGeneration = 0
    let teardown = () => {}

    const init = async () => {
      const app = await createApp(canvas, host)
      if (disposed) {
        destroyApp()
        return
      }
      if (USE_SPRITE_COMPONENTS) {
        try {
          const sheet = (await Assets.load('/spritesheets/components.json')) as {
            textures?: Record<string, unknown>
          }
          const missing = EXPECTED_ATLAS_FRAMES.filter(
            (frame) => !sheet?.textures?.[frame],
          )
          if (missing.length > 0) {
            console.warn(
              `Sprite atlas is missing frames [${missing.join(', ')}]; falling back to procedural rendering.`,
            )
          } else {
            markAtlasReady()
          }
        } catch (err) {
          console.warn(
            'Sprite atlas failed to load; falling back to procedural rendering.',
            err,
          )
        }
        if (disposed) {
          destroyApp()
          return
        }
      }
      const viewport = createViewport(app)
      viewportRef.current = viewport

      const scheduleFit = () => {
        const gen = ++fitGeneration
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              if (disposed || gen !== fitGeneration) return
              viewport.resize(app.renderer.screen.width, app.renderer.screen.height)
              fitViewportToNodes(viewport, useCanvasStore.getState().nodes)
            }),
          ),
        )
      }

      registerCanvasFitScheduler(scheduleFit)
      registerCanvasViewport(viewport)

      if (import.meta.env.DEV) {
        ;(window as unknown as { __c9Canvas?: object }).__c9Canvas = {
          viewport,
          scheduleFit,
          readState: () => ({
            center: { x: viewport.center.x, y: viewport.center.y },
            scale: viewport.scale.x,
            screen: { w: viewport.screenWidth, h: viewport.screenHeight },
            pos: { x: viewport.x, y: viewport.y },
            nodeCount: Object.keys(useCanvasStore.getState().nodes).length,
          }),
        }
      }

      viewport.on('pointerdown', (e: FederatedPointerEvent) => {
        if (e.button !== 0) return
        const state = useCanvasStore.getState()
        if (state.placingNodeType) {
          if (state.movementLocked) return
          if (state.mode === 'live') return
          const world = viewport.toWorld(e.global.x, e.global.y)
          const iso = screenToIso(world.x, world.y)
          const { col, row } = clampIsoCell(iso.col, iso.row)
          const pos = isoToNode(col, row)
          placePickerNode(state.placingNodeType, pos)
          return
        }
        if (
          state.designTool === 'connect' &&
          state.pendingSourceId &&
          isCanvasEditMode(state.mode)
        ) {
          state.setPendingSource(null)
        }
      })

      const grid = new GridLayer(viewport)
      viewport.addChild(grid)

      const componentLayer = new ComponentLayer(viewport)
      viewport.addChild(componentLayer)

      const connectionLayer = new ConnectionLayer()
      viewport.addChild(connectionLayer)

      const connectionPreview = new ConnectionPreview(viewport)
      viewport.addChild(connectionPreview)

      const trafficLayer = new TrafficLayer()
      viewport.addChild(trafficLayer)

      const initial = useCanvasStore.getState()
      let prevNodeKey = nodeTopologyKey(initial.nodes)
      let prevNodeCount = Object.keys(initial.nodes).length
      let prevTemplateId = initial.snapshotTemplateId

      if (prevNodeCount > 0) {
        scheduleFit()
      }

      const onSpawnAtScreen = (event: Event) => {
        const detail = (event as CustomEvent<SpawnAtScreenDetail>).detail
        if (!detail || !isPaletteNodeType(detail.nodeType)) return
        if (useCanvasStore.getState().mode === 'live') return
        placeAtScreenCoords(viewport, canvas, detail.clientX, detail.clientY, detail.nodeType)
      }
      window.addEventListener(SPAWN_AT_SCREEN, onSpawnAtScreen)

      const onContextMenu = (event: MouseEvent) => {
        event.preventDefault()
        const vp = viewportRef.current
        if (!vp || !canvas) return
        const state = useCanvasStore.getState()
        const hitId = findNodeIdAtClientPoint(
          vp,
          canvas,
          event.clientX,
          event.clientY,
          state.nodes,
        )
        const menuStore = useCanvasContextMenuStore.getState()
        if (hitId) {
          menuStore.openNode({
            clientX: event.clientX,
            clientY: event.clientY,
            nodeId: hitId,
          })
          return
        }
        if (!canPlaceOnCanvas(state.mode, state.movementLocked)) {
          menuStore.close()
          return
        }
        const { position } = canvasClientToWorldPos(
          vp,
          canvas,
          event.clientX,
          event.clientY,
        )
        menuStore.openCreate({
          clientX: event.clientX,
          clientY: event.clientY,
          position,
        })
      }
      host.addEventListener('contextmenu', onContextMenu)

      const unsubStore = useCanvasStore.subscribe((state) => {
        const nextKey = nodeTopologyKey(state.nodes)
        const nextCount = Object.keys(state.nodes).length
        let fit = false

        if (
          state.snapshotTemplateId !== prevTemplateId &&
          state.snapshotTemplateId &&
          nextCount > 0
        ) {
          fit = true
        }

        if (
          !fit &&
          shouldFitViewportToNodes(prevNodeKey, nextKey, prevNodeCount, nextCount)
        ) {
          fit = true
        }

        prevTemplateId = state.snapshotTemplateId
        prevNodeKey = nextKey
        prevNodeCount = nextCount

        if (fit) scheduleFit()
      })

      teardown = () => {
        window.removeEventListener(SPAWN_AT_SCREEN, onSpawnAtScreen)
        host.removeEventListener('contextmenu', onContextMenu)
        unregisterCanvasFitScheduler()
        unregisterCanvasViewport()
        if (import.meta.env.DEV) {
          delete (window as unknown as { __c9Canvas?: object }).__c9Canvas
        }
        unsubStore()
        trafficLayer.destroy()
        connectionPreview.destroy()
        connectionLayer.destroy()
        componentLayer.destroy()
        grid.destroy()
        viewport.destroy()
        viewportRef.current = null
        destroyApp()
      }
    }

    void init()
    return () => {
      disposed = true
      fitGeneration++
      teardown()
    }
  }, [])

  return (
    <div
      ref={hostRef}
      className="h-full w-full"
      style={{ width: '100%', height: '100%', position: 'relative', background: '#13111c' }}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        const type = e.dataTransfer.getData('application/runcloud9-node-type')
        if (!type || !isPaletteNodeType(type)) return
        if (!viewportRef.current || !canvasRef.current) return
        if (useCanvasStore.getState().mode === 'live') return
        placeAtScreenCoords(viewportRef.current, canvasRef.current, e.clientX, e.clientY, type)
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      <CanvasNodeTooltipOverlay />
      <CanvasContextMenu />
    </div>
  )
}
