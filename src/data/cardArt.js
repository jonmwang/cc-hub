// Visual identity for each card.
//
// These are STYLISED representations, not the issuers' official card art — no
// logos or trademarked designs. The point is that a card is recognisable at a
// glance from its colour and finish, which is all you need at a register.
//
// To use real photos instead: drop images into `public/cards/` and add
// `image: 'cards/my-file.png'` to that card's entry. CardArt renders the photo
// and ignores everything else. Note that issuer card images are generally
// copyrighted, so keep those to your own private deployment.
//
//   bg     : gradient stops, top-left to bottom-right
//   fg     : text colour that sits on top
//   accent : chip / detail colour
//   finish : matte | metal | mirror | pearl — controls the sheen overlay
//   band   : optional accent stripe colour

export const CARD_ART = {
  chase_freedom_unlimited: {
    bg: ['#2e7fc4', '#1c5f9e', '#16406e'],
    fg: '#ffffff',
    accent: '#d8b76a',
    finish: 'matte',
    band: '#6fc0e8',
  },
  chase_freedom_flex: {
    bg: ['#1d4f80', '#163c63', '#0e2743'],
    fg: '#ffffff',
    accent: '#d8b76a',
    finish: 'matte',
    band: '#38a3d1',
  },
  chase_sapphire_preferred: {
    bg: ['#2a6bb0', '#1b4a86', '#12305a'],
    fg: '#ffffff',
    accent: '#dcc282',
    finish: 'metal',
    band: '#7cb8e6',
  },
  chase_sapphire_reserve: {
    bg: ['#3d4655', '#252c38', '#141821'],
    fg: '#f0f3f7',
    accent: '#c9a227',
    finish: 'metal',
    band: '#8f9bb0',
  },
  // The user holds the white "Rose Gold"-era white Gold Card, not the classic gold.
  amex_gold: {
    bg: ['#ffffff', '#f4f1ea', '#e2dbcb'],
    fg: '#7a6432',
    accent: '#c4a355',
    finish: 'pearl',
    band: '#d8c48c',
  },
  // Mirror-finish Platinum: highly reflective chrome rather than brushed steel.
  amex_platinum: {
    bg: ['#f2f4f7', '#c3c8d2', '#8d94a3'],
    fg: '#2b3038',
    accent: '#9aa2b1',
    finish: 'mirror',
    band: '#e6eaf0',
  },
  c1_venture_x: {
    bg: ['#2d3542', '#1a202a', '#0d1117'],
    fg: '#eef1f5',
    accent: '#b08d57',
    finish: 'metal',
    band: '#5a6678',
  },
  c1_savor: {
    bg: ['#1f2937', '#16202c', '#0d141d'],
    fg: '#ffffff',
    accent: '#e0703a',
    finish: 'matte',
    band: '#e0703a',
  },
  discover_it: {
    bg: ['#ffffff', '#f6f7f9', '#e6e9ee'],
    fg: '#41474f',
    accent: '#e87722',
    finish: 'matte',
    band: '#e87722',
  },
  wf_autograph: {
    bg: ['#3a3d42', '#26282c', '#141517'],
    fg: '#f3f4f6',
    accent: '#c8102e',
    finish: 'matte',
    band: '#c8102e',
  },
}

export const FALLBACK_ART = {
  bg: ['#5b7189', '#41546b', '#2c3a4b'],
  fg: '#ffffff',
  accent: '#9ab0c4',
  finish: 'matte',
  band: '#8ba3bb',
}
