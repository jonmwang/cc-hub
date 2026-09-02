# CC Hub

A private dashboard for tracking household credit cards: earn multipliers, which card to
use for a given purchase, effective annual fees after credits, and which credits are still
unused this period.

## The pages

| Page | What it's for |
|---|---|
| **Home** | Spacious landing page: household totals and one big button through to Quick Picks. No detail. |
| **Quick Picks** | The flow chart. Top-to-bottom "buying X → use Y", collapsed by default. Built for the person who doesn't want to think about this. |
| **My Cards** | Every card in the household with its multipliers, colour-coded by who holds it. |
| **Which Card?** | The full tool. Pick a category, re-rank by what you value each currency at, edit quarterly categories and merchant quirks. |
| **Fee Calculator** | Annual fee minus what the credits are actually worth *to you*, per card. |
| **Credit Tracker** | Check off credits as you use them; windows reset themselves. |

### Credit deadlines have a safety buffer

Credits do not reliably post on the last day of their window — Amex's monthly dining credit
is the usual casualty. Every window is therefore treated as ending early (3 days for monthly,
5 for quarterly, 7 for longer), and that earlier **use by** date is what the app displays and
colours against. "Expiring soon" means past that date or close to it, never "the window shuts
tomorrow". Spending inside the buffer is flagged as a danger zone rather than shown as fine.

### Face value vs. what it's worth to you

The tracker shows each credit at its **face value** — the number the issuer advertises and the
one that reconciles against a statement. Your own valuation appears underneath only when it
differs, so an entry reads `$500` with `$300 to you` rather than silently showing `$300` and
leaving you wondering why it doesn't match Chase's site. Both totals are tracked for the year:
each claim records `face` and `value`, and the tracker heads the page with both.

### Closed windows can be ticked retroactively

A semiannual window that has already shut still offers **Mark used anyway**, behind an inline
confirmation naming the date it closed — you may well have claimed the credit before you
started using this app. Because `creditsUsed` only ever describes the current window, the
used-state of a closed window is read from the log instead.

### Home page numbers are actuals, not projections

`creditsUsed` only ever holds the current window, so it cannot answer "how much have I clawed
back this year" — a monthly credit used in March is invisible to it by April. An append-only
`creditsLog` records each claim, and the home page reads **Recovered so far** from that.
**Still claimable** counts only unused credits whose window is open right now.

**Quick Picks and Which Card? read the same data.** Change a quarterly bonus category or a
merchant quirk on Which Card?, and Quick Picks updates immediately — there is no second
copy to keep in sync.

Built to be hosted for free as a static site. No server, no accounts, no personal data in
the repo.

## Running locally

```bash
npm install
npm run dev
```

## Deploying

The site is a static bundle with a relative `base` and hash-based routing, so it works
unchanged on any static host with no rewrite rules to configure.

### GitHub Pages (recommended — free, already wired up)

1. Create an empty repo on GitHub and push this folder to `main`.
2. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Done. `.github/workflows/deploy.yml` builds and publishes on every push to `main`.

Your site lands at `https://<username>.github.io/<repo-name>/`.

Making the repo private also works — GitHub Pages can serve from private repos on paid
plans, but note that **the site itself is public either way**. That is fine here: no
personal data is committed, it all lives in each visitor's browser.

### Alternatives, if you'd rather not use GitHub

- **Netlify** — drag the `dist/` folder onto app.netlify.com/drop. Nothing to configure.
- **Cloudflare Pages / Vercel** — point at the repo, build command `npm run build`,
  output directory `dist`.

### Manual publish from your machine

```bash
npm run deploy
```

Builds and pushes `dist/` to a `gh-pages` branch via the `gh-pages` package. Only needed
if you skip the Actions workflow above.

## How the data works

Everything you enter — your wallet, point valuations, quarterly categories, credit values,
and what you've used — is stored in your browser's `localStorage`. It never leaves your
device.

That has one consequence worth understanding: **your browser and your partner's browser
each hold their own copy.** Two ways to bridge that today, both on the
*Settings & Sharing* page:

- **Share link** — packs your entire setup into a URL. Whoever opens it gets a copy saved
  to their own browser. Great for handing over a ready-made starting point; it is a
  snapshot, not a live feed, so send a fresh link when you want to push an update.

  The payload is field-shortened and deflated before base64 encoding, which takes a
  realistic setup from ~2,400 characters down to ~750. That matters: messaging apps stop
  auto-linking somewhere around 2,000 characters, and a link that breaks mid-string arrives
  as a dead half-link with a stray `=...` after it. The link also applies when pasted into
  an already-open tab, not just on a fresh load.
- **Backup file** — download a JSON file, restore it on another machine.

When you want genuine live sync, see `REMOTE_ADAPTER_NOTES.md`. The app was structured for
it: one file changes.

## Cache busting

GitHub Pages serves `index.html` with `cache-control: max-age=600`. Asset filenames are
content-hashed, so a stale HTML copy loads a perfectly valid but out-of-date app — no error,
nothing visibly wrong, just old. The only manual cure is a hard refresh, which is not something
you can ask a non-technical person to know about.

So the app checks for itself. Each build stamps a `buildId` into the bundle and writes the same
id to `dist/version.json`. The running app fetches that file with `cache: 'no-store'` on load,
whenever the tab regains focus, and every 15 minutes; if the ids differ, a banner offers a
reload (which appends a `?v=` param so the reload can't be served from cache either).

The current build id is shown on the Settings page, next to a Force reload button.

## Keeping the card data accurate

`src/data/cards.js` is the single source of truth for multipliers, annual fees, and
credits. Issuers change these constantly — especially Amex Platinum. Edit that file when
something moves; every page reads from it.

Only cards flagged `rotating: true` (Freedom Flex, Discover it) expose editable quarterly
categories in the UI. Every other card's rates are fixed in code on purpose, so nothing
incorrect can be entered by accident.

A rotating pick adds `rotatingBonus` (4) **on top of** the card's standing rate rather than
replacing it. On a plain category that produces the advertised 5%; on the Freedom Flex's
dining or drugstores, already 3x, a quarterly pick makes it **7x**. Modelling that as a flat
5x is the obvious mistake and it costs two points per dollar.

Rates were verified against the issuers' own product pages in September 2026.

### How Quick Picks orders itself

It's a funnel, not a list. Steps are ordered by how often you actually buy the thing —
groceries and food at the top, travel near the bottom. Then two rules tidy it up:

Ranking ties break toward the **more premium card** (higher annual fee) before falling back to
alphabetical. Identical earn rates are common — Sapphire Preferred and Reserve both pay 3x on
dining — and the premium card is the better one to put a large tab on, since credit lines run
higher. Without that rule the Reserve sorted below both Freedom cards.

- **Adjacent steps that land on the same card merge into one line**, so you get
  "Streaming, Rideshare & Transit → Sapphire Preferred" instead of three near-identical rows.
- **A step whose best answer is just the catch-all card at the catch-all rate gets pushed to
  the bottom** and folded into "everything else". That's what stops a 2x generalist like the
  Venture X from appearing above a 5x specialist like the Platinum.

A step can set `pin: true` to opt out of that second rule. Walmart & Target does, because the
whole point of that line is warning you off the grocery card — it has to sit under Groceries
even though its answer is the default.

### Card art

`public/cards/*.webp` holds a real photo per card, referenced from `src/data/cardArt.js`.
Those are the issuers' copyrighted images — fine for a private dashboard, but don't advertise
the site publicly. Every entry also keeps a stylised colour/finish fallback underneath, used
for any card without a photo; delete an `image:` line to see it.

To swap or add a photo, drop the original into `card images/` and re-run:

```bash
python3 scripts/prep_card_images.py
```

Source images arrive in mixed formats, sizes, and aspect ratios, often with a white margin
baked around a card that already has rounded corners — which renders as an ugly border. The
script trims that margin, cover-crops to the real 1.586 card ratio so every card matches,
cuts the corners into the alpha channel, and writes WebP. Because the corners are transparent,
the page uses `filter: drop-shadow` rather than `box-shadow`, so the shadow hugs the card
instead of drawing a rectangle behind it. It needs Pillow (`pip install pillow`).

**Merchant quirks** are the escape hatch for stores that ring up as the wrong category —
the Which Card? sidebar lets you name a place, pin the category it actually codes as, and
knock out the cards that don't earn the bonus there. Joymart is seeded as an example.

## Project layout

```
src/
  data/
    cards.js        card catalog — multipliers, fees, credits
    categories.js   spend categories the ranking page offers
    currencies.js   point currencies and default valuations
  lib/
    storage.js      persistence adapters + share links   ← swap this for sync
    periods.js      credit reset windows and urgency
    ranking.js      the "which card wins" math
  pages/            one file per tab
  store/            app state, backed by the storage adapter
```
