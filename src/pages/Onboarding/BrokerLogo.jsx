import { useState } from 'react'
import { siBinance, siCoinbase, siRobinhood, siTradingview } from 'simple-icons'
import { brokerLogos } from './brokerLogos'

const resolvedSources = new Map()
const simpleIcons = {
  Binance: siBinance,
  Coinbase: siCoinbase,
  Robinhood: siRobinhood,
  TradingView: siTradingview,
}

function simpleIconData(icon) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#${icon.hex}" d="${icon.path}"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function getLogoSources(broker) {
  const details = brokerLogos[broker]
  if (!details) return []

  const icon = simpleIcons[broker]
  return [
    ...(details.file ? [{ type: 'file', src: details.file }] : []),
    ...(icon ? [{ type: 'simple-icons', src: simpleIconData(icon) }] : []),
    { type: 'website icon', src: `https://www.google.com/s2/favicons?domain=${details.domain}&sz=128` },
  ]
}

function getInitials(name) {
  if (name === 'Interactive Brokers') return 'IB'
  return (name.match(/[A-Z0-9]/gi) || []).slice(0, 2).join('').toUpperCase()
}

export default function BrokerLogo({ broker }) {
  const sources = getLogoSources(broker)
  const cachedSource = resolvedSources.get(broker)
  const [sourceIndex, setSourceIndex] = useState(() => {
    if (!cachedSource) return 0
    if (cachedSource.type === 'initials') return sources.length
    const index = sources.findIndex((source) => source.type === cachedSource.type && source.src === cachedSource.src)
    return index < 0 ? 0 : index
  })
  const source = sources[sourceIndex]

  const handleLoad = () => {
    resolvedSources.set(broker, source)
  }

  const handleError = () => {
    const nextIndex = sourceIndex + 1
    if (nextIndex < sources.length) {
      setSourceIndex(nextIndex)
      return
    }
    resolvedSources.set(broker, { type: 'initials' })
    setSourceIndex(sources.length)
  }

  return <span className="obf-broker-logo-wrap" aria-hidden="true">
    {source
      ? <img
          className="obf-broker-logo-image"
          src={source.src}
          alt=""
          loading={source.type === 'website icon' ? 'lazy' : 'eager'}
          referrerPolicy="no-referrer"
          onLoad={handleLoad}
          onError={handleError}
        />
      : <span className="obf-broker-initials">{getInitials(broker) || '?'}</span>}
  </span>
}
