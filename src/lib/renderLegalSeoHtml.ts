type ParagraphBlock =
  | string
  | {
      lead: string
      text: string
    }

type LegalListItem = {
  label: string
  text: string
}

type LegalSection = {
  heading: string
  paragraphs?: ParagraphBlock[]
  listItems?: LegalListItem[]
}

export type LegalDocumentData = {
  title: string
  lastUpdated: string
  intro: string
  sections: LegalSection[]
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Static HTML for marketing prerender and crawler tests. */
export function renderLegalDocumentHtml(doc: LegalDocumentData): string {
  const parts = [
    `<h1>${escapeHtml(doc.title)}</h1>`,
    `<p>Last updated ${escapeHtml(doc.lastUpdated)}</p>`,
    `<p>${escapeHtml(doc.intro)}</p>`,
  ]

  for (const section of doc.sections) {
    parts.push(`<h2>${escapeHtml(section.heading)}</h2>`)
    if (section.listItems) {
      parts.push('<ul>')
      for (const item of section.listItems) {
        parts.push(
          `<li><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.text)}</li>`,
        )
      }
      parts.push('</ul>')
    }
    for (const block of section.paragraphs ?? []) {
      if (typeof block === 'string') {
        parts.push(`<p>${escapeHtml(block)}</p>`)
      } else {
        parts.push(
          `<p><strong>${escapeHtml(block.lead)}</strong>${escapeHtml(block.text)}</p>`,
        )
      }
    }
  }

  return parts.join('\n  ')
}
