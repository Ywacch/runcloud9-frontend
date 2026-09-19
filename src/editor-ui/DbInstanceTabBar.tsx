import type { DbInstanceTab, SelectedInstanceId } from '../lib/dbInstanceScope'
import { InspectorSegment, InspectorSegmentGroup } from './inspectorPanelUi'

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
    <InspectorSegmentGroup aria-label="Instance scope" className="w-full">
      {tabs.map((tab) => {
        const id = tab.id ?? 'cluster'
        const isActive = active === id
        return (
          <InspectorSegment
            key={String(id)}
            active={isActive}
            onClick={() => onSelect(id)}
            label={tab.label}
            className="flex-1 text-center sm:flex-none"
          />
        )
      })}
    </InspectorSegmentGroup>
  )
}
