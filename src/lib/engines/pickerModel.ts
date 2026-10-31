import type { MetaJobsPair, MetaJobsResponse } from '../api'

export type EngineGate = 'none' | 'tier'

export interface EngineGateEntry {
  job: string
  engine: string
  gate: EngineGate
}

export type PickerEngineState =
  | 'selectable'
  | 'not_built'
  | 'impossible'
  | 'tier_locked'

export interface PickerEngineOption {
  engine: string
  label: string
  fit: MetaJobsPair['fit']
  build: MetaJobsPair['build']
  reason: string
  state: PickerEngineState
  gate: EngineGate
}

/** Pure view-model for one job's engine picker row. */
export function buildEnginePickerModel(
  jobId: string,
  catalog: MetaJobsResponse,
  gates: EngineGateEntry[],
): PickerEngineOption[] {
  const gateByKey = new Map<string, EngineGate>()
  for (const g of gates) {
    gateByKey.set(`${g.job}\0${g.engine}`, g.gate)
  }
  const labels = new Map(catalog.engines.map((e) => [e.id, e.label]))

  const options: PickerEngineOption[] = []
  for (const pair of catalog.pairs) {
    if (pair.job !== jobId) continue
    const gate = gateByKey.get(`${pair.job}\0${pair.engine}`) ?? 'none'
    let state: PickerEngineState = 'selectable'
    if (pair.fit === 'impossible') {
      state = 'impossible'
    } else if (pair.build === 'not_built') {
      state = 'not_built'
    } else if (gate === 'tier') {
      state = 'tier_locked'
    }
    options.push({
      engine: pair.engine,
      label: labels.get(pair.engine) ?? pair.engine,
      fit: pair.fit,
      build: pair.build,
      reason: pair.reason,
      state,
      gate,
    })
  }
  options.sort((a, b) => a.engine.localeCompare(b.engine))
  return options
}
