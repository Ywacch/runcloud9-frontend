/** Types for GET /meta/topology-rules (structure only — no storytelling meanings). */

export type SemanticComponentType =
  | 'lb'
  | 'app-server'
  | 'db'
  | 'cache'
  | 'mq'
  | 'worker'

export interface ExportedConnectionRule {
  source: string
  target: string
  valid: boolean
  supported: boolean
  explanation: string
}

export interface ConnectionRule {
  valid: boolean
  supported: boolean
  explanation: string
}

export interface PresenceRule {
  id: string
  message: string
}

export interface SingletonRule {
  nodeType: string
  /** Template with `{count}` placeholder. */
  message: string
  /** When true, FE may offer merge-into-replicas collapse. */
  scaleWithReplicas: boolean
}

export interface RequiredOutboundRule {
  nodeType: string
  targets: string[]
  missingDbMessage: string
  missingMqMessage: string
  wrongMqDirectionMessage: string
}

export interface TopologyRulesResponse {
  componentTypes: string[]
  connections: ExportedConnectionRule[]
  presence: PresenceRule[]
  singletons: SingletonRule[]
  requiredOutbound: RequiredOutboundRule[]
}

export function formatTopologyMessage(
  tmpl: string,
  repl: Record<string, string>,
): string {
  let out = tmpl
  for (const [k, v] of Object.entries(repl)) {
    out = out.split(`{${k}}`).join(v)
  }
  return out
}
