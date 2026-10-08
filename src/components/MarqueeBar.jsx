import { useEffect, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import '../marquee.css'

const MESSAGES = [
  'Welcome to TradeJournal!',
  'This website was developed by a trader, for traders.',
  'Developer: Osman Seid, a student of Information Science at Haramaya University.',
  'Track every trade, review every day, and build your edge.',
]

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function MarqueeBar() {
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion)
  const [paused, setPaused] = useState(false)
  const [interacting, setInteracting] = useState(false)
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setReducedMotion(media.matches)
    media.addEventListener?.('change', updatePreference)
    return () => media.removeEventListener?.('change', updatePreference)
  }, [])

  useEffect(() => {
    if (!reducedMotion || paused || interacting) return undefined
    const timer = window.setInterval(() => {
      setMessageIndex((index) => (index + 1) % MESSAGES.length)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [reducedMotion, paused, interacting])

  const interactionProps = {
    onMouseEnter: () => setInteracting(true),
    onMouseLeave: () => setInteracting(false),
    onFocusCapture: () => setInteracting(true),
    onBlurCapture: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false)
    },
  }

  return (
    <section className={`mq-bar${paused ? ' mq-paused' : ''}`} aria-label="Announcements" role="region" {...interactionProps}>
      {reducedMotion ? (
        <div className="mq-reduced-message" key={messageIndex}>
          {MESSAGES[messageIndex]}
        </div>
      ) : (
        <div className="mq-viewport">
          <div className="mq-track">
            {[false, true].map((duplicate) => (
              <div className="mq-group" key={duplicate ? 'duplicate' : 'primary'} aria-hidden={duplicate || undefined}>
                {MESSAGES.map((message) => (
                  <span className="mq-item" key={message}>
                    {message}
                    <span className="mq-separator" aria-hidden="true">◆</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        className="mq-toggle"
        aria-label={paused ? 'Play announcements' : 'Pause announcements'}
        aria-pressed={paused}
        onClick={() => setPaused((current) => !current)}
      >
        {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
      </button>
    </section>
  )
}
