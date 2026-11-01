import { trackEvent } from '../../lib/analytics'
import type { MetaJobsResponse } from '../../lib/api'
import {
  buildEnginePickerModel,
  type EngineGateEntry,
  type PickerEngineOption,
} from '../../lib/engines/pickerModel'

const FIT_LABEL: Record<string, string> = {
  natural: 'Natural fit',
  workable: 'Workable',
  poor: 'Poor fit',
  impossible: 'Impossible',
}

type EnginePickerProps = {
  jobId: string
  catalog: MetaJobsResponse
  gates: EngineGateEntry[]
  selectedEngine: string | null
  /** When set, only these engines appear (template job allow-list). */
  allowedEngines?: readonly string[]
  onSelectEngine: (engine: string) => void
}

function FitPill({ option }: { option: PickerEngineOption }) {
  const fitLabel = FIT_LABEL[option.fit] ?? option.fit
  if (option.state === 'impossible') {
    return (
      <span className="sl-jobs-fit sl-jobs-fit--impossible" title={option.reason}>
        <s>{fitLabel}</s>
      </span>
    )
  }
  if (option.state === 'not_built') {
    return (
      <span className="sl-jobs-fit sl-jobs-fit--muted" title={option.reason}>
        Not built yet
      </span>
    )
  }
  if (option.state === 'tier_locked') {
    return (
      <span className="sl-jobs-fit sl-jobs-fit--locked" title={option.reason}>
        Locked
      </span>
    )
  }
  return <span className="sl-jobs-fit">{fitLabel}</span>
}

export function EnginePicker({
  jobId,
  catalog,
  gates,
  selectedEngine,
  allowedEngines,
  onSelectEngine,
}: EnginePickerProps) {
  const options = buildEnginePickerModel(jobId, catalog, gates).filter(
    (option) => !allowedEngines || allowedEngines.includes(option.engine),
  )

  return (
    <ul className="sl-jobs-engines" aria-label={`Engines for ${jobId}`}>
      {options.map((option) => {
        const active = selectedEngine === option.engine
        const selectable = option.state === 'selectable'
        const notBuilt = option.state === 'not_built'
        const disabled = option.state === 'impossible' || option.state === 'tier_locked'
        return (
          <li key={option.engine}>
            <button
              type="button"
              disabled={disabled}
              className={`sl-jobs-engine${active ? ' sl-jobs-engine--active' : ''}${
                disabled || notBuilt ? ' sl-jobs-engine--disabled' : ''
              }`}
              onClick={() => {
                if (option.state === 'not_built') {
                  trackEvent('engine_pair_requested', {
                    job: jobId,
                    engine: option.engine,
                  })
                  return
                }
                if (!selectable) return
                onSelectEngine(option.engine)
              }}
            >
              <span className="sl-jobs-engine-name">{option.label}</span>
              <FitPill option={option} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
