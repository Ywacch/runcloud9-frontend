import { Link } from 'react-router-dom'
import { useAuthStore } from '../product/stores/authStore'
import { useCanvasStore } from '../editor-core/stores/canvasStore'
import { useTemplateRegistryStore } from '../editor-core/stores/templateRegistryStore'
import {
  templateHasExplorerRunnable,
  type TemplatePresetMode,
} from '../lib/templatePresetMode'
import { switchTemplatePresetMode } from '../lib/switchTemplatePresetMode'
import { FREE_TIER_DESIGN_LABEL } from '../lib/billingCopy'
import type { TemplateInfo } from '../lib/api'

/** Explorer-only control to switch full architecture preview vs runnable preset. */
export function TemplatePresetModeBanner() {
  const mode = useCanvasStore((s) => s.mode)
  const snapshotTemplateId = useCanvasStore((s) => s.snapshotTemplateId)
  const templatePresetMode = useCanvasStore((s) => s.templatePresetMode)
  const isPremium = useAuthStore((s) => s.isPremium)
  const userRecord = useAuthStore((s) => s.userRecord)
  const template = useTemplateRegistryStore((s) =>
    snapshotTemplateId ? (s.byId[snapshotTemplateId] as TemplateInfo | undefined) : undefined,
  )

  if (mode === 'live') return null
  if (isPremium) return null
  if (!snapshotTemplateId || !template) return null
  if (!templateHasExplorerRunnable(template)) return null
  if (templatePresetMode == null) return null

  const setMode = (next: TemplatePresetMode) => {
    if (next === templatePresetMode) return
    switchTemplatePresetMode(next, { user: userRecord })
  }

  return (
    <div className="pointer-events-auto flex max-w-md flex-col gap-1.5 rounded-lg border border-[var(--c9-border)] bg-[var(--c9-surface)]/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
      <p className="font-medium text-[var(--c9-text)]">
        {templatePresetMode === 'full'
          ? 'Full architecture (preview)'
          : FREE_TIER_DESIGN_LABEL}
      </p>
      <p className="leading-snug text-[var(--c9-muted)]">
        {templatePresetMode === 'full'
          ? 'Engineer components are dimmed and not deployable. Switch to deploy on Free tier.'
          : 'Deployable Free tier design. Switch back to preview the full template shape.'}
      </p>
      <div className="mt-1 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode('full')}
          className={`rounded px-2 py-1 font-medium transition-colors ${
            templatePresetMode === 'full'
              ? 'bg-[var(--c9-accent)] text-white'
              : 'border border-[var(--c9-border)] text-[var(--c9-muted)] hover:text-[var(--c9-text)]'
          }`}
        >
          Full preview
        </button>
        <button
          type="button"
          onClick={() => setMode('explorer')}
          className={`rounded px-2 py-1 font-medium transition-colors ${
            templatePresetMode === 'explorer'
              ? 'bg-[var(--c9-accent)] text-white'
              : 'border border-[var(--c9-border)] text-[var(--c9-muted)] hover:text-[var(--c9-text)]'
          }`}
        >
          {FREE_TIER_DESIGN_LABEL}
        </button>
        <Link
          to="/pricing"
          className="rounded px-2 py-1 font-medium text-[var(--c9-accent)] hover:text-[var(--c9-accent-hover)]"
        >
          Pricing
        </Link>
      </div>
    </div>
  )
}
