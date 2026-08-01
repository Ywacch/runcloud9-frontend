import { describe, expect, it } from 'vitest'
import { FALLBACK_TOPOLOGY_RULES } from './topologyRulesFallback'
import {
  applyTopologyRules,
  getConnectionRulesMap,
  getTopologyRulesCached,
} from './topologyRulesStore'
import { classifySemanticPair } from './connectionSemantics'
import type { TopologyRulesResponse } from './topologyRulesTypes'

describe('topologyRulesStore', () => {
  it('starts from fallback with full 36-pair grid', () => {
    applyTopologyRules(FALLBACK_TOPOLOGY_RULES)
    expect(getTopologyRulesCached().connections).toHaveLength(36)
    expect(getConnectionRulesMap().size).toBe(36)
  })

  it('applyTopologyRules drives classifySemanticPair', () => {
    const custom: TopologyRulesResponse = {
      ...FALLBACK_TOPOLOGY_RULES,
      connections: [
        {
          source: 'lb',
          target: 'db',
          valid: false,
          supported: false,
          explanation: 'custom lb-db block',
        },
        {
          source: 'lb',
          target: 'app-server',
          valid: true,
          supported: true,
          explanation: '',
        },
      ],
    }
    applyTopologyRules(custom)
    expect(classifySemanticPair('lb', 'db', true).message).toBe(
      'custom lb-db block',
    )
    // restore fallback for other suites
    applyTopologyRules(FALLBACK_TOPOLOGY_RULES)
  })

  it('scrubs em dashes from API singleton messages on apply', () => {
    const fromApi: TopologyRulesResponse = {
      ...FALLBACK_TOPOLOGY_RULES,
      singletons: [
        {
          nodeType: 'cache',
          message:
            'only one cache node is supported (found {count}) — remove extra cache nodes; the platform provisions a single Redis service',
          scaleWithReplicas: false,
        },
      ],
    }
    applyTopologyRules(fromApi)
    expect(getTopologyRulesCached().singletons[0]?.message).toBe(
      'only one cache node is supported (found {count}). Remove extra cache nodes; the platform provisions a single Redis service',
    )
    applyTopologyRules(FALLBACK_TOPOLOGY_RULES)
  })
})
