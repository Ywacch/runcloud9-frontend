import { TIER_COMPARE_ROWS } from '../../lib/billingCopy'

const LIMIT_IDS = new Set([
  'concurrent',
  'session_length',
  'sessions_month',
  'replicas',
])

const LIMIT_ROWS = TIER_COMPARE_ROWS.filter((row) => LIMIT_IDS.has(row.id))
const CAPABILITY_ROWS = TIER_COMPARE_ROWS.filter((row) => !LIMIT_IDS.has(row.id))

export function PlanCompareTable() {
  return (
    <div className="c9-plan-compare overflow-x-auto rounded-xl border border-[var(--c9-border)] bg-[var(--c9-surface)]/40">
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--c9-border)] text-xs uppercase tracking-wider text-[var(--c9-muted)]">
            <th className="px-4 py-3 font-semibold">Feature</th>
            <th className="px-4 py-3 font-semibold">Free tier</th>
            <th className="px-4 py-3 font-semibold">Engineer</th>
          </tr>
        </thead>
        <tbody>
          <tr className="c9-plan-compare-group border-b border-[var(--c9-border)]">
            <th
              colSpan={3}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--c9-muted)]"
            >
              Limits
            </th>
          </tr>
          {LIMIT_ROWS.map((row) => (
            <tr key={row.id} className="border-b border-[var(--c9-border)]">
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
          <tr className="c9-plan-compare-group border-b border-[var(--c9-border)]">
            <th
              colSpan={3}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--c9-muted)]"
            >
              Capabilities
            </th>
          </tr>
          {CAPABILITY_ROWS.map((row) => (
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
