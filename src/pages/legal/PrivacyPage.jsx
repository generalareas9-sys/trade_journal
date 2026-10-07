import LegalLayout from './LegalLayout'

const sections = [
  ['collect', 'What we collect', 'We collect information you provide, such as your name and email address. You may also add an optional country, trades, notes, journal entries, and screenshots. We collect basic technical data needed to operate, protect, and troubleshoot the service.'],
  ['use', 'How we use it', 'We use your information to provide your account and journal, show your trading analytics, maintain and secure the service, and respond to support requests.'],
  ['storage', 'Where it is stored', 'Account and journal data is stored using Supabase. Row-level security is used so each user can access only their own data.'],
  ['no-sale', 'We do not sell your data', 'We do not sell your personal information or journal content. We share information only as needed to operate the service, meet legal requirements, or protect users and the service.'],
  ['cookies', 'Cookies and local storage', 'TradeJournal uses browser storage, including local storage, for your login session, theme preference, and journal data stored on this device. Supabase authentication may also use browser storage to keep you signed in. Clearing browser storage can sign you out, reset preferences, or remove locally stored journal data that has not been synced. We do not use advertising cookies.'],
  ['rights', 'Your rights', 'You can export and delete your journal data using the available account tools. You may also contact us to ask about access, correction, or deletion of your personal information.'],
  ['retention', 'Data retention', 'We keep information while your account is active and for as long as needed to provide the service. When you request account deletion, we delete or de-identify your information within a reasonable period, unless we must retain it by law.'],
  ['security', 'Security', 'We use reasonable technical and organizational measures to protect information. No online service or storage system can be guaranteed completely secure.'],
  ['children', 'Children', 'TradeJournal is not intended for people under 18. We do not knowingly collect personal information from children under 18.'],
  ['changes', 'Changes to this policy', 'We may update this policy from time to time. We will update the date at the top when changes are made.'],
  ['contact', 'Contact', 'Questions or requests about privacy? Contact us at [CONTACT EMAIL].'],
].map(([id, title, text], index) => ({ id, title: `${index + 1}. ${title}`, text }))

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" sections={sections}>
      {sections.map(({ id, title, text }) => (
        <section className="legal-section" id={id} key={id}>
          <h2>{title}</h2>
          <p>{text}</p>
        </section>
      ))}
    </LegalLayout>
  )
}
