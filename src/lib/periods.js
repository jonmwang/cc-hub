// Works out which window a recurring credit is currently in, so the tracker can
// reset itself. Each window gets a stable `key`; when the key a credit was
// checked off under stops matching the current key, the credit is simply
// un-checked. No cron, no cleanup pass — it falls out of the comparison.

const DAY = 86400000
const FOUR_YEARS_MS = 4 * 365.25 * DAY

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
      return build(`${y}-${pad(now.getMonth() + 1)}`, start, end, now, `${MONTH_NAMES[now.getMonth()]} ${y}`)
    }

    case 'quarterly': {
      const q = Math.floor(now.getMonth() / 3)
      const start = new Date(y, q * 3, 1)
      const end = new Date(y, q * 3 + 3, 0, 23, 59, 59)
      return build(`${y}-Q${q + 1}`, start, end, now, `Q${q + 1} ${y}`)
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
      return build(`${y}-H${half}`, start, end, now, half === 1 ? `Jan–Jun ${y}` : `Jul–Dec ${y}`)
    }

    case 'annual': {
      const start = new Date(y, 0, 1)
      const end = new Date(y, 12, 0, 23, 59, 59)
      return build(`${y}`, start, end, now, `${y}`)
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
        ...build(`anniv-${start.toISOString().slice(0, 10)}`, start, end, now, `Card year to ${fmtLong(end)}`),
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

function build(key, start, end, now, label) {
  const total = end - start
  const elapsed = Math.min(Math.max(now - start, 0), total)
  const daysLeft = Math.max(0, Math.ceil((end - now) / DAY))
  return {
    key,
    start,
    end,
    now,
    active: true,
    status: 'ok',
    label,
    window: `${fmt(start)} – ${fmt(end)}`,
    daysLeft,
    totalDays: Math.round(total / DAY),
    progress: total > 0 ? elapsed / total : 0,
  }
}

const pad = (n) => String(n).padStart(2, '0')

function parseISO(iso) {
  const [yy, mm, dd] = iso.split('-').map(Number)
  return new Date(yy, mm - 1, dd)
}

// Green while there's plenty of runway, amber past halfway, red at the end.
// Driven by how far through the window you are rather than raw days, so a
// monthly credit isn't screaming on day 10 just because "21 days left" sounds
// short. Absolute day counts only take over on long windows, where a fixed
// deadline matters more than the fraction elapsed.
export function urgencyFor(info) {
  const { progress = 0, daysLeft = 0, totalDays = 0 } = info ?? {}
  if (daysLeft === Infinity) return 'fresh'

  let level = 'fresh'
  if (progress >= 0.9) level = 'critical'
  else if (progress >= 0.72) level = 'warning'
  else if (progress >= 0.45) level = 'mid'

  if (totalDays > 90) {
    if (daysLeft <= 14) level = 'critical'
    else if (daysLeft <= 30 && level === 'fresh') level = 'mid'
  }

  return level
}

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
