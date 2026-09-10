// Merchants where a statement credit — not the earn rate — decides the card.
//
// The usual advice ("use whatever earns most") is wrong at these places. A
// DoorDash order on the Amex Gold earns 4x against the Sapphire Reserve's 3x,
// a gap worth about 1.75¢ per dollar. But the Reserve carries $25 of DoorDash
// credit each month that can ONLY be captured by paying with that card. On any
// realistic order the credit dwarfs the earn difference — see crossoverSpend in
// lib/credits.js for where that actually flips.
//
// So these get their own rows: claim the credit first, then fall back to the
// best earner once it's gone for the period.
//
// `categoryId` is what the purchase is for post-credit ranking purposes.

export const CREDIT_MERCHANTS = [
  {
    id: 'doordash',
    name: 'DoorDash',
    categoryId: 'dining',
    icon: '🛵',
    aliases: ['doordash', 'door dash', 'dash pass', 'dashpass'],
  },
  // Uber is two merchants sharing one credit. The Uber Cash pool covers rides
  // and Eats alike, and that was the reason these were a single row ranked as
  // rideshare — but the credit and the earn rate answer different questions.
  // Uber Eats codes as dining, rides code as rideshare, and nothing in this
  // wallet earns the same on both.
  //
  // As one rideshare row, Uber Eats answered the Sapphire Preferred at 5.1x,
  // which is its rideshare rate; on Eats the Preferred earns 3x. So: two rows
  // for the earn rate, `creditPool` to keep them drawing on the one pot of Uber
  // Cash. Usage is tracked per credit id, so spending it here marks it spent in
  // both places.
  {
    id: 'uber',
    name: 'Uber',
    categoryId: 'rideshare',
    icon: '🚗',
    creditPool: 'uber',
    aliases: ['uber', 'uber ride', 'uber rides', 'rideshare', 'ride share'],
  },
  {
    id: 'ubereats',
    name: 'Uber Eats',
    categoryId: 'dining',
    icon: '🥡',
    creditPool: 'uber',
    aliases: ['uber eats', 'ubereats'],
  },
  {
    id: 'lyft',
    name: 'Lyft',
    categoryId: 'rideshare',
    icon: '🚕',
    aliases: ['lyft'],
  },
]

export const CREDIT_MERCHANT_BY_ID = Object.fromEntries(CREDIT_MERCHANTS.map((m) => [m.id, m]))
