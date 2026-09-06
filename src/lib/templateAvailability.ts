import { SHOW_SIMULATION_UI } from './featureFlags'

/** Flags from GET /templates that control picker actions and live deploy. */
export type TemplateAvailabilityFlags = {
  available: boolean
  deployable: boolean
  simulatable: boolean
}

export type TemplateOfferBadge = 'ready' | 'simulation-only' | 'coming-soon'

export const TEMPLATE_LIVE_NOT_OFFERED_HINT =
  'Live deploy is not offered yet.'

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
  if (SHOW_SIMULATION_UI) {
    return templateOffersLiveDeploy(t) || t.simulatable
  }
  return templateOffersLiveDeploy(t)
}

/** Keep premium-gated deployable templates visible with lock UX when sim UI is hidden. */
export function remoteTemplateVisibleInPicker(
  t: TemplateAvailabilityFlags & { premium?: boolean },
  canUsePremiumTemplates: boolean,
): boolean {
  if (templateCanLoadInPicker(t)) return true
  return Boolean(
    t.premium && !canUsePremiumTemplates && t.available && t.deployable,
  )
}

export function templateOfferBadge(
  t: TemplateAvailabilityFlags,
): TemplateOfferBadge {
  if (!t.available) return 'coming-soon'
  if (t.deployable) return 'ready'
  if (t.simulatable) return 'simulation-only'
  return 'coming-soon'
}
