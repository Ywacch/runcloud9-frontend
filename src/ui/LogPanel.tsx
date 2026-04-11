import { useEffect, useRef, useState } from 'react'
import { useCanvasStore } from '../store/canvasStore'
import { useLogStore } from '../store/logStore'

const COMPONENT_COLORS: Record<string, string> = {
  'app-server': '#8A9BB0',
  db: '#5C6B7A',
  cache: '#C0392B',
  lb: '#4A90D9',
  mq: '#E05E8A',
  worker: '#A78BFA',
}

function logLevelClass(msg: string): string {
  const lower = msg.toLowerCase()
  if (lower.includes('error') || lower.includes('err')) return 'text-red-400'
  if (lower.includes('warn')) return 'text-amber-400'
  return 'text-gray-400'
}

export function LogPanel() {
  const mode = useCanvasStore((s) => s.mode)
  const logs = useLogStore((s) => s.logs)
  const [open, setOpen] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs.length, open])

  if (mode !== 'live') return null

  return (
    <div className="pointer-events-auto absolute bottom-0 left-0 right-0 z-20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full border-t border-gray-700 bg-gray-900/95 px-4 py-2 text-left text-xs font-medium text-gray-400 backdrop-blur-sm hover:text-white"
      >
        {open ? '▼ Hide Logs' : '▲ Show Logs'} ({logs.length})
      </button>
      {open ? (
        <div className="max-h-48 overflow-y-auto bg-gray-900/95 px-4 py-2 font-mono text-xs backdrop-blur-sm">
          {logs.slice(-200).map((l, i) => (
            <div
              key={`${l.timestamp}-${i}-${l.component}`}
              className="flex gap-2 border-b border-gray-800/50 py-1"
            >
              <span className="shrink-0 text-gray-600">
                {new Date(l.timestamp).toLocaleTimeString('en-US', {
                  hour12: false,
                })}
              </span>
              <span
                className="shrink-0 rounded px-1 text-[10px]"
                style={{ color: COMPONENT_COLORS[l.component] ?? '#888' }}
              >
                {l.component}
              </span>
              <span className={logLevelClass(l.message)}>{l.message}</span>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      ) : null}
    </div>
  )
}
