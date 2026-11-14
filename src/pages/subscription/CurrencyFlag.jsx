export default function CurrencyFlag({ currency }) {
  const isUsd = currency === 'USD'
  const clipId = `currency-flag-${isUsd ? 'usd' : 'etb'}`

  return (
    <svg
      className="currency-flag"
      viewBox="0 0 32 32"
      role="img"
      aria-label={isUsd ? 'United States flag' : 'Ethiopian flag'}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="16" cy="16" r="15" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {isUsd ? (
          <>
            <path fill="#fff" d="M0 0h32v32H0z" />
            <path fill="#c5223b" d="M0 0h32v2.5H0zm0 5h32v2.5H0zm0 5h32v2.5H0zm0 5h32v2.5H0zm0 5h32v2.5H0zm0 5h32v2.5H0zm0 5h32v2H0z" />
            <path fill="#25356f" d="M0 0h14v17H0z" />
            <path fill="#fff" d="m3 3 .55 1.15 1.27.18-.92.9.22 1.27L3 5.9l-1.12.6.21-1.27-.92-.9 1.27-.18zm5 0 .55 1.15 1.27.18-.92.9.22 1.27L8 5.9l-1.12.6.21-1.27-.92-.9 1.27-.18zm5 0 .55 1.15 1.27.18-.92.9.22 1.27L13 5.9l-1.12.6.21-1.27-.92-.9 1.27-.18zM5.5 9l.55 1.15 1.27.18-.92.9.22 1.27-1.12-.6-1.12.6.21-1.27-.92-.9 1.27-.18zm5 0 .55 1.15 1.27.18-.92.9.22 1.27-1.12-.6-1.12.6.21-1.27-.92-.9 1.27-.18zM3 14l.55 1.15 1.27.18-.92.9.22 1.27L3 16.9l-1.12.6.21-1.27-.92-.9 1.27-.18zm5 0 .55 1.15 1.27.18-.92.9.22 1.27L8 16.9l-1.12.6.21-1.27-.92-.9 1.27-.18zm5 0 .55 1.15 1.27.18-.92.9.22 1.27-1.12-.6-1.12.6.21-1.27-.92-.9 1.27-.18z" />
          </>
        ) : (
          <>
            <path fill="#078a45" d="M0 0h32v10.67H0z" />
            <path fill="#f5d522" d="M0 10.67h32v10.66H0z" />
            <path fill="#e52b36" d="M0 21.33h32V32H0z" />
            <circle cx="16" cy="16" r="9.3" fill="#1768c4" />
            <path fill="#ffdf32" d="m16 8.6 1.58 5.05 4.12-3.3-2.37 4.73 5.28.12-5.03 1.62 3.34 4.08-4.75-2.32-.07 5.28-1.67-5.02-4.05 3.37 2.27-4.77-5.28-.02 5-1.72-3.4-4.02 4.79 2.22z" />
          </>
        )}
      </g>
      <circle cx="16" cy="16" r="15" fill="none" stroke="rgba(13, 30, 66, .16)" />
    </svg>
  )
}
