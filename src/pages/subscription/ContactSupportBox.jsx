import React from 'react';
import { Phone, Send } from 'lucide-react';
import { contactInfo } from '../../config/contact';
import './subscription.css';

export default function ContactSupportBox() {
  const displayPhone = contactInfo.phone.replace('+251', '0'); // show 0986446282
  const telLink = `tel:${contactInfo.phone.replace(/[^\d+]/g, '')}`;

  return (
    <div className="payment-contact-callout">
      <div className="payment-contact-heading">
        <span className="payment-contact-logo-wrap">
          <img src="/icon-bear-192.png" alt="" className="payment-contact-logo" />
        </span>
        <div className="payment-contact-copy">
          <span className="payment-contact-eyebrow">TRADEJOURNAL PAYMENT SUPPORT</span>
          <strong>Payment sent? Let us know.</strong>
          <span>Contact us so we can verify your transfer and activate your plan.</span>
        </div>
      </div>
      <div className="payment-contact-links">
        <a className="payment-contact-link-call" href={telLink}>
          <span className="payment-contact-link-icon"><Phone size={18} /></span>
          <span>
            <small>CALL OUR SUPPORT TEAM</small>
            <strong>{displayPhone}</strong>
          </span>
        </a>
        <a className="payment-contact-link-telegram" href={contactInfo.telegramUrl} target="_blank" rel="noreferrer">
          <span className="payment-contact-link-icon"><Send size={18} /></span>
          <span>
            <small>CHAT WITH US ON TELEGRAM</small>
            <strong>{contactInfo.telegramHandle}</strong>
          </span>
        </a>
      </div>
    </div>
  );
}
