import type { EdgeSemanticResult } from '../../lib/connectionSemantics'

const TITLE_COLOR: Record<EdgeSemanticResult['class'], string> = {
  active: 'text-emerald-300',
  decorative: 'text-amber-200/90',
  unsupported: 'text-amber-400',
  invalid: 'text-red-300',
  neutral: 'text-[var(--c9-muted)]',
}

export function EdgeMeaningStrip({
  result,
}: {
  result: EdgeSemanticResult
}) {
  return (
    <div
      className="pointer-events-none absolute bottom-24 left-1/2 z-20 max-w-lg -translate-x-1/2 rounded-lg border border-[var(--c9-border)] bg-[var(--c9-surface)]/95 px-4 py-2.5 text-center shadow-lg backdrop-blur-sm"
      data-edge-meaning
    >
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${TITLE_COLOR[result.class]}`}>
        {result.title}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--c9-text)]">{result.message}</p>
    </div>
  )
}
