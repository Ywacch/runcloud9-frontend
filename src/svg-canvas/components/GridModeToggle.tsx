import type { GridMode } from './Floor'

const OPTIONS: { value: GridMode; label: string }[] = [
  { value: 'infinite', label: 'Infinite' },
  { value: 'bounded', label: 'Bounded' },
  { value: 'off', label: 'Off' },
]

type Props = {
  mode: GridMode
  onChange: (mode: GridMode) => void
  compact?: boolean
}

/**
 * Infinite / Bounded / Off grid floor control for the SVG design host.
 */
export function GridModeToggle({ mode, onChange, compact = false }: Props) {
  const btn = compact
    ? 'rounded px-2 py-1 text-[10px]'
    : 'rounded px-2 py-1 text-xs'
  const shell = compact
    ? 'pointer-events-auto flex rounded-md border border-zinc-300/80 bg-white/90 p-0.5 shadow-sm backdrop-blur-sm'
    : 'flex rounded-md border border-zinc-300 p-0.5'

  return (
    <div className={shell} role="group" aria-label="Grid mode">
      {OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          className={`${btn} ${
            mode === value
              ? 'bg-zinc-800 text-white'
              : 'text-zinc-500 hover:text-zinc-800'
          }`}
          aria-pressed={mode === value}
          onClick={() => onChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
