import { create } from 'zustand'
import { FALLBACK_TOPOLOGY_RULES } from './topologyRulesFallback'
import {
  scrubTopologyRulesMessages,
  type ConnectionRule,
  type TopologyRulesResponse,
} from './topologyRulesTypes'

function ruleKey(source: string, target: string): string {
  return `${source}\0${target}`
}

function buildConnectionMap(
  rules: TopologyRulesResponse,
): Map<string, ConnectionRule> {
  const m = new Map<string, ConnectionRule>()
  for (const c of rules.connections) {
    m.set(ruleKey(c.source, c.target), {
      valid: c.valid,
      supported: c.supported,
      explanation: c.explanation,
    })
  }
  return m
}

interface TopologyRulesState {
  rules: TopologyRulesResponse
  connectionMap: Map<string, ConnectionRule>
  loadAttempted: boolean
}

const fallbackMap = buildConnectionMap(FALLBACK_TOPOLOGY_RULES)

export const useTopologyRulesStore = create<TopologyRulesState>(() => ({
  rules: FALLBACK_TOPOLOGY_RULES,
  connectionMap: fallbackMap,
  loadAttempted: false,
}))

export function getTopologyRulesCached(): TopologyRulesResponse {
  return useTopologyRulesStore.getState().rules
}

export function getConnectionRulesMap(): Map<string, ConnectionRule> {
  return useTopologyRulesStore.getState().connectionMap
}

/** Replace platform rules (from API or tests). */
export function applyTopologyRules(rules: TopologyRulesResponse): void {
  const scrubbed = scrubTopologyRulesMessages(rules)
  useTopologyRulesStore.setState({
    rules: scrubbed,
    connectionMap: buildConnectionMap(scrubbed),
  })
}

export async function ensureTopologyRulesLoaded(): Promise<void> {
  const { loadAttempted } = useTopologyRulesStore.getState()
  if (loadAttempted) return
  useTopologyRulesStore.setState({ loadAttempted: true })
  try {
    const { getTopologyRules } = await import('./api')
    const rules = await getTopologyRules()
    applyTopologyRules(rules)
  } catch {
    /* session keeps FALLBACK_TOPOLOGY_RULES */
  }
}
