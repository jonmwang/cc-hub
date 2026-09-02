// Point currencies and their default valuations, in cents per point (cpp).
// Transferable currencies default to 1.75¢ (the user's baseline assumption).
// Cash-back "currencies" are pinned at 1.0¢ by definition — a cent is a cent.

export const CURRENCIES = {
  chase_ur: {
    id: 'chase_ur',
    label: 'Chase Ultimate Rewards',
    short: 'UR',
    defaultCpp: 1.75,
    transferable: true,
    bank: 'Chase',
  },
  amex_mr: {
    id: 'amex_mr',
    label: 'Amex Membership Rewards',
    short: 'MR',
    defaultCpp: 1.75,
    transferable: true,
    bank: 'Amex',
  },
  c1_miles: {
    id: 'c1_miles',
    label: 'Capital One Miles',
    short: 'Miles',
    defaultCpp: 1.75,
    transferable: true,
    bank: 'Capital One',
  },
  wf_rewards: {
    id: 'wf_rewards',
    label: 'Wells Fargo Rewards',
    short: 'WF',
    defaultCpp: 1.0,
    transferable: false,
    bank: 'Wells Fargo',
    note: 'Transfer partners exist but are thin, and you rarely use this card.',
  },
  cashback: {
    id: 'cashback',
    label: 'Straight cash back',
    short: 'Cash',
    defaultCpp: 1.0,
    transferable: false,
    bank: 'Various',
    locked: true,
    note: 'A cent is a cent. Not adjustable.',
  },
}

export const CURRENCY_LIST = Object.values(CURRENCIES)

export const ISSUERS = {
  Chase: { label: 'Chase', accent: '#1866b3' },
  Amex: { label: 'American Express', accent: '#3a7ca8' },
  'Capital One': { label: 'Capital One', accent: '#2a8fa8' },
  Discover: { label: 'Discover', accent: '#c98a2e' },
  'Wells Fargo': { label: 'Wells Fargo', accent: '#a35a4a' },
}
