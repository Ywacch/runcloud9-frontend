import type { TemplateInfo } from './api'
import { hasPaidTier, type UserRecord } from './userTier'

export interface TemplateDisplayCopy {
  description: string
  components: number
  bottleneck: string
}

/** Modal/listing copy — lite fields for free tier when API provides them. */
export function templateDisplayCopy(
  template: Pick<
    TemplateInfo,
    | 'description'
    | 'descriptionLite'
    | 'components'
    | 'componentsLite'
    | 'bottleneck'
    | 'bottleneckLite'
  >,
  user: UserRecord | null,
): TemplateDisplayCopy {
  const useLite = !hasPaidTier(user) && Boolean(template.descriptionLite)
  return {
    description: useLite
      ? template.descriptionLite!
      : template.description,
    components:
      useLite && template.componentsLite != null
        ? template.componentsLite
        : template.components,
    bottleneck:
      useLite && template.bottleneckLite
        ? template.bottleneckLite
        : template.bottleneck,
  }
}
