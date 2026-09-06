import { LegalPageLayout } from '../components/legal/LegalPageLayout'
import { LegalDocument, cookiesDocument } from '../components/legal/LegalDocument'

export default function CookiesPage() {
  return (
    <LegalPageLayout title="Cookie Policy">
      <LegalDocument doc={cookiesDocument} />
    </LegalPageLayout>
  )
}
