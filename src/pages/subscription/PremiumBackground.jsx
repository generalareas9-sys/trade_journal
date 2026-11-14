export default function PremiumBackground({ variant }) {
  return (
    <div className={`premium-background premium-background--${variant}`} aria-hidden="true">
      <svg className="premium-background-candles" viewBox="0 0 640 520" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={`candles-${variant}`} width="76" height="132" patternUnits="userSpaceOnUse">
            <g fill="none" strokeWidth="2">
              <path d="M13 18v48m-6-27h12v18H7z" stroke="#20e2c1" />
              <path d="M37 5v57m-6 10h12V45H31z" stroke="#ff6d8b" />
              <path d="M61 42v72m-6-39h12v23H55z" stroke="#20e2c1" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#candles-${variant})`} />
      </svg>
      <svg className="premium-background-waves" viewBox="0 0 1440 300" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`wave-blue-${variant}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#10b8ef" />
            <stop offset=".52" stopColor="#315ff4" />
            <stop offset="1" stopColor="#8055f6" />
          </linearGradient>
          <linearGradient id={`wave-purple-${variant}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#7958ed" />
            <stop offset=".52" stopColor="#13bfe1" />
            <stop offset="1" stopColor="#4a62f5" />
          </linearGradient>
        </defs>
        <path className="premium-wave premium-wave--back" fill={`url(#wave-purple-${variant})`} d="M0 176c170-105 271 32 434-13s245-135 412-55 268 91 594-29v221H0z" />
        <path className="premium-wave premium-wave--front" fill={`url(#wave-blue-${variant})`} d="M0 226c169-78 284 2 434-26s257-67 408-6 313 65 598-43v149H0z" />
      </svg>
      <span className="premium-background-dot premium-background-dot--one" />
      <span className="premium-background-dot premium-background-dot--two" />
      <span className="premium-background-dot premium-background-dot--three" />
      <span className="premium-background-dot premium-background-dot--four" />
      <span className="premium-background-dot premium-background-dot--five" />
      <span className="premium-background-dot premium-background-dot--six" />
    </div>
  )
}
