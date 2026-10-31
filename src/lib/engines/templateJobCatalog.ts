import type { CanvasNode } from '../../editor-core/stores/canvasStore'

/** Mirrors ganymede template job requirements for the jobs panel. */
export interface TemplateJobDef {
  id: string
  required: boolean
  defaultNodeType: CanvasNode['type']
  allowedEngines: readonly string[]
}

const db = 'database' as const
const cache = 'cache' as const
const mq = 'message_queue' as const

export const TEMPLATE_JOBS: Record<string, readonly TemplateJobDef[]> = {
  'social-feed': [
    { id: 'main_db', required: true, defaultNodeType: db, allowedEngines: ['postgresql'] },
    {
      id: 'timeline',
      required: true,
      defaultNodeType: cache,
      allowedEngines: ['redis', 'postgresql'],
    },
    { id: 'work_queue', required: false, defaultNodeType: mq, allowedEngines: ['rabbitmq'] },
  ],
  'social-feed-pull': [
    { id: 'main_db', required: true, defaultNodeType: db, allowedEngines: ['postgresql'] },
    { id: 'hot_cache', required: false, defaultNodeType: cache, allowedEngines: ['redis'] },
  ],
  'url-shortener': [
    { id: 'main_db', required: true, defaultNodeType: db, allowedEngines: ['postgresql'] },
    { id: 'hot_cache', required: false, defaultNodeType: cache, allowedEngines: ['redis'] },
  ],
  ecommerce: [
    { id: 'main_db', required: true, defaultNodeType: db, allowedEngines: ['postgresql'] },
    { id: 'hot_cache', required: false, defaultNodeType: cache, allowedEngines: ['redis'] },
    { id: 'work_queue', required: false, defaultNodeType: mq, allowedEngines: ['rabbitmq'] },
  ],
}

export function templateJobDefs(templateId: string | null | undefined): TemplateJobDef[] {
  if (!templateId) return []
  return [...(TEMPLATE_JOBS[templateId] ?? [])]
}

export function templateHasJobsPanel(templateId: string | null | undefined): boolean {
  return templateJobDefs(templateId).length > 0
}
