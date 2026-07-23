import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { AppServerGlyph } from './components/AppServerGlyph'
import { Floor, type GridMode } from './components/Floor'
import { GridPatterns } from './components/GridPatterns'
import { MiniPalette } from './components/MiniPalette'
import { screenToIso, snapWorld, type WorldPoint } from './math/iso'
import { useSvgCanvasStore } from './store/svgCanvasStore'

const MIN_VIEW = 400
const MAX_VIEW = 8000
const ZOOM_FACTOR = 1.12
/** Below this screen-px travel, empty pointer-up is a click (place/deselect), not a pan. */
const CLICK_SLOP_PX = 5

type ViewBox = { x: number; y: number; w: number; h: number }

type DragSession = {
  id: string
  grabOffset: WorldPoint
  livePos: WorldPoint
}

function initialViewBox(hostW: number, hostH: number): ViewBox {
  const aspect = hostW > 0 && hostH > 0 ? hostW / hostH : 16 / 9
  const h = 780
  const w = h * aspect
  return { x: -w / 2, y: -h / 2, w, h }
}

function clientToWorld(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): WorldPoint {
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const local = pt.matrixTransform(ctm.inverse())
  return { x: local.x, y: local.y }
}

export default function SvgDesignCanvas() {
  const hostRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<ViewBox>(() => initialViewBox(1200, 800))
  const [mode, setMode] = useState<GridMode>('infinite')
  const [spaceDown, setSpaceDown] = useState(false)
  const [panning, setPanning] = useState(false)
  const [drag, setDrag] = useState<DragSession | null>(null)
  const panLast = useRef<{ x: number; y: number } | null>(null)
  const panOrigin = useRef<{ x: number; y: number } | null>(null)
  const panMoved = useRef(false)
  const dragRef = useRef<DragSession | null>(null)

  const nodes = useSvgCanvasStore((s) => s.nodes)
  const selectedId = useSvgCanvasStore((s) => s.selectedId)
  const placingArchetype = useSvgCanvasStore((s) => s.placingArchetype)
  const placeNodeAt = useSvgCanvasStore((s) => s.placeNodeAt)
  const selectNode = useSvgCanvasStore((s) => s.selectNode)
  const moveNode = useSvgCanvasStore((s) => s.moveNode)
  const removeSelected = useSvgCanvasStore((s) => s.removeSelected)
  const clearPlacementAndSelection = useSvgCanvasStore(
    (s) => s.clearPlacementAndSelection,
  )

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const sync = () => {
      const { width, height } = host.getBoundingClientRect()
      if (width < 1 || height < 1) return
      setView((v) => {
        const cx = v.x + v.w / 2
        const cy = v.y + v.h / 2
        const aspect = width / height
        const h = v.h
        const w = h * aspect
        return { x: cx - w / 2, y: cy - h / 2, w, h }
      })
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(host)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      if (e.code === 'Space' && !typing) {
        e.preventDefault()
        setSpaceDown(true)
        return
      }
      if (e.key === 'Escape') {
        clearPlacementAndSelection()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !typing) {
        e.preventDefault()
        removeSelected()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [clearPlacementAndSelection, removeSelected])

  const zoomAround = useCallback((factor: number, worldX: number, worldY: number) => {
    setView((v) => {
      const nextW = Math.min(MAX_VIEW, Math.max(MIN_VIEW, v.w * factor))
      const nextH = nextW * (v.h / v.w)
      const rx = (worldX - v.x) / v.w
      const ry = (worldY - v.y) / v.h
      return {
        x: worldX - rx * nextW,
        y: worldY - ry * nextH,
        w: nextW,
        h: nextH,
      }
    })
  }, [])

  const onWheel = useCallback(
    (e: ReactWheelEvent<SVGSVGElement>) => {
      e.preventDefault()
      const svg = svgRef.current
      if (!svg) return
      const world = clientToWorld(svg, e.clientX, e.clientY)
      const factor = e.deltaY > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR
      zoomAround(factor, world.x, world.y)
    },
    [zoomAround],
  )

  const beginNodeDrag = useCallback(
    (nodeId: string, e: ReactPointerEvent<SVGGElement>) => {
      if (e.button !== 0 || spaceDown) return
      e.stopPropagation()
      const svg = svgRef.current
      if (!svg) return
      const node = useSvgCanvasStore.getState().nodes.find((n) => n.id === nodeId)
      if (!node) return
      const world = clientToWorld(svg, e.clientX, e.clientY)
      selectNode(nodeId)
      const session: DragSession = {
        id: nodeId,
        grabOffset: { x: node.x - world.x, y: node.y - world.y },
        livePos: { x: node.x, y: node.y },
      }
      dragRef.current = session
      setDrag(session)
      svg.setPointerCapture(e.pointerId)
    },
    [spaceDown, selectNode],
  )

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg) return
      if (e.button !== 0 && e.button !== 1) return
      if (e.button === 1) e.preventDefault()
      setPanning(true)
      panMoved.current = false
      panOrigin.current = { x: e.clientX, y: e.clientY }
      panLast.current = { x: e.clientX, y: e.clientY }
      svg.setPointerCapture(e.pointerId)
    },
    [],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg) return

      if (panning && panLast.current) {
        const dx = e.clientX - panLast.current.x
        const dy = e.clientY - panLast.current.y
        if (panOrigin.current) {
          const ox = e.clientX - panOrigin.current.x
          const oy = e.clientY - panOrigin.current.y
          if (Math.hypot(ox, oy) > CLICK_SLOP_PX) panMoved.current = true
        }
        panLast.current = { x: e.clientX, y: e.clientY }
        if (panMoved.current) {
          const rect = svg.getBoundingClientRect()
          setView((v) => ({
            ...v,
            x: v.x - (dx / rect.width) * v.w,
            y: v.y - (dy / rect.height) * v.h,
          }))
        }
        return
      }

      const session = dragRef.current
      if (!session) return
      const world = clientToWorld(svg, e.clientX, e.clientY)
      const next = {
        x: world.x + session.grabOffset.x,
        y: world.y + session.grabOffset.y,
      }
      const updated = { ...session, livePos: next }
      dragRef.current = updated
      setDrag(updated)
    },
    [panning],
  )

  const endPointer = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current

      if (dragRef.current) {
        const session = dragRef.current
        moveNode(session.id, session.livePos.x, session.livePos.y)
        dragRef.current = null
        setDrag(null)
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        return
      }

      if (panning) {
        const wasClick = !panMoved.current && e.button === 0 && !spaceDown
        setPanning(false)
        panLast.current = null
        panOrigin.current = null
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }

        if (wasClick && svg) {
          const world = clientToWorld(svg, e.clientX, e.clientY)
          const placing = useSvgCanvasStore.getState().placingArchetype
          if (placing) {
            placeNodeAt(world.x, world.y)
          } else {
            selectNode(null)
          }
        }
      }
    },
    [panning, spaceDown, moveNode, placeNodeAt, selectNode],
  )

  const zoomBy = useCallback(
    (factor: number) => {
      const cx = view.x + view.w / 2
      const cy = view.y + view.h / 2
      zoomAround(factor, cx, cy)
    },
    [view, zoomAround],
  )

  const fitDefault = useCallback(() => {
    const host = hostRef.current
    if (!host) return
    const { width, height } = host.getBoundingClientRect()
    setView(initialViewBox(width, height))
  }, [])

  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => a.y - b.y || a.x - b.x)
  }, [nodes])

  const latticeHint = useMemo(() => {
    const selected = nodes.find((n) => n.id === selectedId)
    const live =
      drag && selectedId === drag.id
        ? drag.livePos
        : selected
          ? { x: selected.x, y: selected.y }
          : null
    if (!live) {
      return placingArchetype
        ? `placing ${placingArchetype} · ${nodes.length} nodes`
        : `${nodes.length} nodes`
    }
    const snapped = snapWorld(live.x, live.y)
    const iso = screenToIso(snapped.x, snapped.y)
    const modeHint = drag ? 'glide' : 'rest'
    return `${modeHint} ${selected?.label ?? ''} → (${iso.i.toFixed(1)}, ${iso.j.toFixed(1)})`
  }, [nodes, selectedId, drag, placingArchetype])

  const viewBoxStr = `${view.x} ${view.y} ${view.w} ${view.h}`
  const cursor = drag
    ? 'cursor-grabbing'
    : panning && panMoved.current
      ? 'cursor-grabbing'
      : placingArchetype
        ? 'cursor-crosshair'
        : spaceDown
          ? 'cursor-grab'
          : 'cursor-grab'

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-[#f4f5f7]">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-200 bg-white/95 px-3 py-2 text-sm text-zinc-600">
        <span className="font-medium text-zinc-900">SVG canvas spike</span>
        <span className="text-zinc-300">|</span>
        <span className="text-zinc-500">
          Place · select · drag snaps on drop · drag empty to pan
        </span>
        <MiniPalette />
        <div className="ml-2 flex rounded-md border border-zinc-300 p-0.5">
          <button
            type="button"
            className={`rounded px-2 py-1 text-xs ${mode === 'infinite' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-800'}`}
            onClick={() => setMode('infinite')}
          >
            Infinite
          </button>
          <button
            type="button"
            className={`rounded px-2 py-1 text-xs ${mode === 'bounded' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-800'}`}
            onClick={() => setMode('bounded')}
          >
            Bounded
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
            onClick={() => zoomBy(ZOOM_FACTOR)}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
            onClick={() => zoomBy(1 / ZOOM_FACTOR)}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
            onClick={fitDefault}
          >
            Reset view
          </button>
        </div>
        <span className="ml-auto text-xs text-zinc-500">{latticeHint}</span>
      </div>

      <div ref={hostRef} className="relative min-h-0 flex-1">
        <svg
          ref={svgRef}
          className={`absolute inset-0 h-full w-full touch-none ${cursor}`}
          viewBox={viewBoxStr}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          role="img"
          aria-label="Isometric SVG design canvas"
        >
          <GridPatterns />
          <rect
            id="interactionLayer"
            x={view.x}
            y={view.y}
            width={view.w}
            height={view.h}
            fill="transparent"
          />
          <Floor
            mode={mode}
            viewX={view.x}
            viewY={view.y}
            viewW={view.w}
            viewH={view.h}
          />
          {sortedNodes.map((node) => {
            const live =
              drag && drag.id === node.id ? drag.livePos : { x: node.x, y: node.y }
            return (
              <AppServerGlyph
                key={node.id}
                x={live.x}
                y={live.y}
                label={node.label}
                selected={node.id === selectedId}
                interactive={!spaceDown && !panning}
                onPointerDown={(ev) => beginNodeDrag(node.id, ev)}
              />
            )
          })}
        </svg>
      </div>
    </div>
  )
}
