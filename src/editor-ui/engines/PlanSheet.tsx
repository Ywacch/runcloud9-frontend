import type { PlanSheetSection } from '../../lib/engines/planSheetModel'
import { buildPlanSheetModel, type DesignPlan } from '../../lib/engines/planSheetModel'

type PlanSheetProps = {
  open: boolean
  plan: DesignPlan | null
  loading?: boolean
  error?: string | null
  onClose: () => void
  onApplyRemovals: () => void
  onConfirmDeploy: () => void
}

function SectionBlock({ section }: { section: PlanSheetSection }) {
  return (
    <div
      className={`sl-plan-section${
        section.tone === 'warn' ? ' sl-plan-section--warn' : ''
      }`}
    >
      <h3 className="sl-plan-section-title">{section.title}</h3>
      <ul className="sl-plan-lines">
        {section.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  )
}

export function PlanSheet({
  open,
  plan,
  loading,
  error,
  onClose,
  onApplyRemovals,
  onConfirmDeploy,
}: PlanSheetProps) {
  if (!open) return null

  const sections = plan ? buildPlanSheetModel(plan) : []
  const canApplyRemovals = (plan?.nodes.removed.length ?? 0) > 0

  return (
    <div className="sl-plan-backdrop" role="presentation">
      <div
        className="sl-plan-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deploy-plan-title"
      >
        <header className="sl-plan-header">
          <h2 id="deploy-plan-title" className="sl-lab">
            Deploy plan
          </h2>
          <button type="button" className="sl-plan-close" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="sl-plan-body">
          {loading ? (
            <p className="text-sm text-[var(--sl-ink-3)]">Computing plan…</p>
          ) : null}
          {error ? (
            <p className="text-sm text-[var(--sl-red)]">{error}</p>
          ) : null}
          {!loading && !error && plan
            ? sections.map((section) => (
                <SectionBlock key={section.id} section={section} />
              ))
            : null}
        </div>
        <footer className="sl-plan-footer">
          {canApplyRemovals ? (
            <button type="button" className="sl-btn" onClick={onApplyRemovals}>
              Apply removals on canvas
            </button>
          ) : null}
          <button
            type="button"
            className="sl-btn w-full border-[var(--c9-accent)] bg-[var(--c9-accent)] text-white"
            disabled={loading || Boolean(error)}
            onClick={onConfirmDeploy}
          >
            Deploy
          </button>
        </footer>
      </div>
    </div>
  )
}
