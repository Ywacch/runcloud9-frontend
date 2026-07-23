import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { DemoCube } from './components/DemoCube'
import { Floor, type GridMode } from './components/Floor'
import { GridPatterns } from './components/GridPatterns'
import { isoToScreen, screenToIso, snapWorld, type WorldPoint } from './math/iso'

const MIN_VIEW = 400
const MAX_VIEW = 8000
const ZOOM_FACTOR = 1.12

type ViewBox = { x: number; y: number; w: number; h: number }

/** Closer default zoom so ~a handful of major cells fill the viewport (Cloudcraft-like). */
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
  /** Committed (snapped) rest position. */
  const [cube, setCube] = useState<WorldPoint>(() => isoToScreen(0.5, -0.5))
  /** Live drag position — continuous while dragging (Cloudcraft glide). */
  const [dragPos, setDragPos] = useState<WorldPoint | null>(null)
  const [spaceDown, setSpaceDown] = useState(false)
  const [panning, setPanning] = useState(false)
  const [dragging, setDragging] = useState(false)
  const panLast = useRef<{ x: number; y: number } | null>(null)
  const grabOffset = useRef<WorldPoint>({ x: 0, y: 0 })
  const dragPosRef = useRef<WorldPoint | null>(null)

  const displayCube = dragPos ?? cube

  // Resize → keep world center, match aspect
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
      if (e.code === 'Space') {
        e.preventDefault()
        setSpaceDown(true)
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
  }, [])

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

  const beginCubeDrag = useCallback(
    (e: ReactPointerEvent<SVGGElement>) => {
      if (e.button !== 0 || spaceDown) return
      e.stopPropagation()
      const svg = svgRef.current
      if (!svg) return
      const world = clientToWorld(svg, e.clientX, e.clientY)
      grabOffset.current = { x: displayCube.x - world.x, y: displayCube.y - world.y }
      dragPosRef.current = displayCube
      setDragging(true)
      setDragPos(displayCube)
      svg.setPointerCapture(e.pointerId)
    },
    [displayCube, spaceDown],
  )

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg) return
      // Empty-canvas pan: left-drag, middle-drag, or Space+drag (Cloudcraft-style).
      // Cube drag uses stopPropagation so it never reaches here.
      if (e.button !== 0 && e.button !== 1) return
      if (e.button === 1) e.preventDefault()
      setPanning(true)
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
        panLast.current = { x: e.clientX, y: e.clientY }
        const rect = svg.getBoundingClientRect()
        setView((v) => ({
          ...v,
          x: v.x - (dx / rect.width) * v.w,
          y: v.y - (dy / rect.height) * v.h,
        }))
        return
      }

      if (!dragging) return

      const world = clientToWorld(svg, e.clientX, e.clientY)
      const next = {
        x: world.x + grabOffset.current.x,
        y: world.y + grabOffset.current.y,
      }
      // Glide with the pointer — no snap while moving.
      dragPosRef.current = next
      setDragPos(next)
    },
    [panning, dragging],
  )

  const endPointer = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (dragging) {
        const live = dragPosRef.current ?? cube
        const landed = snapWorld(live.x, live.y)
        dragPosRef.current = null
        setCube(landed)
        setDragPos(null)
        setDragging(false)
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        return
      }
      if (panning) {
        setPanning(false)
        panLast.current = null
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
      }
    },
    [dragging, cube, panning],
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

  const latticeHint = useMemo(() => {
    const p = displayCube
    const snapped = snapWorld(p.x, p.y)
    const iso = screenToIso(snapped.x, snapped.y)
    const live = dragging ? 'glide' : 'rest'
    return `${live} ${p.x.toFixed(0)},${p.y.toFixed(0)} → snap (${iso.i.toFixed(1)}, ${iso.j.toFixed(1)})`
  }, [displayCube, dragging])

  const viewBoxStr = `${view.x} ${view.y} ${view.w} ${view.h}`
  const cursor = panning || dragging
    ? 'cursor-grabbing'
    : spaceDown
      ? 'cursor-grab'
      : 'cursor-grab'

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-[#f4f5f7]">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-200 bg-white/95 px-3 py-2 text-sm text-zinc-600">
        <span className="font-medium text-zinc-900">SVG canvas spike</span>
        <span className="text-zinc-300">|</span>
        <span className="text-zinc-500">
          Drag empty to pan · drag cube to move · wheel zoom
        </span>
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
          <DemoCube
            x={displayCube.x}
            y={displayCube.y}
            interactive={!panning && !spaceDown}
            onPointerDown={beginCubeDrag}
          />
        </svg>
      </div>
    </div>
  )
}
