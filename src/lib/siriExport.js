import { CATEGORY_BY_ID } from '../data/categories'
import { rankCardsForCategory, soleHolderName } from './ranking'
import { creditPlanFor } from './credits'
import { CREDIT_MERCHANTS } from '../data/merchants'
import { currentQuarterLabel } from './periods'
import { cardTitle, isPlaceholderName, possessive } from '../components/ui'

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
  // 'doordash' and 'uber eats' deliberately absent: they have their own
  // credit-aware rows above, and the matcher lets a later alias overwrite an
  // earlier one — leaving them here would silently bury the credit answer
  // under the plain dining answer.
  dining: ['restaurant', 'restaurants', 'dinner', 'lunch', 'breakfast', 'brunch', 'food', 'takeout', 'take out', 'eating out', 'dining', 'delivery', 'bar', 'drinks', 'cafe', 'coffee'],
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

/**
 * @param state
 * @param opts.ownerFilter  'all' | personId.
 *
 * 'all' is the right default for a household that pools its cards: narrowing to
 * one person's own cards would hide the better card sitting in the same house,
 * which is worse advice, not safer advice. What a shared sheet does need is
 * ATTRIBUTION — "Jonathan's Amex Gold", not "Amex Gold" — so the reader knows which
 * physical card to reach for. See soleHolderName().
 *
 * The per-person sheets stay published for the case where the reader genuinely
 * cannot use the other person's cards.
 */
export function buildSiriSnapshot(state, opts = {}) {
  const owner = opts.ownerFilter ?? state.settings.quickPicksOwner ?? 'all'
  const scoped = { ownerFilter: owner, ignoreCashbackFilter: true }

  // Only the household sheet names whose card it is. On a person-scoped sheet
  // every card already belongs to the reader, so a name there is just noise —
  // and reads wrong out loud: "use Alexis' Savor" spoken to Alexis.
  const attribute = owner === 'all' && state.people.length > 1

  // Naming the holder is a nicety, not the job — the job is naming the right
  // card, and the household sheet does that whoever is reading. So attribution
  // only appears once both people have real names in Settings. On the defaults
  // it would be noise at best ("Partner's Savor") and a lie at worst, since
  // possessive() renders "Me" as "your" and the other reader is not you.
  const nameOf = (cardId) => {
    const name = attribute ? soleHolderName(state, cardId) : null
    return isPlaceholderName(name) ? null : name
  }
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

  // Credit-linked merchants, before the plain categories. At these places the
  // earn rate does not decide — an unclaimed credit is worth far more than the
  // multiplier gap — so the spoken answer has to name the credit card and say
  // what to switch to once it's spent.
  for (const m of CREDIT_MERCHANTS) {
    const plan = creditPlanFor(state, m.id, scoped)
    if (!plan?.hasAnyCredits) continue

    const top = plan.unclaimed[0]
    const id = `credit_${m.id}`

    if (top) {
      // Not whose(): a credit belongs to one specific wallet entry even when
      // both people carry that card, so name the entry's owner directly.
      const holderName = attribute ? state.people.find((p) => p.id === top.ownerId)?.name : null
      const holder = isPlaceholderName(holderName) ? null : holderName
      // "your" is only safe on a person-scoped sheet, where the reader owns
      // every card on it. On the household sheet, fall back to the bare card
      // name rather than claiming it belongs to whoever happens to be asking.
      const card = holder
        ? `${possessive(holder)} ${cardTitle(top.card)}`
        : `${attribute ? 'the' : 'your'} ${cardTitle(top.card)}`
      const after =
        plan.earnWinner && plan.earnWinner.card.id !== top.card.id
          ? `That captures $${top.value} of credit. Once it's used this period, the ${cardTitle(plan.earnWinner.card)} earns more.`
          : `That captures $${top.value} of credit.`
      lines.push(['A', id, esc(m.name), esc(card), esc(top.multiplier + 'x'), esc(after)].join('\t'))
    } else if (plan.earnWinner) {
      lines.push([
        'A', id, esc(m.name), esc(cardTitle(plan.earnWinner.card)),
        esc(plan.earnWinner.multiplier + 'x'),
        esc(`${m.name} credits are all used this period, so this is purely earn rate.`),
      ].join('\t'))
    } else {
      continue
    }

    for (const alias of m.aliases) lines.push(['X', alias, id].join('\t'))
  }

  for (const step of FLOW) {
    const ranked = rankCardsForCategory(state, step.categoryId, scoped)
    const winner = ranked[0]
    if (!winner) continue

    // Amex acceptance is patchy enough that the spoken answer should carry the
    // backup, otherwise you're stuck at the register with no second option.
    const backup = winner.card.issuer === 'Amex' ? ranked.find((r) => r.card.issuer !== 'Amex') : null
    const backupHolder = backup ? nameOf(backup.card.id) : null
    const fallback = backup
      ? `If they don't take Amex, use ${backupHolder ? `${possessive(backupHolder)} ` : 'the '}${cardTitle(backup.card)}.`
      : ''

    // Name whose card it is when only one of you holds it. A household that
    // shares cards still has to find the physical thing, and "Amex Gold" is a
    // card that lives in exactly one wallet.
    const holder = nameOf(winner.card.id)
    const cardLabel = holder ? `${possessive(holder)} ${cardTitle(winner.card)}` : cardTitle(winner.card)

    lines.push(
      ['A', step.categoryId, esc(step.label), esc(cardLabel), esc(winner.multiplier + 'x'), esc(fallback)].join('\t'),
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
