// Rotating 5% categories as officially announced by the issuer, per quarter.
//
// Entries are keyed by quarter, so a quarter can be added weeks early and it
// switches on by itself on the first day of that quarter — no deploy needed on
// the day. Until then the current quarter's picks keep applying.
//
// Only ever fill this from the issuer's OWN pages (links in `source`). A wrong
// entry here reaches every reader, including the Siri and extension answers.
//
// A category picked by hand in Which Card for the current quarter overrides the
// entry here, so a mistake can be corrected on the spot without a release.
//
// Maintained by the scheduled rotating-categories agent; see
// docs/ROTATING_AGENT.md.

export const ROTATING_CALENDAR = {
  chase_freedom_flex: {
    '2026-Q4': {
      categories: ['groceries', 'dining', 'red_cross'],
      source: 'https://media.chase.com/news/chase-freedom-2026-q4-categories',
      note: 'Grocery stores (not Walmart or Target), dining, and American Red Cross donations. Up to $1,500 combined.',
    },
  },
  discover_it: {
    '2026-Q4': {
      categories: ['dining', 'entertainment', 'utilities'],
      source: 'https://www.discover.com/credit-cards/cashback-bonus/cashback-calendar.html',
      note: 'Restaurants, entertainment and utilities. Up to $1,500 combined.',
    },
  },
}

export function announcedRotation(cardId, quarterKey) {
  return ROTATING_CALENDAR[cardId]?.[quarterKey] ?? null
}
