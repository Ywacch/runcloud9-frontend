import type { ResourceBudgetErrorResponse } from '../lib/sumDesignBudget'

export function ResourceBudgetBreakdown({
  budget,
}: {
  budget: ResourceBudgetErrorResponse
}) {
  return (
    <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-3 text-sm">
      <div className="grid grid-cols-2 gap-2 font-mono text-[11px] text-[var(--c9-text)]">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--c9-muted)]">
            Requested
          </p>
          <p>
            {budget.requested.cpu} CPU · {budget.requested.memory} RAM
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--c9-muted)]">
            Plan cap ({budget.tier})
          </p>
          <p>
            {budget.cap.cpu} CPU · {budget.cap.memory} RAM
          </p>
        </div>
      </div>
      <table className="mt-3 w-full border-collapse text-left font-mono text-[10px]">
        <thead>
          <tr className="text-[var(--c9-muted)]">
            <th className="pb-1 pr-2 font-medium">Component</th>
            <th className="pb-1 pr-2 font-medium">CPU</th>
            <th className="pb-1 font-medium">Memory</th>
          </tr>
        </thead>
        <tbody>
          {budget.breakdown.map((row) => (
            <tr key={row.label} className="border-t border-white/10 text-[var(--c9-text)]">
              <td className="py-1 pr-2">{row.label}</td>
              <td className="py-1 pr-2">{row.cpu}</td>
              <td className="py-1">{row.memory}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
