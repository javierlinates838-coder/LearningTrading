# Build status

Last updated 2026-09-25. Every result below comes from a command run in this repository on that date. Nothing is estimated.

## Verification results

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | Pass, 0 errors |
| Lint | `npm run lint` (ESLint + React Hooks recommended rules) | Pass, 0 errors, 0 warnings |
| Unit tests | `npm test` | **97 passed** in 7 files: simulator engine 22, content 17, contrast 16, storage 13, progress and review rules 12, grading and order lab 9, domain maths 8 |
| Content validation | `npm run validate:content` | **17 passed**: schema, word limits, sources on factual lessons, rubrics on interpretive items, glossary links, and a brute-force check that every item is solvable |
| Production build | `npm run build` | Pass. Main chunk 128 KB gzip; content chunk 79 KB gzip; screens lazy-loaded. Service worker precaches 29 files (≈987 KiB) |
| Browser journeys | `npm run e2e` (Playwright 1.63, Chrome, production preview) | **7 passed** on two consecutive runs |
| Screenshots | `SCREENSHOT_DIR=… npx playwright test e2e/screenshots.spec.ts` | 5 passed, 43 images: 10 screens at each of 360, 390, 768 and 1440px, plus 3 at 390px with 130% text. Reviewed by eye; issues found were fixed (below) |

### Browser journeys

1. **Fresh learner:** onboarding (3 steps, "Start from zero" preselected, virtual-money notice, storage note), a tappable glossary term, first lesson, +20 XP, the "First step" achievement, sources disclosure, back to the pathway showing the next lesson.
2. **Returning learner:** answer, advance, leave, reload; "Continue where you left off" resumes at the same step.
3. **Wrong-answer recovery:** Continue is disabled, a wrong answer names the misconception ("the gain") and receives focus, editing clears it, the retry is correct, the fix earns XP, and a review appears in Practice.
4. **Completed simulated trade:** start a run, buy 5 shares with a stop, fill on the next quote, sell at market, automatic journal entry, R shown, reflection validation, then the reflection saves with XP. Resetting the simulator keeps the journal and XP.
5. **Offline return:** after the service worker takes control, going offline shows the offline banner; full page loads with the network cut are served from cache, and saved progress is still there.
6. **Backup:** export a file, erase everything (returns to onboarding), import it with Replace, progress is restored; a non-backup JSON file is rejected with a clear message.
7. **404:** an unknown URL shows a helpful not-found page.

Playwright's offline emulation reports `navigator.onLine` as `true` on documents served by the service worker, so the offline banner is asserted on a page that was already loaded, and offline loading is asserted separately.

## Not verified

- **Lighthouse / axe:** not run. Accessibility was checked through semantic structure in the tests (roles, labels, focus), the automated contrast test, and screenshot review. No score is claimed.
- **Real devices and screen readers:** not tested. Only Chrome desktop was used, at mobile viewport sizes.
- **Firefox and Safari:** not tested.
- **Deployment:** no preview deploy was made. The Vercel connection available in this environment was not authorized, and no deploy token was present. `vercel.json` and `public/_redirects` are ready.
- **Source links:** 9 sources were checked on 2026-09-25 while writing the curriculum. They were not re-checked automatically in this build.

## Issues found in review and fixed

- Glossary terms were shown with their title capitalization mid-sentence ("A Share is…"); they now read as ordinary words except at sentence start and for acronyms.
- Lesson steps after the first had no `h1`; every step now has one.
- Programmatically focused headings showed a heavy focus ring; the ring is now reserved for controls.
- The four-cell quote strip wrapped 3 + 1 at 360px; it is now 2 × 2 on narrow screens.
- A new simulator run showed one candle, which gave the chart no context; runs now open with 6 candles of warm-up history. Orders still only fill on quotes that arrive after they are placed.
- The bottom navigation showed during onboarding; onboarding now uses focus mode.
- Practice lab icons used the mastery colour; they now use the accent colour.
- Import and "Erase everything" reported success before the write was saved; they now wait for the write and report a storage failure if one occurs.
- Reloading within milliseconds of finishing a lesson could leave it on the recap without being marked complete; the app now repairs this at startup.

## Spec checklist

| Area | Status |
| --- | --- |
| Configurable name (`VITE_APP_NAME`) | Done |
| UI UX Pro Max run and recorded | Done (`DESIGN_SYSTEM.md`, `docs/ui-ux-pro-max/`) |
| Dark tokens, warm/cool accents, labelled up/down, 16px body, 44px targets, tabular numerals | Done |
| Pathway, candle canvas, calm feedback panel | Done |
| Desktop rail + side panel; mobile bottom nav + safe areas | Done |
| Reduced motion (OS setting and in-app), no confetti | Done |
| Learn, Practice, Simulator, Journal, Progress; Settings, Glossary, Sources; 404 | Done |
| Lesson player: back, progress, one concept per screen, glossary, misconception feedback and retry, step preserved | Done |
| Onboarding ≤ 3 steps with the required notice | Done |
| Curriculum: 10 units, 30 lessons + 10 checkpoints, 92 exercise items, concept screens ≤ 80 words, sources, rubrics, no hardcoded margin or tax rules | Done |
| Five labs on a shared typed engine; keyboard and button alternatives | Done |
| Learning-only XP with idempotent awards; achievements; forgiving weekly goal; review queue; "demonstrated" rule | Done |
| Simulator: $1,000, 3 fictional instruments, 6 seeded synthetic scenarios, no hindsight, next-event fills, market/limit/stop/target with one-cancels-other, spread/slippage/fees, gaps beyond stops, integer cents, ledger-derived balances, pause on background, atomic persistence, limits explained | Done |
| Journal: automatic entries, frozen R or "unavailable", sample sizes, reflections, tags, replay | Done |
| Help panel (simpler, another example, term lookup) without fake AI | Done |
| IndexedDB with versioned migrations; blocked/quota/corrupt/newer-version/conflict handling; export/import merge or replace; resets | Done |
| PWA manifest, icons, offline, truthful update/offline states | Done |
| Docs: README, DESIGN_SYSTEM, BUILD_STATUS | Done |
| Preview deploy | Not done (no authorized free deploy available) |
