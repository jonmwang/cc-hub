# CC Hub

A private dashboard for tracking household credit cards: earn multipliers, which card to
use for a given purchase, effective annual fees after credits, and which credits are still
unused this period.

## The pages

| Page | What it's for |
|---|---|
| **My Cards** | Every card in the household with its multipliers, colour-coded by who holds it. |
| **Quick Picks** | Read-only, top-to-bottom "buying X → use Y". Nothing to configure. Built for the person who doesn't want to think about this. |
| **Which Card?** | The full tool. Pick a category, re-rank by what you value each currency at, edit quarterly categories and merchant quirks. |
| **Fee Calculator** | Annual fee minus what the credits are actually worth *to you*, per card. |
| **Credit Tracker** | Check off credits as you use them; windows reset themselves. |

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
- **Backup file** — download a JSON file, restore it on another machine.

When you want genuine live sync, see `REMOTE_ADAPTER_NOTES.md`. The app was structured for
it: one file changes.

## Keeping the card data accurate

`src/data/cards.js` is the single source of truth for multipliers, annual fees, and
credits. Issuers change these constantly — especially Amex Platinum. Edit that file when
something moves; every page reads from it.

Only cards flagged `rotating: true` (Freedom Flex, Discover it) expose editable quarterly
categories in the UI. Every other card's rates are fixed in code on purpose, so nothing
incorrect can be entered by accident.

Rates were verified against the issuers' own product pages in September 2026.

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
