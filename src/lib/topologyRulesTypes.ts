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

/** Rewrite sentence em dashes in platform copy (API may still send them). */
export function scrubEmDashCopy(text: string): string {
  return text
    .replace(/\s*—\s*([A-Za-z])/g, (_m, ch: string) => `. ${ch.toUpperCase()}`)
    .replace(/\s*—\s*/g, '. ')
}

/** Scrub every user-facing message field on topology rules. */
export function scrubTopologyRulesMessages(
  rules: TopologyRulesResponse,
): TopologyRulesResponse {
  return {
    ...rules,
    connections: rules.connections.map((c) => ({
      ...c,
      explanation: scrubEmDashCopy(c.explanation),
    })),
    presence: rules.presence.map((p) => ({
      ...p,
      message: scrubEmDashCopy(p.message),
    })),
    singletons: rules.singletons.map((s) => ({
      ...s,
      message: scrubEmDashCopy(s.message),
    })),
    requiredOutbound: rules.requiredOutbound.map((r) => ({
      ...r,
      missingDbMessage: scrubEmDashCopy(r.missingDbMessage),
      missingMqMessage: scrubEmDashCopy(r.missingMqMessage),
      wrongMqDirectionMessage: scrubEmDashCopy(r.wrongMqDirectionMessage),
    })),
  }
}
