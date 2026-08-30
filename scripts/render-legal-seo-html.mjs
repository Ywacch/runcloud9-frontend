/** Mirrors src/lib/renderLegalSeoHtml.ts for the Node prerender script. */
export function renderLegalDocumentHtml(doc) {
  const parts = [
    `<h1>${escapeHtml(doc.title)}</h1>`,
    `<p>Last updated ${escapeHtml(doc.lastUpdated)}</p>`,
    `<p>${escapeHtml(doc.intro)}</p>`,
  ]

  for (const section of doc.sections) {
    parts.push(`<h2>${escapeHtml(section.heading)}</h2>`)
    for (const block of section.paragraphs ?? []) {
      if (typeof block === 'string') {
        parts.push(`<p>${escapeHtml(block)}</p>`)
      } else {
        parts.push(
          `<p><strong>${escapeHtml(block.lead)}</strong>${escapeHtml(block.text)}</p>`,
        )
      }
    }
    if (section.listItems) {
      parts.push('<ul>')
      for (const item of section.listItems) {
        parts.push(
          `<li><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.text)}</li>`,
        )
      }
      parts.push('</ul>')
    }
  }

  return parts.join('\n  ')
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
