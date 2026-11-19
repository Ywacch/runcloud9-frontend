import type { TemplateInfo, TemplateVariation } from './api'

/** Frontend-only family grouping (no API `family` field). */
export type TemplateFamilyId = 'url-shortener' | 'ecommerce' | 'social-feed'

export type TemplateFamilySlot = {
  templateId: string
  variationId: string
}

export type TemplateFamilyConfig = {
  id: TemplateFamilyId
  title: string
  /** Template modal only. One factual sentence. */
  summary: string
  /** Key into TemplateModal local meta (icon/accent). */
  metaKey: string
  slots: TemplateFamilySlot[]
}

export const TEMPLATE_FAMILIES: TemplateFamilyConfig[] = [
  {
    id: 'url-shortener',
    title: 'URL Shortener',
    summary: 'Redirects hit Postgres. Later variations add Redis or a caching proxy.',
    metaKey: 'url-shortener',
    slots: [
      { templateId: 'url-shortener', variationId: 'app-db' },
      { templateId: 'url-shortener', variationId: 'app-db-cache' },
      { templateId: 'url-shortener', variationId: 'app-db-cache-proxy' },
    ],
  },
  {
    id: 'ecommerce',
    title: 'E-Commerce',
    summary:
      'Catalog and checkout use Postgres. Later variations add cache or a checkout queue.',
    metaKey: 'ecommerce',
    slots: [
      { templateId: 'ecommerce', variationId: 'app-db' },
      { templateId: 'ecommerce', variationId: 'app-db-cache' },
      { templateId: 'ecommerce', variationId: 'app-db-cache-mq-worker' },
    ],
  },
  {
    id: 'social-feed',
    title: 'Social Feed',
    summary:
      'Reads can JOIN in Postgres or read Redis timelines. Fan-out can run on the app or on workers.',
    metaKey: 'social-feed',
    slots: [
      { templateId: 'social-feed-pull', variationId: 'app-db' },
      { templateId: 'social-feed', variationId: 'timeline-sync' },
      { templateId: 'social-feed', variationId: 'timeline-async' },
    ],
  },
]

export function findTemplateVariation(
  template: Pick<TemplateInfo, 'variations'>,
  variationId: string,
): TemplateVariation | undefined {
  return template.variations?.find((v) => v.id === variationId)
}
