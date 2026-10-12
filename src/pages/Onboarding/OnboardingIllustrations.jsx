import {
  siBinance,
  siBitcoin,
  siCoinbase,
  siInstagram,
  siReddit,
  siRobinhood,
  siTiktok,
  siTradingview,
  siX,
  siYoutube,
} from 'simple-icons'

const socialIcons = {
  X: siX,
  Instagram: siInstagram,
  TikTok: siTiktok,
  YouTube: siYoutube,
  Reddit: siReddit,
}

export function CartoonAvatar({ type }) {
  const skin = '#C9825D'
  const hair = type === 'ninja' ? '#211B29' : type === 'monk' ? '#483329' : '#34231F'
  const clothing = type === 'climber' ? '#3575BF' : type === 'monk' ? '#E58B35' : type === 'ninja' ? '#242232' : '#E45A55'
  return <svg className={`obf-avatar obf-avatar-${type}`} viewBox="0 0 72 72" role="img" aria-label={`${type} cartoon portrait`}>
    <defs>
      <filter id={`obf-shadow-${type}`} x="-30%" y="-30%" width="160%" height="170%">
        <feDropShadow dx="0" dy="3" stdDeviation="2.2" floodColor="#30224c" floodOpacity=".24" />
      </filter>
    </defs>
    <g filter={`url(#obf-shadow-${type})`}>
      <circle cx="36" cy="35" r="32" fill="#fff" fillOpacity=".22" />
      <path d="M13 69c1-13 10-21 23-21s22 8 23 21" fill={clothing} />
      {type === 'climber' && <path d="M19 19c-4 8-5 22-2 32l9 4 1-25 18-4 2 30 9-5c4-21-4-37-20-38-8 0-14 2-17 6z" fill="#3A2825" />}
      {type === 'monk' && <circle cx="36" cy="27" r="16" fill={skin} />}
      {type !== 'monk' && <circle cx="36" cy="29" r="16" fill={skin} />}
      {type === 'newbie' && <>
        <path d="M20 27c-2-12 5-20 16-20s19 7 17 20l-5 5-3-10c-7 1-14 0-20-4l-1 13z" fill="#34231F" />
        <path d="M17 17c3-9 10-13 20-13 9 0 15 4 19 11l-4 7H20z" fill="#D84645" />
        <path d="M19 16c11 3 23 2 33-3" fill="none" stroke="#F67B70" strokeWidth="3" strokeLinecap="round" />
        <path d="M34 9h7" stroke="#B5363D" strokeWidth="2" strokeLinecap="round" />
      </>}
      {type === 'climber' && <>
        <path d="M19 28c-3-13 4-22 16-22 14 0 20 10 17 24l-5-8c-8 2-17 0-24-5z" fill={hair} />
        <path d="M25 48 19 68h11l6-17 7 17h12l-8-23-10 5z" fill="#fff" fillOpacity=".18" />
      </>}
      {type === 'ninja' && <>
        <path d="M19 28c-3-14 3-22 17-22s20 9 17 24l-5-8c-7 2-18 0-25-5z" fill={hair} />
        <path d="M19 26c10-5 25-5 35 0v11c-10 7-25 7-35 0z" fill="#262232" />
        <path d="M24 30c4-2 7-2 11 0m5 0c4-2 7-2 10 0" fill="none" stroke="#F4E7D6" strokeWidth="2" strokeLinecap="round" />
        <path d="M17 18c12 4 26 4 39 0" fill="none" stroke="#D3B069" strokeWidth="3" />
        <path d="m49 18 7 4-4 5" fill="#D3B069" />
      </>}
      {type === 'monk' && <>
        <path d="M21 26c-2-10 4-18 15-18s17 7 15 18c-5-5-9-7-15-7s-10 2-15 7z" fill={skin} />
        <path d="M20 29c0-9 6-15 16-15s16 6 16 15v5c-5 6-11 9-16 9s-11-3-16-9z" fill={skin} />
        <path d="M28 31h.5m15-.5h.5" stroke="#422D29" strokeWidth="2.7" strokeLinecap="round" />
        <path d="M31 38c3 2 7 2 10 0" fill="none" stroke="#794333" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M25 51c5 6 17 6 22 0" fill="none" stroke="#F5C25A" strokeWidth="2.5" strokeDasharray="1 4" strokeLinecap="round" />
      </>}
      {type !== 'monk' && type !== 'ninja' && <>
        <path d="M28 31h.5m15-.5h.5" stroke="#352522" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M31 39c3 2 7 2 10 0" fill="none" stroke="#7C4439" strokeWidth="1.7" strokeLinecap="round" />
        <rect x="22" y="26" width="12" height="9" rx="4" fill="none" stroke="#382F45" strokeWidth="1.8" />
        <rect x="38" y="26" width="12" height="9" rx="4" fill="none" stroke="#382F45" strokeWidth="1.8" />
        <path d="M34 29h4" stroke="#382F45" strokeWidth="1.5" />
      </>}
      {type === 'newbie' && <path d="M22 43c5 5 11 7 14 7s9-2 14-7" fill="none" stroke="#fff" strokeOpacity=".58" strokeWidth="2" />}
    </g>
  </svg>
}

export function SimpleBrandIcon({ name, className = '' }) {
  const icon = socialIcons[name]
  if (name === 'Google') {
    return <svg className={`obf-official-icon obf-google-g ${className}`} viewBox="0 0 48 48" role="img" aria-label="Google">
      <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.9z" />
      <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2A20 20 0 0 0 24 44z" />
      <path fill="#FBBC05" d="M12.6 27.8a12 12 0 0 1 0-7.6V15H5.8a20 20 0 0 0 0 18z" />
      <path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 5.8 29.5 4 24 4A20 20 0 0 0 5.8 15l6.8 5.2C14.2 15.6 18.7 12 24 12z" />
    </svg>
  }
  if (name === 'Instagram') {
    return <svg className={`obf-official-icon obf-instagram-icon ${className}`} viewBox="0 0 24 24" role="img" aria-label="Instagram">
      <defs><linearGradient id="obf-instagram-gradient" x1="0" y1="1" x2="1" y2="0"><stop stopColor="#FEDA75" /><stop offset=".48" stopColor="#D62976" /><stop offset="1" stopColor="#4F5BD5" /></linearGradient></defs>
      <path d={siInstagram.path} fill="url(#obf-instagram-gradient)" />
    </svg>
  }
  if (!icon) return null
  return <svg className={`obf-official-icon ${className}`} viewBox="0 0 24 24" role="img" aria-label={icon.title}>
    <path d={icon.path} fill={`#${icon.hex}`} />
  </svg>
}

const brokerIcons = {
  'Robinhood': siRobinhood,
  'Binance': siBinance,
  'Coinbase': siCoinbase,
  'TradingView': siTradingview,
}

const brokerIconLabels = {
  Robinhood: brokerIcons.Robinhood.title,
  Binance: brokerIcons.Binance.title,
  Coinbase: brokerIcons.Coinbase.title,
  TradingView: brokerIcons.TradingView.title,
}

export function BrokerBrand({ name }) {
  const icon = brokerIcons[name]
  if (!icon) return null
  return <svg className="obf-broker-logo" viewBox="0 0 24 24" role="img" aria-label={`${brokerIconLabels[name]} logo`}>
    <path d={icon.path} fill={`#${icon.hex}`} />
  </svg>
}

export function hasBrokerBrand(name) {
  return Boolean(brokerIcons[name])
}

export function BitcoinBrand() {
  return <svg className="obf-market-bitcoin" viewBox="0 0 24 24" role="img" aria-label="Bitcoin">
    <path d={siBitcoin.path} fill={`#${siBitcoin.hex}`} />
  </svg>
}
