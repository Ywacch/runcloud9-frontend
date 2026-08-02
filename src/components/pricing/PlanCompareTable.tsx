import { TIER_COMPARE_ROWS } from '../../lib/billingCopy'

export function PlanCompareTable() {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--c9-border)] bg-[var(--c9-surface)]/40">
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--c9-border)] text-xs uppercase tracking-wider text-[var(--c9-muted)]">
            <th className="px-4 py-3 font-semibold">Feature</th>
            <th className="px-4 py-3 font-semibold">Explorer</th>
            <th className="px-4 py-3 font-semibold">Engineer</th>
          </tr>
        </thead>
        <tbody>
          {TIER_COMPARE_ROWS.map((row) => (
            <tr
              key={row.id}
              className="border-b border-[var(--c9-border)] last:border-0"
            >
              <th
                scope="row"
                className="px-4 py-3 font-medium text-[var(--c9-text)]"
              >
                {row.label}
              </th>
              <td className="px-4 py-3 text-[var(--c9-muted)]">{row.explorer}</td>
              <td className="px-4 py-3 text-[var(--c9-text)]">{row.engineer}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
