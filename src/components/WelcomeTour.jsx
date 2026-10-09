import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import '../tour.css'

const steps = [
  {
    title: 'Welcome to TradeJournal',
    text: 'Your workspace brings your trade history, journal, and performance insights together so you can review your decisions with clarity.',
  },
  {
    title: 'Add your first trade',
    text: 'Use Add trade to record a position, including its entry, exit, size, fees, tags, and notes. You can also import a supported CSV file.',
  },
  {
    title: 'Find your reports',
    text: 'Open Reports to explore performance patterns, mistakes, and results. Weekly review helps you reflect on your process over time.',
  },
]

export default function WelcomeTour({ onFinish }) {
  const [stepIndex, setStepIndex] = useState(0)
  const dialogRef = useRef(null)
  const closeRef = useRef(null)

  useEffect(() => {
    closeRef.current?.focus()
    const dialog = dialogRef.current
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onFinish()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const focusable = [...dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onFinish])

  const current = steps[stepIndex]
  const finish = () => onFinish()

  return <div className="tour-overlay">
    <section className="tour-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-description">
      <button type="button" className="tour-close" ref={closeRef} aria-label="Skip welcome tour" onClick={finish}><X size={19} /></button>
      <span className="tour-eyebrow">YOUR QUICK TOUR · {stepIndex + 1} OF {steps.length}</span>
      <div className="tour-progress" aria-hidden="true">{steps.map((item, index) => <i key={item.title} className={index <= stepIndex ? 'active' : ''} />)}</div>
      <h2 id="tour-title">{current.title}</h2>
      <p id="tour-description">{current.text}</p>
      <div className="tour-actions">
        <button type="button" className="tour-skip" onClick={finish}>Skip tour</button>
        <div>
          {stepIndex > 0 && <button type="button" className="tour-secondary" onClick={() => setStepIndex((value) => value - 1)}><ArrowLeft size={16} />Back</button>}
          {stepIndex < steps.length - 1
            ? <button type="button" className="tour-primary" onClick={() => setStepIndex((value) => value + 1)}>Next<ArrowRight size={16} /></button>
            : <button type="button" className="tour-primary" onClick={finish}>Finish tour</button>}
        </div>
      </div>
    </section>
  </div>
}
