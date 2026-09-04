import { CATEGORY_BY_ID } from '../data/categories'
import { rankCardsForCategory } from './ranking'
import { currentQuarterLabel } from './periods'
import { cardTitle } from '../components/ui'

// Builds the snapshot the Siri shortcut reads.
//
// Tab-separated rather than JSON on purpose: the shell script that consumes it
// has to run on a Mac with nothing installed, and stock macOS has no jq and no
// guaranteed python3. awk handles TSV natively.
//
//   V  version  quarter
//   A  categoryId  label  card  rate  fallbackSentence
//   X  spokenAlias  categoryId
//
// The flow mirrors Quick Picks exactly, so a spoken answer can never disagree
// with what the page shows.
const FLOW = [
  { categoryId: 'dining', label: 'restaurants and takeout' },
  { categoryId: 'groceries', label: 'groceries' },
  { categoryId: 'superstores', label: 'Walmart and Target' },
  { categoryId: 'entertainment', label: 'movies and live events' },
  { categoryId: 'transit', label: 'the subway, bus or train' },
  { categoryId: 'gas', label: 'gas' },
  { categoryId: 'drugstores', label: 'drugstores' },
  { categoryId: 'flights_direct', label: 'flights' },
  { categoryId: 'hotels_direct', label: 'hotels' },
  { categoryId: 'streaming', label: 'streaming subscriptions' },
  { categoryId: 'online_retail', label: 'online shopping' },
  { categoryId: 'wholesale', label: 'Costco and warehouse clubs' },
  { categoryId: 'everything_else', label: 'everything else' },
]

// What people actually say out loud, which is rarely the category name. Siri
// hands over the whole phrase, so these need to cover natural speech.
const ALIASES = {
  dining: ['restaurant', 'restaurants', 'dinner', 'lunch', 'breakfast', 'brunch', 'food', 'takeout', 'take out', 'eating out', 'dining', 'delivery', 'doordash', 'uber eats', 'bar', 'drinks', 'cafe', 'coffee'],
  groceries: ['grocery', 'groceries', 'supermarket', 'food shopping', 'trader joes', 'whole foods', 'safeway', 'wegmans', 'h mart', 'hmart'],
  superstores: ['walmart', 'target', 'superstore', 'super store'],
  entertainment: ['movie', 'movies', 'cinema', 'theater', 'theatre', 'concert', 'concerts', 'show', 'live event', 'live events', 'tickets', 'amc'],
  transit: ['subway', 'metro', 'bus', 'train', 'transit', 'public transit', 'mta', 'bart', 'commute'],
  gas: ['gas', 'petrol', 'fuel', 'gas station', 'filling up', 'ev charging', 'charging'],
  drugstores: ['drugstore', 'drugstores', 'pharmacy', 'cvs', 'walgreens', 'rite aid'],
  flights_direct: ['flight', 'flights', 'airfare', 'plane ticket', 'plane tickets', 'airline', 'airlines'],
  hotels_direct: ['hotel', 'hotels', 'motel', 'lodging', 'stay'],
  streaming: ['streaming', 'netflix', 'spotify', 'hulu', 'disney', 'subscription', 'subscriptions'],
  online_retail: ['online', 'online shopping', 'amazon', 'shopping'],
  wholesale: ['costco', 'sams club', 'bjs', 'warehouse', 'wholesale', 'bulk'],
  everything_else: ['everything else', 'anything else', 'something else', 'other', 'general', 'random'],
}

const esc = (s) => String(s ?? '').replace(/[\t\n\r]/g, ' ').trim()

export function buildSiriSnapshot(state) {
  const owner = state.settings.quickPicksOwner ?? 'all'
  const scoped = { ownerFilter: owner, ignoreCashbackFilter: true }
  const lines = [
    '# CC Hub — spoken answers for Siri.',
    '# Generated ' + new Date().toLocaleString() + '. Re-export when your cards or',
    '# quarterly categories change. Format: tab-separated, read by cc-card.',
    ['V', '1', currentQuarterLabel()].join('\t'),
  ]

  // Merchant exceptions first — they override the general category answer.
  for (const rule of state.merchantRules) {
    const ranked = rankCardsForCategory(state, rule.categoryId, {
      ...scoped,
      excludeCardIds: rule.excludedCardIds,
    })
    if (!ranked[0]) continue
    const id = `merchant_${rule.id}`
    lines.push(['A', id, esc(rule.name), esc(cardTitle(ranked[0].card)), esc(ranked[0].multiplier + 'x'), ''].join('\t'))
    lines.push(['X', esc(rule.name).toLowerCase(), id].join('\t'))
  }

  for (const step of FLOW) {
    const ranked = rankCardsForCategory(state, step.categoryId, scoped)
    const winner = ranked[0]
    if (!winner) continue

    // Amex acceptance is patchy enough that the spoken answer should carry the
    // backup, otherwise you're stuck at the register with no second option.
    const backup = winner.card.issuer === 'Amex' ? ranked.find((r) => r.card.issuer !== 'Amex') : null
    const fallback = backup ? `If they don't take Amex, use the ${cardTitle(backup.card)}.` : ''

    lines.push(
      ['A', step.categoryId, esc(step.label), esc(cardTitle(winner.card)), esc(winner.multiplier + 'x'), esc(fallback)].join('\t'),
    )

    for (const alias of ALIASES[step.categoryId] ?? []) {
      lines.push(['X', alias, step.categoryId].join('\t'))
    }
    // The category's own label is a valid thing to say too.
    lines.push(['X', esc(step.label).toLowerCase(), step.categoryId].join('\t'))
    const short = CATEGORY_BY_ID[step.categoryId]?.label?.toLowerCase()
    if (short) lines.push(['X', esc(short), step.categoryId].join('\t'))
  }

  return lines.join('\n') + '\n'
}

export function downloadSiriSnapshot(state) {
  const blob = new Blob([buildSiriSnapshot(state)], { type: 'text/tab-separated-values' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'answers.tsv'
  a.click()
  URL.revokeObjectURL(url)
}
