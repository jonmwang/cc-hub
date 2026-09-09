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
  {
    id: 'uber',
    name: 'Uber & Uber Eats',
    // Ranked as rideshare because that's the larger spend, but the Uber Cash
    // credit covers rides and Eats alike — which is exactly why this belongs
    // here rather than being split across two category rows.
    categoryId: 'rideshare',
    icon: '🚗',
    aliases: ['uber', 'uber eats', 'ubereats', 'uber ride', 'rideshare', 'ride share'],
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
