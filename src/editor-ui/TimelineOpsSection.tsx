import {
  SlSecHead,
  SlSpacer,
  SlStatCell,
  SlStatStrip,
} from './stacklabPanePrimitives'
import type { TimelineOpsViewModel } from '../lib/timelineOpsDisplay'

export function TimelineOpsSection({ model }: { model: TimelineOpsViewModel }) {
  return (
    <>
      <SlSpacer />
      <SlSecHead
        index="TL"
        title="Timeline job operations"
        subtitle={`Shared append/range metrics · engine ${model.engine}`}
      />
      <SlStatStrip>
        <SlStatCell label="append rate" value={model.appendRate} unit="10s window" />
        <SlStatCell label="append p99" value={model.appendP99Ms} />
        <SlStatCell label="range p99" value={model.rangeP99Ms} />
        <SlStatCell label="op errors" value={model.errorRate} unit="/s" />
      </SlStatStrip>
      <SlSecHead
        index="TC"
        title="Timeline storage cost"
        subtitle={
          model.engine === 'postgresql' || model.engine === 'postgres'
            ? 'Postgres timelines table footprint and vacuum pressure.'
            : 'Redis sorted-set timelines and eviction pressure.'
        }
      />
      <SlStatStrip>
        <SlStatCell
          label={model.costPrimaryLabel}
          value={model.costPrimaryValue}
          unit={model.costPrimaryLabel === 'table size' ? 'KiB' : undefined}
        />
        <SlStatCell
          label={model.costSecondaryLabel}
          value={model.costSecondaryValue}
          unit={
            model.costSecondaryLabel === 'evictions' && model.costSecondaryValue.includes('/s')
              ? undefined
              : model.costSecondaryLabel === 'evictions'
                ? 'total'
                : undefined
          }
        />
      </SlStatStrip>
    </>
  )
}
