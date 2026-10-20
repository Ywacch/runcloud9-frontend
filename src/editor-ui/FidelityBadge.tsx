export type FidelityTag = 'real' | 'simulated' | 'compressed'

const styles: Record<FidelityTag, string> = {
  real: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
  simulated: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  compressed: 'border-violet-500/40 bg-violet-500/15 text-violet-200',
}

function isFidelity(value: string): value is FidelityTag {
  return value === 'real' || value === 'simulated' || value === 'compressed'
}

/** Shown when a rule or chaos scenario carries a fidelity tag. */
export function FidelityBadge({ fidelity }: { fidelity: string }) {
  if (!isFidelity(fidelity)) return null
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${styles[fidelity]}`}
    >
      {fidelity}
    </span>
  )
}
