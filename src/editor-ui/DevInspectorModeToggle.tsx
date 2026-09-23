import {
  setDevInspectorMode,
  useDevInspectorMode,
  type DevInspectorMode,
} from '../lib/devInspectorMode'

export function DevInspectorModeToggle({
  compact = false,
}: {
  compact?: boolean
  className?: string
}) {
  const mode = useDevInspectorMode()
  if (!import.meta.env.DEV) return null

  const pick = (next: DevInspectorMode) => () => setDevInspectorMode(next)

  return (
    <div className="seg" role="group" aria-label="Inspector preview mode" data-dev-inspector-mode>
      {(
        [
          ['config', 'Config'],
          ['live', 'Live'],
        ] as [DevInspectorMode, string][]
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={mode === id ? 'is-on' : ''}
          aria-pressed={mode === id}
          title={
            id === 'config'
              ? 'Editable design inspector'
              : 'Live inspector chrome with fixture metrics'
          }
          onClick={pick(id)}
        >
          {compact ? label : label}
        </button>
      ))}
    </div>
  )
}
