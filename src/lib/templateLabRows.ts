import type { TemplateInfo, TemplateVariation } from './api'
import type { CanvasSnapshot } from '../editor-core/stores/canvasStore'
import { templatePresetToCanvasSnapshot } from './templatePresetAdapter'
import {
  findTemplateVariation,
  TEMPLATE_FAMILIES,
  type TemplateFamilyConfig,
} from './templateFamilyCatalog'
import { templateCanLoadInPicker } from './templateAvailability'

export type TemplateLabVariationRow = {
  templateId: string
  variationId: string
  variationLabel: string
  variationDescription: string
  snapshot: CanvasSnapshot
  available: boolean
  simulatable: boolean
  deployable: boolean
  premium: boolean
  comingSoon: boolean
}

export type TemplateLabFamily = {
  family: TemplateFamilyConfig
  variations: TemplateLabVariationRow[]
  /** Rows shown in the sidebar (includes locked / coming soon). */
  allVariations: TemplateLabVariationRow[]
}

function buildVariationRow(
  template: TemplateInfo,
  variation: TemplateVariation,
  templateId: string,
): TemplateLabVariationRow {
  return {
    templateId,
    variationId: variation.id,
    variationLabel: variation.label,
    variationDescription: variation.description,
    snapshot: templatePresetToCanvasSnapshot(variation, templateId),
    available: template.available,
    simulatable: template.simulatable,
    deployable: template.deployable,
    premium: template.premium,
    comingSoon: !template.available && !template.simulatable,
  }
}

export function buildTemplateLabFamilies(templates: TemplateInfo[]): TemplateLabFamily[] {
  const byId = new Map(templates.map((t) => [t.id, t]))
  return TEMPLATE_FAMILIES.map((family) => {
    const allVariations: TemplateLabVariationRow[] = []
    for (const slot of family.slots) {
      const template = byId.get(slot.templateId)
      if (!template) continue
      const variation = findTemplateVariation(template, slot.variationId)
      if (!variation) continue
      allVariations.push(buildVariationRow(template, variation, slot.templateId))
    }
    const variations = allVariations.filter((row) => templateCanLoadInPicker(row))
    return { family, variations, allVariations }
  }).filter((item) => item.allVariations.length > 0)
}