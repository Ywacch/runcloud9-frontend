import { LegalPageLayout } from '../components/legal/LegalPageLayout'
import { LegalDocument, termsDocument } from '../components/legal/LegalDocument'

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service">
      <LegalDocument doc={termsDocument} />
    </LegalPageLayout>
  )
}
