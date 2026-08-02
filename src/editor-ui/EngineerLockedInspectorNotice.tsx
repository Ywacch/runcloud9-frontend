import { Link } from 'react-router-dom'
import { engineerUpgradeActionLabel } from '../lib/billingCopy'
import { BILLING_ENABLED } from '../lib/featureFlags'
import { startEngineerCheckout } from '../lib/stripeCheckout'
import { switchTemplatePresetMode } from '../lib/switchTemplatePresetMode'
import { templateHasExplorerRunnable } from '../lib/templatePresetMode'
import { useAuthStore } from '../product/stores/authStore'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useTemplateRegistryStore } from '../editor-core/stores/templateRegistryStore'
import type { TemplateInfo } from '../lib/api'

/** Read-only notice when Explorer inspects an Engineer-only node in full preview. */
export function EngineerLockedInspectorNotice() {
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)
  const userRecord = useAuthStore((s) => s.userRecord)
  const template = useTemplateRegistryStore((s) =>
    snapshotTemplateId
      ? (s.byId[snapshotTemplateId] as TemplateInfo | undefined)
      : undefined,
  )
  const upgradeLabel = engineerUpgradeActionLabel(BILLING_ENABLED)
  const canSwitch = templateHasExplorerRunnable(template)

  return (
    <div className="rounded-md border border-[var(--c9-border)] bg-[var(--c9-surface)] px-3 py-2.5 text-xs leading-snug text-[var(--c9-muted)]">
      <p className="font-medium text-[var(--c9-text)]">Engineer component</p>
      <p className="mt-1">
        Preview only on Explorer. Upgrade to deploy this node, or switch to the
        Explorer runnable preset.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {upgradeLabel && BILLING_ENABLED ? (
          <button
            type="button"
            onClick={() => {
              void startEngineerCheckout().catch(() => {})
            }}
            className="rounded px-2 py-1 font-medium text-[var(--c9-accent)] hover:text-[var(--c9-accent-hover)]"
          >
            {upgradeLabel}
          </button>
        ) : (
          <Link
            to="/pricing"
            className="rounded px-2 py-1 font-medium text-[var(--c9-accent)] hover:text-[var(--c9-accent-hover)]"
          >
            Pricing
          </Link>
        )}
        {canSwitch ? (
          <button
            type="button"
            onClick={() =>
              switchTemplatePresetMode('explorer', { user: userRecord })
            }
            className="rounded border border-[var(--c9-border)] px-2 py-1 font-medium text-[var(--c9-text)] hover:bg-[var(--c9-badge-bg)]"
          >
            Explorer runnable
          </button>
        ) : null}
      </div>
    </div>
  )
}
