import { LegalPageLayout } from '../components/legal/LegalPageLayout'
import { LegalDocument, privacyDocument } from '../components/legal/LegalDocument'

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy">
      <LegalDocument doc={privacyDocument} />
    </LegalPageLayout>
  )
}
