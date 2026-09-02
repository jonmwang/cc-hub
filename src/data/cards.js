// The card catalog.
//
// `earn`   : categoryId -> multiplier. Anything missing falls back to `base`.
// `credits`: recurring statement credits, used by the Fee Calculator and the
//            Credit Tracker. `value` is the face amount; users override what
//            it's actually worth to them.
// `period` : monthly | quarterly | semiannual | annual | anniversary | every4years
//            `anniversary` resets on the card's own open-date anniversary,
//            which is why cards using it prompt for an open date.
// `rotating: true` unlocks quarterly multiplier editing for that card ONLY.
//
// Verified against the issuers' own product pages in September 2026. Issuers
// change these constantly — Amex Platinum most of all — so re-check before
// making a keep-or-cancel decision on a big fee.

export const CARDS = [
  // ─────────────────────────────── CHASE ───────────────────────────────
  {
    id: 'chase_freedom_unlimited',
    name: 'Freedom Unlimited',
    issuer: 'Chase',
    currency: 'chase_ur',
    annualFee: 0,
    base: 1.5,
    earn: {
      travel_portal_chase: 5,
      dining: 3,
      drugstores: 3,
    },
    credits: [],
    notes: [
      'Largely redundant next to your other Chase cards, but it is free to keep and helps average age of accounts.',
      'Its points only become transferable while you also hold a Sapphire card.',
    ],
  },
  {
    id: 'chase_freedom_flex',
    name: 'Freedom Flex',
    issuer: 'Chase',
    currency: 'chase_ur',
    annualFee: 0,
    base: 1,
    rotating: true,
    rotatingCap: 1500,
    rotatingBonus: 4,
    rotatingNote: 'Adds 4x on up to $1,500 in combined spend each quarter, after activation.',
    earn: {
      travel_portal_chase: 5,
      dining: 3,
      drugstores: 3,
    },
    credits: [],
    notes: [
      'The quarterly bonus stacks on top of the standing rate rather than replacing it. On a plain category that is the advertised 5%, but on dining or drugstores — already 3x — a quarterly pick makes it 7x.',
      'Has a 3% foreign transaction fee — leave it home when travelling abroad.',
      'Points only become transferable while you also hold a Sapphire card.',
    ],
  },
  {
    id: 'chase_sapphire_preferred',
    name: 'Sapphire Preferred',
    issuer: 'Chase',
    currency: 'chase_ur',
    annualFee: 95,
    base: 1,
    anniversaryBonus: 0.1,
    // Chase is retiring the 10% anniversary bonus. After this date the app
    // stops adding the +0.1x on its own, so every Chase rate below quietly
    // reverts to the plain published number instead of overstating it.
    anniversaryBonusEndsOn: '2026-10-01',
    anniversaryBonusNote:
      '10% anniversary points bonus on the prior year of spend — modelled here as +0.1x on every category. Chase is ending this benefit on 1 October 2026, after which these rates drop back to the base numbers automatically.',
    earn: {
      travel_portal_chase: 5,
      rideshare: 5,
      dining: 3,
      gas: 3,
      streaming: 3,
      groceries_online: 3,
      flights_direct: 2,
      hotels_direct: 2,
      travel_other: 2,
      transit: 2,
    },
    credits: [
      {
        id: 'csp_hotel',
        label: 'Chase Travel hotel credit',
        value: 100,
        period: 'anniversary',
        note: 'Applied to a hotel stay booked through Chase Travel.',
      },
      {
        id: 'csp_doordash',
        label: 'DoorDash non-restaurant promo',
        value: 10,
        period: 'monthly',
        note: 'Requires DashPass, which the card includes through 2027.',
      },
      {
        id: 'csp_appletv',
        label: 'Apple TV+ subscription',
        value: 156,
        period: 'annual',
        note: 'Complimentary for 12 months. Worth $0 to you if you would not otherwise pay for it.',
      },
      { id: 'csp_globalentry', label: 'Global Entry / TSA PreCheck', value: 120, period: 'every4years' },
    ],
    notes: [
      'Counts public transit as travel, which most cards do not.',
      '5x on Lyft runs through 9/30/2027; 3x gas and EV charging are newer additions.',
    ],
  },
  {
    id: 'chase_sapphire_reserve',
    name: 'Sapphire Reserve',
    issuer: 'Chase',
    currency: 'chase_ur',
    annualFee: 795,
    base: 1,
    earn: {
      travel_portal_chase: 8,
      flights_direct: 4,
      hotels_direct: 4,
      dining: 3,
    },
    credits: [
      { id: 'csr_travel', label: 'Annual travel credit', value: 300, period: 'anniversary', note: 'Applies automatically to the first $300 of travel, transit included.' },
      { id: 'csr_edit', label: 'The Edit hotel credit', value: 500, period: 'annual', note: 'Up to $250 per booking, $500 per calendar year. 2+ night stays.' },
      { id: 'csr_chasehotels', label: 'Select Chase Travel hotels credit', value: 250, period: 'annual', note: 'Two-night minimum. Runs through 12/31/26.' },
      { id: 'csr_dining_h1', label: 'Exclusive Tables dining — Jan–Jun', value: 150, period: 'semiannual', half: 1, note: 'Through OpenTable Sapphire Exclusive Tables.' },
      { id: 'csr_dining_h2', label: 'Exclusive Tables dining — Jul–Dec', value: 150, period: 'semiannual', half: 2, note: 'Through OpenTable Sapphire Exclusive Tables.' },
      { id: 'csr_stubhub_h1', label: 'StubHub / viagogo — Jan–Jun', value: 150, period: 'semiannual', half: 1 },
      { id: 'csr_stubhub_h2', label: 'StubHub / viagogo — Jul–Dec', value: 150, period: 'semiannual', half: 2 },
      { id: 'csr_doordash', label: 'DoorDash promos', value: 25, period: 'monthly', note: '$5 restaurant plus two $10 non-restaurant credits each month.' },
      { id: 'csr_lyft', label: 'Lyft credit', value: 10, period: 'monthly', note: 'In-app credit. Runs through 9/30/27.' },
      { id: 'csr_peloton', label: 'Peloton credit', value: 10, period: 'monthly', note: 'Through 12/31/27.' },
      { id: 'csr_dashpass', label: 'DashPass membership', value: 120, period: 'annual', note: 'Complimentary for 12 months; activate by 12/31/27.' },
      { id: 'csr_apple', label: 'Apple TV+ and Apple Music', value: 288, period: 'annual', note: 'Complimentary through 6/22/27. Worth $0 to you if you would not otherwise pay.' },
      { id: 'csr_globalentry', label: 'Global Entry / TSA PreCheck', value: 120, period: 'every4years' },
    ],
    notes: [
      'The headline fee is large; the Fee Calculator page is where you decide how much of it you actually claw back.',
      'The dining and StubHub credits are semiannual — they expire twice a year, not once.',
      'Spending $75k in a year unlocks Hyatt Explorist, IHG Diamond, and several more credits not modelled here.',
      'Authorised users are $195 each.',
    ],
  },

  // ─────────────────────────────── AMEX ───────────────────────────────
  {
    id: 'amex_gold',
    name: 'Gold Card',
    issuer: 'Amex',
    currency: 'amex_mr',
    annualFee: 325,
    base: 1,
    earn: {
      travel_portal_amex_hotels: 5,
      dining: 4,
      groceries: 4,
      flights_direct: 3,
      travel_portal_amex_flights: 3,
      travel_other: 2,
    },
    credits: [
      { id: 'gold_uber', label: 'Uber Cash', value: 10, period: 'monthly', note: 'Uber rides or Uber Eats. Add the card to your Uber account first.' },
      { id: 'gold_dining', label: 'Dining credit', value: 10, period: 'monthly', note: 'Grubhub, Cheesecake Factory, Goldbelly, Wine.com, Five Guys.' },
      { id: 'gold_dunkin', label: 'Dunkin’ credit', value: 7, period: 'monthly', note: 'Top up the Dunkin’ app to bank the value for later.' },
      { id: 'gold_resy_h1', label: 'Resy credit — Jan–Jun', value: 50, period: 'semiannual', half: 1 },
      { id: 'gold_resy_h2', label: 'Resy credit — Jul–Dec', value: 50, period: 'semiannual', half: 2 },
    ],
    notes: [
      'The 4x grocery rate is US supermarkets only — warehouse clubs and superstores are excluded.',
      'Dining is capped at $50k/yr and groceries at $25k/yr; past the cap both drop to 1x.',
      '5x applies to prepaid hotels booked on Amex Travel; flights there earn 3x.',
      'Also carries a $100 Hotel Collection credit on 2+ night bookings, which is per-booking rather than recurring and so is not tracked here.',
    ],
  },
  {
    id: 'amex_platinum',
    name: 'Platinum Card',
    issuer: 'Amex',
    currency: 'amex_mr',
    annualFee: 895,
    base: 1,
    earn: {
      flights_direct: 5,
      travel_portal_amex_flights: 5,
      travel_portal_amex_hotels: 5,
    },
    credits: [
      { id: 'plat_hotel_h1', label: 'Hotel credit — Jan–Jun', value: 300, period: 'semiannual', half: 1, note: 'Fine Hotels + Resorts or The Hotel Collection, prepaid on Amex Travel.' },
      { id: 'plat_hotel_h2', label: 'Hotel credit — Jul–Dec', value: 300, period: 'semiannual', half: 2, note: 'Fine Hotels + Resorts or The Hotel Collection, prepaid on Amex Travel.' },
      { id: 'plat_resy', label: 'Resy dining credit', value: 100, period: 'quarterly' },
      { id: 'plat_lululemon', label: 'lululemon credit', value: 75, period: 'quarterly', note: 'US retail stores and lululemon.com. Outlets excluded.' },
      { id: 'plat_digital', label: 'Digital entertainment credit', value: 25, period: 'monthly', note: 'Select streaming and news subscriptions.' },
      { id: 'plat_uber', label: 'Uber Cash', value: 15, period: 'monthly', note: 'Bumped by $20 in December.' },
      { id: 'plat_walmart', label: 'Walmart+ membership', value: 12.95, period: 'monthly', note: 'Offsets the monthly membership charge.' },
      { id: 'plat_airline', label: 'Airline incidental credit', value: 200, period: 'annual', note: 'Pick one airline per year. Bags and seats, not fares.' },
      { id: 'plat_equinox', label: 'Equinox credit', value: 300, period: 'annual', note: 'Club membership or Equinox+ digital.' },
      { id: 'plat_clear', label: 'CLEAR Plus membership', value: 219, period: 'annual' },
      { id: 'plat_oura', label: 'Oura Ring credit', value: 200, period: 'annual', note: 'Purchased at ouraring.com.' },
      { id: 'plat_uberone', label: 'Uber One membership', value: 120, period: 'annual' },
      { id: 'plat_saks_h1', label: 'Saks credit — Jan–Jun', value: 50, period: 'semiannual', half: 1 },
      { id: 'plat_saks_h2', label: 'Saks credit — Jul–Dec', value: 50, period: 'semiannual', half: 2 },
      { id: 'plat_globalentry', label: 'Global Entry / TSA PreCheck', value: 120, period: 'every4years' },
    ],
    notes: [
      'Earns 1x on almost everything outside of airfare — it is a credits-and-lounges card, not a spending card.',
      'Nearly every credit requires enrolling in the benefit first; an unenrolled credit simply does not post.',
      'Credit amounts move around more than any other card here. Verify against your Amex account and edit as needed.',
    ],
  },

  // ───────────────────────────── CAPITAL ONE ─────────────────────────────
  {
    id: 'c1_venture_x',
    name: 'Venture X',
    issuer: 'Capital One',
    currency: 'c1_miles',
    annualFee: 395,
    base: 2,
    earn: {
      travel_portal_c1_hotels: 10,
      travel_portal_c1_flights: 5,
    },
    credits: [
      { id: 'vx_travel', label: 'Capital One Travel credit', value: 300, period: 'anniversary', note: 'Must be booked through the Capital One Travel portal.' },
      { id: 'vx_anniversary', label: '10,000 anniversary miles', value: 100, period: 'anniversary', note: 'Worth $100 in the portal, more if you transfer them.' },
      { id: 'vx_globalentry', label: 'Global Entry / TSA PreCheck', value: 120, period: 'every4years' },
    ],
    notes: [
      '2x on absolutely everything makes this the default catch-all card.',
      'Also earns 5x through Capital One Entertainment, which is a separate booking portal rather than general entertainment spend.',
      'Priority Pass plus Capital One Lounge access, including authorised users.',
      'Both the travel credit and the anniversary miles run on your card anniversary, not the calendar year.',
    ],
  },
  {
    id: 'c1_savor',
    name: 'Savor',
    issuer: 'Capital One',
    currency: 'c1_miles',
    annualFee: 0,
    base: 1,
    cashbackNative: true,
    earn: {
      travel_portal_c1_hotels: 5,
      dining: 3,
      groceries: 3,
      streaming: 3,
      entertainment: 3,
    },
    credits: [],
    notes: [
      'Earns cash back natively, but because you also hold the Venture X the rewards convert to Capital One Miles — so it is valued as a points card here.',
      'Grocery rate excludes Walmart, Target, and warehouse clubs.',
      'Also earns 8% through Capital One Entertainment, a separate booking portal.',
      'Grandfathered with no annual fee from the old SavorOne Student.',
    ],
  },

  // ─────────────────────────────── DISCOVER ───────────────────────────────
  {
    id: 'discover_it',
    name: 'Discover it Student',
    issuer: 'Discover',
    currency: 'cashback',
    annualFee: 0,
    base: 1,
    rotating: true,
    rotatingCap: 1500,
    rotatingBonus: 4,
    rotatingNote: 'Adds 4% on up to $1,500 in spend each quarter, after activation.',
    earn: {},
    credits: [],
    notes: [
      'Pure cash back — no transfer partners, so a point here is worth exactly one cent.',
      'Acceptance is noticeably thinner than Visa or Mastercard.',
    ],
  },

  // ────────────────────────────── WELLS FARGO ──────────────────────────────
  {
    id: 'wf_autograph',
    name: 'Autograph',
    issuer: 'Wells Fargo',
    currency: 'wf_rewards',
    annualFee: 0,
    base: 1,
    earn: {
      dining: 3,
      flights_direct: 3,
      hotels_direct: 3,
      travel_other: 3,
      transit: 3,
      rideshare: 3,
      gas: 3,
      streaming: 3,
      phone: 3,
    },
    credits: [],
    notes: ['Broad 3x categories, but the rewards currency is weak compared to your transferable points.'],
  },
]

export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]))

export const ROTATING_CARD_IDS = CARDS.filter((c) => c.rotating).map((c) => c.id)
