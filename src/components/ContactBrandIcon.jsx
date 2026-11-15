import { siTelegram, siWhatsapp } from 'simple-icons'

const icons = {
  telegram: siTelegram,
  whatsapp: siWhatsapp,
}

export default function ContactBrandIcon({ brand, className = '' }) {
  const icon = icons[brand]

  return (
    <span className={`contact-brand-mark contact-brand-mark-${brand} ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d={icon.path} />
      </svg>
    </span>
  )
}
