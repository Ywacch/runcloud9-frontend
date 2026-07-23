import { useSvgCanvasStore } from '../store/svgCanvasStore'

export function ConnectToggle() {
  const connectMode = useSvgCanvasStore((s) => s.connectMode)
  const setConnectMode = useSvgCanvasStore((s) => s.setConnectMode)

  return (
    <div className="ml-2 flex items-center gap-1 rounded-md border border-zinc-300 p-0.5">
      <button
        type="button"
        className={`rounded px-2 py-1 text-xs ${
          connectMode
            ? 'bg-blue-600 text-white'
            : 'text-zinc-500 hover:text-zinc-800'
        }`}
        aria-pressed={connectMode}
        onClick={() => setConnectMode(!connectMode)}
      >
        Connect
      </button>
    </div>
  )
}
