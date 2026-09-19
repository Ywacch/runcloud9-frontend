import type { TemplateInfo } from './api'
import catalog from './templateCatalogFallback.json'
import { TEMPLATE_FAMILIES } from './templateFamilyCatalog'

/**
 * Offline template registry — JSON snapshot of ganymede/pkg/templates embedded YAML.
 * Re-export templates.Registry() into templateCatalogFallback.json when definitions change.
 */
export const FALLBACK_TEMPLATE_CATALOG = catalog as TemplateInfo[]

export function fallbackTemplateById(id: string): TemplateInfo | undefined {
  return FALLBACK_TEMPLATE_CATALOG.find((row) => row.id === id)
}

/** True when every family-picker variation exists in the bundled catalog. */
export function fallbackCatalogCoversFamilyPicker(): boolean {
  const byId = new Map(FALLBACK_TEMPLATE_CATALOG.map((row) => [row.id, row]))
  return TEMPLATE_FAMILIES.every((family) =>
    family.slots.every((slot) => {
      const template = byId.get(slot.templateId)
      return template?.variations?.some((v) => v.id === slot.variationId) ?? false
    }),
  )
}
