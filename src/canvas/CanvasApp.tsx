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
  fitViewportToNodes,
  nodeTopologyKey,
  shouldFitViewportToNodes,
} from './utils/viewportFit'
import { useCanvasStore, type CanvasNode, isCanvasEditMode } from '../editor-core/stores/canvasStore'
import { placeFromPicker } from '../lib/pickerPlacement'

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
      await Assets.load('/spritesheets/components.json')
      if (disposed) {
        destroyApp()
        return
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
        unregisterCanvasFitScheduler()
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
        const rect = canvasRef.current.getBoundingClientRect()
        const canvasX = e.clientX - rect.left
        const canvasY = e.clientY - rect.top
        const world = viewportRef.current.toWorld(canvasX, canvasY)
        const iso = screenToIso(world.x, world.y)
        const { col, row } = clampIsoCell(iso.col, iso.row)
        const pos = isoToNode(col, row)
        placePickerNode(type, pos)
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  )
}
