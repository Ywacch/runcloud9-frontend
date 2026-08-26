/** Flags from GET /templates that control picker actions and live deploy. */
export type TemplateAvailabilityFlags = {
  available: boolean
  deployable: boolean
  simulatable: boolean
}

export type TemplateOfferBadge = 'ready' | 'simulation-only' | 'coming-soon'

export const TEMPLATE_LIVE_NOT_OFFERED_HINT =
  'Live deploy is not offered yet. You can still simulate this design.'

export const TEMPLATE_COMING_SOON_HINT =
  'This template is not available to load yet.'

/** Live cluster deploy requires both catalog availability and deployable. */
export function templateOffersLiveDeploy(
  t: TemplateAvailabilityFlags,
): boolean {
  return t.available && t.deployable
}

/** Canvas load is allowed for live deploy or simulation. */
export function templateCanLoadInPicker(
  t: TemplateAvailabilityFlags,
): boolean {
  return templateOffersLiveDeploy(t) || t.simulatable
}

export function templateOfferBadge(
  t: TemplateAvailabilityFlags,
): TemplateOfferBadge {
  if (!t.available) return 'coming-soon'
  if (t.deployable) return 'ready'
  if (t.simulatable) return 'simulation-only'
  return 'coming-soon'
}
