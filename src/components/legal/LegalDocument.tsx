import legalContent from '../../content/publicLegalContent.json'

type ParagraphBlock =
  | string
  | {
      lead: string
      text: string
    }

type LegalSection = {
  heading: string
  paragraphs?: ParagraphBlock[]
  listItems?: { label: string; text: string }[]
}

type LegalDocumentData = {
  title: string
  lastUpdated: string
  intro: string
  sections: LegalSection[]
}

function renderParagraph(block: ParagraphBlock, key: number) {
  if (typeof block === 'string') {
    return (
      <p key={key}>
        {block}
      </p>
    )
  }
  return (
    <p key={key}>
      <strong className="font-medium text-[var(--c9-text)]">{block.lead}</strong>
      {block.text}
    </p>
  )
}

export function LegalDocument({ doc }: { doc: LegalDocumentData }) {
  return (
    <>
      <p className="text-xs uppercase tracking-wider text-[var(--c9-muted)]">
        Last updated {doc.lastUpdated}
      </p>
      <p>{doc.intro}</p>
      {doc.sections.map((section) => (
        <section key={section.heading}>
          <h2 className="pt-2 text-base font-semibold text-[var(--c9-text)]">
            {section.heading}
          </h2>
          {section.paragraphs?.map((block, index) => renderParagraph(block, index))}
          {section.listItems ? (
            <ul className="list-disc space-y-2 pl-5">
              {section.listItems.map((item) => (
                <li key={item.label}>
                  <strong className="text-[var(--c9-text)]">{item.label}:</strong>{' '}
                  {item.text}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </>
  )
}

export const termsDocument = legalContent.terms as LegalDocumentData
export const privacyDocument = legalContent.privacy as LegalDocumentData
