// Works out which window a recurring credit is currently in, so the tracker can
// reset itself. Each window gets a stable `key`; when the key a credit was
// checked off under stops matching the current key, the credit is simply
// un-checked. No cron, no cleanup pass — it falls out of the comparison.

const DAY = 86400000
const FOUR_YEARS_MS = 4 * 365.25 * DAY

// Credits do not reliably post on the last day of their window. Amex's monthly
// dining credit is the classic example — spend on the 31st and it can land in
// the next statement period, so the credit is simply lost. Every window is
// therefore treated as ending this many days early, and that earlier date is
// what the app shows and colours against.
const SAFETY_DAYS = {
  monthly: 3,
  quarterly: 5,
  semiannual: 7,
  annual: 7,
  anniversary: 7,
  every4years: 30,
}

export const safetyDaysFor = (period) => SAFETY_DAYS[period] ?? 3

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const fmt = (d) => `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`
const fmtLong = (d) => `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`

/**
 * @param credit  a credit entry from the card catalog
 * @param openDate  ISO 'YYYY-MM-DD' the card was opened, or null
 * @param usedAt  ISO timestamp of when it was last marked used (every4years only)
 * @param now  Date
 */
export function getPeriodInfo(credit, openDate, usedAt, now = new Date()) {
  const y = now.getFullYear()

  switch (credit.period) {
    case 'monthly': {
      const start = new Date(y, now.getMonth(), 1)
      const end = new Date(y, now.getMonth() + 1, 0, 23, 59, 59)
      return build(`${y}-${pad(now.getMonth() + 1)}`, start, end, now, `${MONTH_NAMES[now.getMonth()]} ${y}`, 'monthly')
    }

    case 'quarterly': {
      const q = Math.floor(now.getMonth() / 3)
      const start = new Date(y, q * 3, 1)
      const end = new Date(y, q * 3 + 3, 0, 23, 59, 59)
      return build(`${y}-Q${q + 1}`, start, end, now, `Q${q + 1} ${y}`, 'quarterly')
    }

    case 'semiannual': {
      const currentHalf = now.getMonth() < 6 ? 1 : 2
      const half = credit.half ?? currentHalf

      if (half !== currentHalf) {
        // This half's window isn't open right now.
        const isPast = half < currentHalf
        const start = new Date(y, half === 1 ? 0 : 6, 1)
        const end = new Date(y, half === 1 ? 6 : 12, 0, 23, 59, 59)
        return {
          key: `${y}-H${half}`,
          start,
          end,
          now,
          active: false,
          status: isPast ? 'closed' : 'upcoming',
          label: half === 1 ? `Jan–Jun ${y}` : `Jul–Dec ${y}`,
          window: `${fmt(start)} – ${fmt(end)}`,
          daysLeft: 0,
          progress: isPast ? 1 : 0,
        }
      }

      const start = new Date(y, half === 1 ? 0 : 6, 1)
      const end = new Date(y, half === 1 ? 6 : 12, 0, 23, 59, 59)
      return build(`${y}-H${half}`, start, end, now, half === 1 ? `Jan–Jun ${y}` : `Jul–Dec ${y}`, 'semiannual')
    }

    case 'annual': {
      const start = new Date(y, 0, 1)
      const end = new Date(y, 12, 0, 23, 59, 59)
      return build(`${y}`, start, end, now, `${y}`, 'annual')
    }

    case 'anniversary': {
      if (!openDate) {
        return {
          key: 'no-open-date',
          active: false,
          status: 'needs-date',
          label: 'Card open date needed',
          window: '—',
          daysLeft: 0,
          progress: 0,
          now,
        }
      }
      const open = parseISO(openDate)
      // Most recent anniversary that has already happened.
      let start = new Date(y, open.getMonth(), open.getDate())
      if (start > now) start = new Date(y - 1, open.getMonth(), open.getDate())
      const end = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate() - 1, 23, 59, 59)
      return {
        ...build(`anniv-${start.toISOString().slice(0, 10)}`, start, end, now, `Card year to ${fmtLong(end)}`, 'anniversary'),
        window: `${fmtLong(start)} – ${fmtLong(end)}`,
      }
    }

    case 'every4years': {
      // Not calendar-driven: the clock starts when you actually use it.
      if (!usedAt) {
        return {
          key: 'every4years',
          active: true,
          status: 'available',
          label: 'Available now',
          window: 'Resets 4 years after you use it',
          daysLeft: Infinity,
          progress: 0,
          now,
        }
      }
      const used = new Date(usedAt)
      const end = new Date(used.getTime() + FOUR_YEARS_MS)
      if (now >= end) {
        return {
          key: 'every4years',
          active: true,
          status: 'available',
          label: 'Available again',
          window: 'Resets 4 years after you use it',
          daysLeft: Infinity,
          progress: 0,
          now,
        }
      }
      return {
        key: 'every4years',
        start: used,
        end,
        now,
        active: true,
        status: 'ok',
        label: `Next available ${fmtLong(end)}`,
        window: `Used ${fmtLong(used)}`,
        daysLeft: Math.ceil((end - now) / DAY),
        progress: (now - used) / (end - used),
      }
    }

    default:
      return { key: 'none', active: true, status: 'ok', label: '', window: '', daysLeft: 0, progress: 0, now }
  }
}

function build(key, start, end, now, label, period) {
  const total = end - start
  const elapsed = Math.min(Math.max(now - start, 0), total)
  const daysLeft = Math.max(0, Math.ceil((end - now) / DAY))

  // The date you should actually have spent by, not the date the window shuts.
  const safety = safetyDaysFor(period)
  const useBy = new Date(end.getTime() - safety * DAY)
  const daysToUse = Math.ceil((useBy - now) / DAY)

  return {
    key,
    start,
    end,
    now,
    period,
    active: true,
    status: 'ok',
    label,
    window: `${fmt(start)} – ${fmt(end)}`,
    daysLeft,
    totalDays: Math.round(total / DAY),
    progress: total > 0 ? elapsed / total : 0,
    safetyDays: safety,
    useBy,
    useByLabel: fmt(useBy),
    daysToUse,
    // True once you're inside the buffer: still technically claimable, but late
    // enough that the credit may not post in this window.
    inDangerZone: daysToUse <= 0,
  }
}

const pad = (n) => String(n).padStart(2, '0')

function parseISO(iso) {
  const [yy, mm, dd] = iso.split('-').map(Number)
  return new Date(yy, mm - 1, dd)
}

// Colour is driven by days remaining until the SAFE deadline, not the raw
// window end — so a monthly credit turns red with about a week of real time
// left, not on the 29th when spending may no longer post in time.
//
// Thresholds scale with the window so one rule covers monthly through annual:
//   critical  <= max(4 days, 12% of the window)
//   warning   <= max(12 days, 28% of the window)
//
// For a 30-day month that's red from ~6 days out and amber from ~14. For a
// calendar year, red from ~6 weeks out and amber from ~14.
export function urgencyFor(info) {
  const { daysToUse, daysLeft = 0, totalDays = 0 } = info ?? {}
  if (daysLeft === Infinity) return 'fresh'

  const remaining = daysToUse ?? daysLeft
  if (remaining <= 0) return 'critical' // inside the buffer, or past it

  const criticalAt = Math.max(4, totalDays * 0.12)
  const warningAt = Math.max(12, totalDays * 0.28)

  if (remaining <= criticalAt) return 'critical'
  if (remaining <= warningAt) return 'warning'
  if (remaining <= totalDays * 0.55) return 'mid'
  return 'fresh'
}

// One definition, used by both the tracker and the home page, so "expiring
// soon" means the same thing everywhere.
export const EXPIRING_SOON_LABEL = 'Past its safe-to-use date, or close to it'
export const isExpiringSoon = (info) => urgencyFor(info) === 'critical'

export function currentQuarterKey(now = new Date()) {
  return `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`
}

export function currentQuarterLabel(now = new Date()) {
  return `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`
}

// Annualised face value of a credit, for the fee calculator.
export function occurrencesPerYear(period) {
  switch (period) {
    case 'monthly':
      return 12
    case 'quarterly':
      return 4
    case 'semiannual':
      return 1 // each half is stored as its own credit entry
    case 'annual':
    case 'anniversary':
      return 1
    case 'every4years':
      return 0.25
    default:
      return 1
  }
}
