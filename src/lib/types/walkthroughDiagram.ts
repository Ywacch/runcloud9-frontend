/** Node IDs used by the WRITE PATH diagram */
export type WriteDiagramNodeId =
  | 'client'
  | 'lb'
  | 'app-server'
  | 'db'
  | 'mq'
  | 'worker'
  | 'cache-stack'
  | 'cache-bob'
  | 'cache-mike'
  | 'cache-user123'

/** Arrow IDs used by the WRITE PATH diagram */
export type WriteArrowId =
  | 'client→lb'
  | 'lb→app'
  | 'app→db'
  | 'app→mq'
  | 'app→client'
  | 'mq→worker'
  | 'worker→db'
  | 'worker→cache'
  | 'worker→cache-bob'
  | 'worker→cache-mike'
  | 'worker→cache-user123'

/** Node IDs used by the READ PATH diagram */
export type ReadDiagramNodeId =
  | 'client'
  | 'lb'
  | 'app-server'
  | 'cache-stack'
  | 'db'

/** Arrow IDs used by the READ PATH diagram */
export type ReadArrowId =
  | 'client→lb'
  | 'lb→app'
  | 'app→cache'
  | 'cache→app'
  | 'app→client'
  | 'app→db'

export interface DiagramAnnotation {
  nodeId: string
  text: string
  side: 'top' | 'bottom' | 'left' | 'right'
}

export interface DiagramStepState {
  highlightedNodes: string[]
  activeArrows: string[]
  dimmedNodes?: string[]
  annotation?: DiagramAnnotation
}

/** Parallel spec — should match `JourneySpec.steps.length` for the same journey */
export interface WalkthroughDiagramSpec {
  journeyId: string
  steps: DiagramStepState[]
}
