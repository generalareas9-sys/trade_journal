import LegalLayout from './LegalLayout'

const sections = [
  ['acceptance', 'Acceptance of terms', 'By accessing or using TradeJournal, you agree to these Terms of Service. If you do not agree, do not use the service.'],
  ['service', 'What TradeJournal is', 'TradeJournal is a journaling and analytics tool only. It helps you record and review your trading activity. It does not place trades or provide personalized financial guidance.'],
  ['account', 'Your account', 'Provide accurate account information, keep your password safe, and let us know if you suspect someone else has accessed your account. Each account is for one person; do not share an account with other people.'],
  ['content', 'Your content', 'You own the trades, notes, journal entries, and screenshots you add. You give us permission only to store and display that content to you as needed to provide TradeJournal.'],
  ['acceptable-use', 'Acceptable use', 'Do not misuse the service, attempt to access another person’s account or data, interfere with the service, or use TradeJournal in a way that breaks the law.'],
  ['no-advice', 'Not financial advice', 'TradeJournal is not financial, investment, or tax advice. Nothing in the service is a recommendation to buy or sell an asset. Past performance does not guarantee future results. Trading involves risk of loss, including the loss of your capital. You are responsible for your own decisions.'],
  ['availability', 'Availability and changes', 'We work to keep TradeJournal available, but cannot promise uninterrupted or error-free service. We may change or discontinue features, and will make reasonable efforts to communicate significant changes.'],
  ['termination', 'Termination and deleting your account', 'You may stop using TradeJournal at any time. To request account deletion, contact us using the address below. We may suspend access if these terms are seriously or repeatedly violated.'],
  ['liability', 'Limitation of liability', 'To the extent permitted by law, TradeJournal and its operators are not liable for indirect or consequential losses, trading losses, or loss of data resulting from your use of the service. The service is provided “as is” and “as available.” Nothing here limits liability that cannot legally be limited.'],
  ['governing-law', 'Governing law', 'These terms are governed by the laws of [COUNTRY], without regard to conflict-of-law rules.'],
  ['changes', 'Changes to these terms', 'We may update these terms from time to time. We will update the date at the top when we do. Continued use of TradeJournal after an update means you accept the revised terms.'],
  ['contact', 'Contact', 'Questions about these terms? Contact us at [CONTACT EMAIL].'],
].map(([id, title, text], index) => ({ id, title: `${index + 1}. ${title}`, text }))

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" sections={sections}>
      {sections.map(({ id, title, text }) => (
        <section className="legal-section" id={id} key={id}>
          <h2>{title}</h2>
          <p>{text}</p>
        </section>
      ))}
    </LegalLayout>
  )
}
