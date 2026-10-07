import LegalLayout from './LegalLayout'

const sections = [
  { id: 'informational-only', title: 'Informational tool only', text: 'TradeJournal is a journaling and analytics tool. The service and its content are for informational and educational purposes only.' },
  { id: 'no-advice', title: 'No financial, investment, or tax advice', text: 'Nothing in TradeJournal is financial, investment, tax, or legal advice, or a recommendation to buy, sell, or hold any asset. Consider speaking with a qualified professional about your circumstances.' },
  { id: 'trading-risk', title: 'Trading involves risk', text: 'Trading can result in substantial losses, including the loss of your entire investment. You are responsible for your trading decisions and for evaluating the risks involved.' },
  { id: 'past-performance', title: 'Past performance', text: 'Historical records, statistics, and analytics do not guarantee future results. Data may be incomplete or inaccurate and should not be treated as a prediction.' },
  { id: 'contact', title: 'Contact', text: 'Questions about this disclaimer? Contact us at [CONTACT EMAIL].' },
].map((section, index) => ({ ...section, title: `${index + 1}. ${section.title}` }))

export default function DisclaimerPage() {
  return (
    <LegalLayout title="Disclaimer" sections={sections}>
      {sections.map(({ id, title, text }) => (
        <section className="legal-section" id={id} key={id}>
          <h2>{title}</h2>
          <p>{text}</p>
        </section>
      ))}
    </LegalLayout>
  )
}
