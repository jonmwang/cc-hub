import { CARD_ART, FALLBACK_ART } from '../data/cardArt'

// A stylised card face. Sized by width; height follows the real 1.586:1 ratio.
// If a card's art entry carries an `image`, that photo is used instead.
export default function CardArt({ card, width = 120, className = '', showText = true }) {
  const art = CARD_ART[card.id] ?? FALLBACK_ART
  const height = Math.round(width / 1.586)
  const uid = `art-${card.id}`

  // Photos already carry rounded corners in their alpha channel, so they take a
  // drop-shadow (which follows the alpha) rather than the box-shadow the SVG
  // fallback uses — otherwise the shadow would square off the corners.
  if (art.image) {
    return (
      <img
        src={art.image}
        alt=""
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        className={`card-art card-art-photo ${className}`}
      />
    )
  }

  const r = 12
  // Text only earns its place once the card is big enough to read it.
  const withText = showText && width >= 92

  return (
    <svg
      className={`card-art ${className}`}
      width={width}
      height={height}
      viewBox="0 0 320 202"
      role="img"
      aria-label={`${card.issuer} ${card.name}`}
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={art.bg[0]} />
          <stop offset="52%" stopColor={art.bg[1]} />
          <stop offset="100%" stopColor={art.bg[2]} />
        </linearGradient>

        {/* Diagonal sheen. Mirror finishes get a hard, bright band; metal a
            softer one; matte and pearl barely any. */}
        <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="38%" stopColor="#fff" stopOpacity={sheenPeak(art.finish) * 0.5} />
          <stop offset="50%" stopColor="#fff" stopOpacity={sheenPeak(art.finish)} />
          <stop offset="62%" stopColor="#fff" stopOpacity={sheenPeak(art.finish) * 0.5} />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>

        <linearGradient id={`${uid}-chip`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={art.accent} stopOpacity="0.95" />
          <stop offset="100%" stopColor={art.accent} stopOpacity="0.6" />
        </linearGradient>

        <clipPath id={`${uid}-clip`}>
          <rect x="0" y="0" width="320" height="202" rx={r} />
        </clipPath>
      </defs>

      <g clipPath={`url(#${uid}-clip)`}>
        <rect x="0" y="0" width="320" height="202" fill={`url(#${uid}-bg)`} />

        {/* Accent stripe down the right edge — the quickest colour cue. */}
        {art.band && <rect x="286" y="0" width="34" height="202" fill={art.band} opacity="0.5" />}

        <rect x="0" y="0" width="320" height="202" fill={`url(#${uid}-sheen)`} />

        {/* EMV chip */}
        <rect x="26" y="74" width="42" height="32" rx="6" fill={`url(#${uid}-chip)`} />
        <path
          d="M26 90h42M47 74v32"
          stroke={art.bg[2]}
          strokeOpacity="0.35"
          strokeWidth="2"
          fill="none"
        />

        {withText && (
          <>
            <text
              x="26"
              y="42"
              fill={art.fg}
              fontSize="19"
              fontWeight="700"
              letterSpacing="1.6"
              fontFamily="Inter, sans-serif"
              opacity="0.85"
            >
              {card.issuer.toUpperCase()}
            </text>
            <text
              x="26"
              y="172"
              fill={art.fg}
              fontSize="24"
              fontWeight="800"
              letterSpacing="-0.4"
              fontFamily="Inter, sans-serif"
            >
              {shortName(card)}
            </text>
          </>
        )}
      </g>

      <rect
        x="0.75"
        y="0.75"
        width="318.5"
        height="200.5"
        rx={r}
        fill="none"
        stroke="#000"
        strokeOpacity="0.14"
        strokeWidth="1.5"
      />
    </svg>
  )
}

function sheenPeak(finish) {
  switch (finish) {
    case 'mirror':
      return 0.62
    case 'metal':
      return 0.3
    case 'pearl':
      return 0.42
    default:
      return 0.12
  }
}

// Card faces are small; drop the issuer word and any trailing "Card".
function shortName(card) {
  let n = card.name
  const prefix = `${card.issuer} `
  if (n.toLowerCase().startsWith(prefix.toLowerCase())) n = n.slice(prefix.length)
  return n.replace(/ Card$/, '')
}
