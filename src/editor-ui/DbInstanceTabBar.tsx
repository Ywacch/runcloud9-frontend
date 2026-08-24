import type { DbInstanceTab, SelectedInstanceId } from '../lib/dbInstanceScope'

export function DbInstanceTabBar({
  tabs,
  selectedId,
  onSelect,
}: {
  tabs: DbInstanceTab[]
  selectedId: SelectedInstanceId
  onSelect: (id: SelectedInstanceId) => void
}) {
  if (tabs.length === 0) return null
  const active = selectedId ?? 'cluster'
  return (
    <div className="flex flex-wrap gap-1 border-b border-[var(--c9-border)] pb-2">
      {tabs.map((tab) => {
        const id = tab.id ?? 'cluster'
        const isActive = active === id
        return (
          <button
            key={String(id)}
            type="button"
            onClick={() => onSelect(id)}
            className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
              isActive
                ? 'border-[var(--c9-border)] bg-[var(--c9-surface)] text-[var(--c9-text)]'
                : 'border-transparent text-[var(--c9-muted)] hover:text-[var(--c9-text)]'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
