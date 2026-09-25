# MarketQuest

A mobile-first learning app that teaches how trading works using **virtual money only**. No real trades happen, nothing connects to a brokerage, and there are no accounts, analytics or paid services. Everything runs in the browser and saves locally.

- **Learn:** 10 units, 40 lessons (30 lessons plus 10 checkpoints), one idea per screen, tappable glossary terms, and feedback that names the misunderstanding.
- **Practice:** Candle Lab, Chart Detective, Order Lab, Risk Builder and Decision Scenarios, plus a rules-based review queue.
- **Simulator:** $1,000 of virtual money, three fictional companies, six seeded synthetic scenarios, market, limit, stop and take-profit orders, spread, slippage and fees.
- **Journal:** entries are created automatically, with R-multiples, replay and reflections.
- Works offline once loaded (installable PWA).

The app name comes from `VITE_APP_NAME` in `.env`.

Live: https://marketquest-sigma.vercel.app

## Run locally

Requires Node 20.19+ (tested with Node 22).

```bash
npm install
npm run dev          # http://localhost:5173
```

Production build and local preview (the service worker only runs in this mode):

```bash
npm run build
npm run preview      # http://localhost:4173
```

## Checks

```bash
npm run typecheck          # TypeScript, app and tooling projects
npm run lint               # ESLint, including React Hooks rules
npm test                   # Vitest unit tests (domain, grading, simulator, storage, content, contrast)
npm run validate:content   # curriculum rules only: word limits, sources, solvability
npm run build
npm run e2e                # Playwright journeys against the preview build (run `npm run build` first)
```

To run the journeys against a deployed site instead, set `E2E_BASE_URL`, for example `E2E_BASE_URL=https://marketquest-sigma.vercel.app npm run e2e`.

Playwright uses the Chrome at `/usr/local/bin/google-chrome` if present, otherwise set `CHROME_PATH` or run `npx playwright install chromium`.

Screenshots at 360, 390, 768 and 1440px plus enlarged text:

```bash
SCREENSHOT_DIR=./screenshots npx playwright test e2e/screenshots.spec.ts
```

App icons are rendered from `public/favicon.svg` with `npm run icons`.

## Deploy

The output in `dist/` is a static site. Any static host works as long as unknown paths fall back to `index.html`:

- **Vercel:** `vercel.json` sets the build command, output directory, SPA rewrite and service-worker cache headers. Import the repository, or run `vercel` then `vercel --prod`.
- **Netlify / Cloudflare Pages:** build command `npm run build`, publish directory `dist`. `public/_redirects` provides the SPA fallback.
- **Sub-path hosting:** set `VITE_BASE_PATH=/your-path/` at build time.

Serve `sw.js` with `Cache-Control: no-cache` so updates are detected. When a new version is deployed, open tabs show "A new version is ready" and update only when the learner chooses to.

## Data and privacy

Progress, the simulator run and the journal are stored in IndexedDB in the learner's browser. Settings can export a JSON backup and import it (merge or replace). Resetting the simulator never erases learning progress. If storage is blocked, the app keeps working in memory and says so.

## Project layout

```
src/
  content/      curriculum, glossary, sources (zod-validated)
  domain/       money in integer cents, candles, position sizing
  engine/       grading, progress and review rules, order lab
  sim/          synthetic scenarios, order engine, journal
  storage/      IndexedDB, migrations, backup
  state/        app actions, achievements
  components/   shell, charts, feedback, dialogs
  exercises/    exercise inputs and the shared exercise view
  screens/      routes
e2e/            Playwright journeys and screenshot capture
```

Design decisions are in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). Build progress and verification results are in [BUILD_STATUS.md](BUILD_STATUS.md).

MarketQuest is for education only and is not financial, investment, legal or tax advice.
