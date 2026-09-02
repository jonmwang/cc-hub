// Every spend category the "What Card Should I Use?" page can answer for.
// `id` is the key cards reference in their earn tables.

export const CATEGORIES = [
  // --- Travel ---
  { id: 'flights_direct', label: 'Flights', hint: 'Booked with the airline directly', group: 'Travel', icon: '✈️' },
  { id: 'hotels_direct', label: 'Hotels', hint: 'Booked with the hotel directly', group: 'Travel', icon: '🏨' },
  { id: 'travel_portal_chase', label: 'Chase Travel portal', hint: 'travel.chase.com — flights or hotels', group: 'Travel', icon: '🧳' },
  { id: 'travel_portal_amex_flights', label: 'Amex Travel — flights', hint: 'amextravel.com', group: 'Travel', icon: '🧳' },
  { id: 'travel_portal_amex_hotels', label: 'Amex Travel — prepaid hotels', hint: 'amextravel.com', group: 'Travel', icon: '🧳' },
  { id: 'travel_portal_c1_flights', label: 'Capital One Travel — flights', hint: 'capitalonetravel.com', group: 'Travel', icon: '🧳' },
  { id: 'travel_portal_c1_hotels', label: 'Capital One Travel — hotels & cars', hint: 'capitalonetravel.com', group: 'Travel', icon: '🧳' },
  { id: 'travel_other', label: 'Other travel', hint: 'Cruises, tolls, parking, rental cars, agencies', group: 'Travel', icon: '🚢' },
  { id: 'transit', label: 'Public transit', hint: 'Subway, bus, train, ferry', group: 'Travel', icon: '🚇' },
  { id: 'rideshare', label: 'Rideshare & taxis', hint: 'Uber, Lyft, cabs', group: 'Travel', icon: '🚕' },

  // --- Everyday ---
  { id: 'dining', label: 'Restaurants & dining', hint: 'Sit-down, takeout, delivery, bars', group: 'Everyday', icon: '🍽️' },
  { id: 'groceries', label: 'Groceries (in store)', hint: 'US supermarkets — not Walmart/Target/warehouse', group: 'Everyday', icon: '🛒' },
  { id: 'groceries_online', label: 'Groceries (online)', hint: 'Instacart, online supermarket orders', group: 'Everyday', icon: '📦' },
  { id: 'wholesale', label: 'Warehouse clubs', hint: 'Costco, Sam’s Club, BJ’s', group: 'Everyday', icon: '🏬' },
  { id: 'gas', label: 'Gas stations', hint: 'Fuel, EV charging at stations', group: 'Everyday', icon: '⛽' },
  { id: 'drugstores', label: 'Drugstores', hint: 'CVS, Walgreens, Rite Aid', group: 'Everyday', icon: '💊' },

  // --- Lifestyle ---
  { id: 'streaming', label: 'Streaming services', hint: 'Netflix, Spotify, Hulu, Disney+', group: 'Lifestyle', icon: '📺' },
  { id: 'entertainment', label: 'Entertainment & movies', hint: 'Cinemas, concerts, live events, ticketing', group: 'Lifestyle', icon: '🎬' },
  { id: 'online_retail', label: 'Online shopping', hint: 'Amazon and general online retail', group: 'Lifestyle', icon: '🛍️' },
  { id: 'phone', label: 'Phone plan', hint: 'Cell service billed by the carrier', group: 'Lifestyle', icon: '📱' },

  // --- Catch-all ---
  { id: 'everything_else', label: 'Everything else', hint: 'Anything with no bonus category', group: 'Catch-all', icon: '💳' },
]

export const CATEGORY_GROUPS = ['Travel', 'Everyday', 'Lifestyle', 'Catch-all']

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))
