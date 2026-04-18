import { useEffect, useState } from 'react'
import { useCanvasStore } from '../store/canvasStore'
import { useSimulationStore } from '../store/simulationStore'

export function SimulationOverlay() {
  const mode = useCanvasStore((s) => s.mode)
  const running = useSimulationStore((s) => s.running)
  const paused = useSimulationStore((s) => s.paused)
  const tick = useSimulationStore((s) => s.tick)
  const lastTickWallClockMs = useSimulationStore((s) => s.lastTickWallClockMs)
  const loadFactor = useSimulationStore((s) => s.loadFactor)
  const simulationSpeed = useSimulationStore((s) => s.simulationSpeed)
  const error = useSimulationStore((s) => s.error)
  const lastDiagnostics = useSimulationStore((s) => s.lastDiagnostics)
  const start = useSimulationStore((s) => s.start)
  const stop = useSimulationStore((s) => s.stop)
  const pause = useSimulationStore((s) => s.pause)
  const resume = useSimulationStore((s) => s.resume)
  const setLoadFactor = useSimulationStore((s) => s.setLoadFactor)
  const setSimulationSpeed = useSimulationStore((s) => s.setSimulationSpeed)

  const [diagOpen, setDiagOpen] = useState(false)
  const [, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!running || paused) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [running, paused])

  if (mode !== 'simulate') return null

  const showDiagnostics = running && lastDiagnostics.length > 0

  let tickAgeLabel: string | null = null
  if (running && !paused) {
    if (lastTickWallClockMs == null) {
      tickAgeLabel = 'Waiting for first tick…'
    } else {
      const sec = Math.max(0, Math.floor((Date.now() - lastTickWallClockMs) / 1000))
      tickAgeLabel = sec === 0 ? 'Last tick: just now' : `Last tick: ${sec}s ago`
    }
  }

  return (
    <div className="pointer-events-auto flex w-full min-w-0 flex-col gap-1.5">
      <div className="flex min-h-0 flex-wrap items-center gap-1.5 rounded-lg border border-violet-400/35 bg-violet-950/70 px-2 py-1.5 text-sm shadow-md backdrop-blur-md">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-violet-100">
          Simulation
        </span>
        <span className="shrink-0 text-zinc-500">|</span>
        <span className="shrink-0 whitespace-nowrap text-xs">
          <span className="font-semibold text-zinc-200">Tick</span>{' '}
          <span className="font-mono font-semibold text-zinc-50">{tick}</span>
        </span>
        <span className="shrink-0 text-zinc-500">|</span>
        <label className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs">
          <span className="font-semibold text-zinc-200">Speed</span>
          <input
            type="range"
            min={25}
            max={400}
            value={Math.round(simulationSpeed * 100)}
            onChange={(e) => setSimulationSpeed(Number(e.target.value) / 100)}
            className="h-1.5 w-20 accent-violet-400"
          />
          <span className="w-9 font-mono text-[11px] font-semibold text-zinc-50">
            {simulationSpeed.toFixed(2)}×
          </span>
        </label>
        <span className="shrink-0 text-zinc-500">|</span>
        <label className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs">
          <span className="font-semibold text-zinc-200">Traffic</span>
          <input
            type="range"
            min={5}
            max={300}
            value={Math.round(loadFactor * 100)}
            onChange={(e) => setLoadFactor(Number(e.target.value) / 100)}
            className="h-1.5 w-20 accent-violet-400"
          />
          <span className="w-7 font-mono text-[11px] font-semibold text-zinc-50">
            {loadFactor.toFixed(2)}×
          </span>
        </label>
        <span className="shrink-0 text-zinc-500">|</span>
        {!running ? (
          <button
            type="button"
            onClick={start}
            className="shrink-0 rounded bg-violet-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-violet-500"
          >
            Start
          </button>
        ) : paused ? (
          <button
            type="button"
            onClick={resume}
            className="shrink-0 rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-emerald-500"
          >
            Resume
          </button>
        ) : (
          <button
            type="button"
            onClick={pause}
            className="shrink-0 rounded bg-amber-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-amber-500"
          >
            Pause
          </button>
        )}
        {running ? (
          <>
            <span className="shrink-0 text-zinc-500">|</span>
            <button
              type="button"
              onClick={stop}
              className="shrink-0 rounded border border-amber-500/60 bg-amber-950/70 px-2 py-0.5 text-[11px] font-semibold text-amber-100 hover:bg-amber-900/70"
            >
              Stop
            </button>
          </>
        ) : null}
        {showDiagnostics ? (
          <>
            <span className="shrink-0 text-zinc-500">|</span>
            <button
              type="button"
              onClick={() => setDiagOpen((o) => !o)}
              className="shrink-0 rounded border border-amber-500/50 bg-amber-950/60 px-1.5 py-0.5 text-[11px] font-semibold text-amber-100 backdrop-blur-sm hover:bg-amber-900/55"
            >
              Diag ({lastDiagnostics.length})
              <span className="ml-0.5 font-normal text-amber-200">
                {diagOpen ? '▾' : '▸'}
              </span>
            </button>
          </>
        ) : null}
      </div>
      {running && paused ? (
        <p className="px-0.5 text-[11px] font-medium text-amber-100/90">
          Paused — metrics and inspector are frozen.
        </p>
      ) : null}
      {tickAgeLabel ? (
        <p className="px-0.5 text-[11px] text-violet-200/85">{tickAgeLabel}</p>
      ) : null}
      <p className="px-0.5 text-[10px] leading-snug text-violet-300/65">
        Local model — not production telemetry.
      </p>
      {diagOpen && showDiagnostics ? (
        <ul className="max-h-48 w-full overflow-y-auto rounded-lg border border-amber-600/40 bg-gray-950/70 px-2.5 py-1.5 text-left text-[11px] font-medium text-zinc-100 shadow-md backdrop-blur-md">
          {lastDiagnostics.map((d, i) => (
            <li key={i} className="border-b border-amber-900/35 py-1 last:border-0">
              {d}
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p className="max-w-full rounded border border-red-700/50 bg-red-950/65 px-2 py-1 text-left text-xs font-medium text-red-100 backdrop-blur-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}
