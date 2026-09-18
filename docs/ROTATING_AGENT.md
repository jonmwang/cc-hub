# Rotating-categories agent

A scheduled Claude Code routine that checks Chase and Discover for the **next**
quarter's 5% categories and proposes them as a pull request against
`src/data/rotatingCalendar.js`. Merged entries switch on by themselves on the
first day of their quarter, so nothing has to happen on the day itself.

## When it runs

At 14:00 UTC on the 1st, 16th and 23rd of March, June, September and December.

- **1st:** usually catches Discover, which publishes early (often the whole year).
- **16th:** Chase usually announces on the 15th of the month before the quarter.
- **23rd:** a retry in case either one was late.

If both cards already have entries for the next quarter, the run stops
without changing anything.

## Instructions for the agent

1. Work out the next quarter key (`YYYY-QN`) from today's date. Read
   `src/data/rotatingCalendar.js`. If both `chase_freedom_flex` and
   `discover_it` already have that quarter, stop. Report "already up to date".

2. Only use **official issuer pages** as the source:
   - Chase: `media.chase.com` (announcement slugs look like
     `chase-freedom-YYYY-qN-categories`) or the Freedom calendar on
     `chase.com` / `creditcards.chase.com`.
   - Discover: `https://www.discover.com/credit-cards/cashback-bonus/cashback-calendar.html`.

   Blogs and forums can tell you an announcement is out, but never use them
   as the source. If the official page doesn't list the quarter yet, skip that
   card and say so.

3. Map every announced category to an id in `src/data/categories.js`, as
   narrowly as the announcement is worded:
   - "American Red Cross" is `red_cross`, not charity in general.
   - "Grocery stores, excluding Walmart and Target" is `groceries`. Walmart
     and Target already have their own `superstores` id.
   - "Restaurants" / "dining" is `dining`.
   - When nothing fits, add a new category. Mark it `seasonal: true` if it only
     makes sense as a rotating bonus. Also add its id to `ROTATING_CHOICES` in
     `src/pages/WhichCard.jsx`.
   - Never fold a category into a broader existing one. That would recommend
     the card for purchases that don't earn the bonus.

4. Add the quarter under each card with `categories`, the exact `source` URL
   you read, and a one-line `note` in the issuer's own wording (include the
   spend cap). Don't touch past or current quarters.

5. Run `npm ci && npm run build`. It must pass.

6. Open a pull request from a branch named `rotating/YYYY-QN`. In the
   description, include:
   - the announcement text for each card, quoted from the official page
   - a table mapping each announced category to the id you picked
   - anything you weren't sure about

   **Don't merge it and don't push to `main`.** A human checks the mapping.

7. If you added anything to Siri's `ALIASES` in `src/lib/siriExport.js` for a new
   category, mention it in the PR.
