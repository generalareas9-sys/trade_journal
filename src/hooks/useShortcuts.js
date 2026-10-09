import { useEffect, useRef, useState } from 'react'

const destinations = {
  d: '/',
  j: '/journal',
  t: '/trades',
  r: '/reports',
}

function isTypingTarget(target) {
  return target instanceof HTMLElement
    && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

export default function useShortcuts({ navigate, onAddTrade, enabled = true }) {
  const [helpOpen, setHelpOpen] = useState(false)
  const goTimer = useRef(0)
  const goPending = useRef(false)

  useEffect(() => {
    if (!enabled) return undefined
    const onKeyDown = (event) => {
      if (!enabled || helpOpen || event.defaultPrevented || isTypingTarget(event.target) || event.altKey) return

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        window.dispatchEvent(new CustomEvent('tradejournal:open-search'))
        return
      }
      if (event.ctrlKey || event.metaKey) return

      if (event.key === '/') {
        event.preventDefault()
        window.dispatchEvent(new CustomEvent('tradejournal:open-search'))
        return
      }
      if (event.key === '?') {
        event.preventDefault()
        setHelpOpen(true)
        return
      }

      if (goPending.current) {
        const route = destinations[event.key.toLowerCase()]
        goPending.current = false
        window.clearTimeout(goTimer.current)
        if (route) {
          event.preventDefault()
          navigate(route)
          return
        }
      }
      if (event.key.toLowerCase() === 'g') {
        goPending.current = true
        window.clearTimeout(goTimer.current)
        goTimer.current = window.setTimeout(() => { goPending.current = false }, 1200)
        return
      }
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault()
        onAddTrade()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.clearTimeout(goTimer.current)
      goPending.current = false
    }
  }, [navigate, onAddTrade, enabled, helpOpen])

  return { helpOpen, closeHelp: () => setHelpOpen(false) }
}
