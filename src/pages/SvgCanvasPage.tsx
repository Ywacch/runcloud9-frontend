import { Link } from 'react-router-dom'
import SvgDesignCanvas from '../svg-canvas/SvgDesignCanvas'

/**
 * Isolated Phase 0–1 SVG Design surface. Pixi `/canvas` stays untouched.
 * Design floor is light (Cloudcraft-faithful); chrome matches.
 */
export default function SvgCanvasPage() {
  return (
    <div className="flex h-dvh w-full flex-col bg-white text-zinc-800">
      <div className="flex shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4 py-2 text-sm">
        <Link to="/" className="font-semibold tracking-tight text-zinc-900 hover:text-zinc-700">
          RunCloud9
        </Link>
        <span className="text-zinc-300">/</span>
        <span className="text-zinc-500">canvas-svg</span>
        <Link
          to="/canvas"
          className="ml-auto rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-500 hover:border-zinc-400 hover:text-zinc-800"
        >
          Open Pixi canvas
        </Link>
      </div>
      <div className="min-h-0 flex-1">
        <SvgDesignCanvas />
      </div>
    </div>
  )
}
