import type { EdgeStylePresetId } from '../fx/edgePresets'

const OPTIONS: { value: EdgeStylePresetId; label: string }[] = [
  { value: 'flow', label: 'Flow' },
  { value: 'schematic', label: 'Wire' },
]

type Props = {
  preset: EdgeStylePresetId
  onChange: (preset: EdgeStylePresetId) => void
  compact?: boolean
}

/** Flow (colored) vs Wire (schematic) edge paint for the SVG host. */
export function EdgeStylePresetToggle({
  preset,
  onChange,
  compact = false,
}: Props) {
  const btn = compact
    ? 'rounded px-2 py-1 text-[10px]'
    : 'rounded px-2 py-1 text-xs'
  const shell = compact
    ? 'pointer-events-auto flex rounded-md border border-zinc-300/80 bg-white/90 p-0.5 shadow-sm backdrop-blur-sm'
    : 'flex rounded-md border border-zinc-300 p-0.5'

  return (
    <div className={shell} role="group" aria-label="Edge style">
      {OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          className={`${btn} ${
            preset === value
              ? 'bg-zinc-800 text-white'
              : 'text-zinc-500 hover:text-zinc-800'
          }`}
          aria-pressed={preset === value}
          title={
            value === 'flow'
              ? 'Colored flow connectors'
              : 'High-contrast schematic wires'
          }
          onClick={() => onChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
