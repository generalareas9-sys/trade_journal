import LegalLayout from './LegalLayout'

const sections = [
  ['overview', 'Overview and Scope', 'TradeJournal provides subscription-based software access to trading analytics, journaling, and AI-assisted insights. This policy outlines our refund and cancellation conditions.'],
  ['cancellation', 'Subscription Cancellation', 'You can cancel your subscription at any time through your account settings or by contacting support. Upon cancellation, you will retain access to your plan until the end of your current paid billing period.'],
  ['refunds', 'Refund Eligibility', 'Due to the digital and instant-access nature of the service, subscription fees are generally non-refundable once activated. However, if you experienced technical difficulties that prevented you from using the service, or were billed erroneously, you may request a review within 7 days of the charge.'],
  ['manual-crypto', 'Cryptocurrency and Manual Payments', 'Due to blockchain finality and network transaction fees, manual payments made via USDT on-chain or Binance Pay are strictly non-refundable once approved and confirmed on the blockchain.'],
  ['disputes', 'Billing Inquiries and Support', 'If you believe you were charged in error, please contact our support team before initiating a chargeback or payment dispute with your bank or payment provider.'],
  ['contact', 'Contact Support', 'To request assistance or inquire about billing, email us at support@tradejournal.app.'],
].map(([id, title, text], index) => ({ id, title: `${index + 1}. ${title}`, text }))

export default function RefundPage() {
  return (
    <LegalLayout title="Refund & Cancellation Policy" sections={sections}>
      {sections.map(({ id, title, text }) => (
        <section className="legal-section" id={id} key={id}>
          <h2>{title}</h2>
          <p>{text}</p>
        </section>
      ))}
    </LegalLayout>
  )
}

