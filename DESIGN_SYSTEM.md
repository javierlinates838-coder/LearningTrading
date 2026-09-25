# MarketQuest design system

MarketQuest is a calm, adult learning tool. It should feel like a good textbook with a lab bench attached, not a trading terminal and not a game. The interface uses a dark ink background, warm-white text, one cool accent for actions and one warm accent reserved for mastery.

Tokens live in `src/styles/tokens.css`. Component styles live in `src/styles/app.css`. Contrast is enforced by `src/styles/contrast.test.ts`, which parses the token file and fails the build if a text/background or control/background pair drops below its WCAG AA ratio.

## How UI UX Pro Max was used

The skill was installed **into this project only** with the vendor CLI:

```bash
npx -y ui-ux-pro-max-cli@2.15.0 init --ai cursor
```

- Installed path: `.cursor/skills/ui-ux-pro-max/` (the CLI also added sibling skills under `.cursor/skills/`: `banner-design`, `brand`, `design`, `design-system`, `slides`, `ui-styling`; they were not used).
- Skill source: `ui-ux-pro-max` 2.13.0 (`skill.json`), upstream commit `dcc40ff`.
- No global settings, editor settings or other projects were modified.
- Raw output from each run is saved unedited in [`docs/ui-ux-pro-max/`](docs/ui-ux-pro-max/).

| Run | Command | Result | Used? |
| --- | --- | --- | --- |
| 1 | `search.py "<first query>" --design-system -p MarketQuest --format markdown --variance 4 --motion 2 --density 5` | Claymorphism, Baloo 2 + Comic Neue, indigo + orange ("kids, education, playful") | **Rejected.** The audience is adults learning about money; a toy-like style undermines trust. The exact wording of this first query was not preserved, only its output (`01-design-system-first-query.md`). |
| 2 | `search.py "adult financial education tool dark minimal" --design-system -p MarketQuest --format markdown --variance 4 --motion 2 --density 5` | Dark Mode (OLED), Inter, bg `#0F172A`, card `#1B2336`, muted text `#94A3B8`, accent `#22C55E` | **Adopted as the base, then refined** (see below). Reproduces byte-for-byte (`02-…md`). |
| 3 | `search.py "candlestick price chart financial" --domain chart -n 3` | Candlestick; filled vs hollow bodies; OHLC text values; sortable OHLC table fallback; keyboard focus reveals values; Lightweight Charts recommended | Guidance adopted; library not adopted (see "Chart"). |
| 4 | `search.py "readable numeric dashboard education" --domain typography -n 3` | Fira Code + Fira Sans; Baloo 2 + Comic Neue; others | Not adopted: one self-hosted family (Inter, from run 2) keeps the offline bundle small, and Inter has tabular figures. |
| 5 | `search.py "drag alternative reduced motion focus back button error touch target" --domain ux -n 8` | Single-pointer alternatives to drag (High); respect reduced motion (High); visible focus in modals (High); predictable back (High); focusable error summary (High); touch target sizing (High); focus not obscured (Medium) | Adopted; each item maps to a rule below. |

### Refinements to the skill's palette

| Skill output | MarketQuest | Why |
| --- | --- | --- |
| Background `#0F172A` (blue slate) | Ink `#0C1017`, surface `#151B25` (the spec's values) | Neutral, slightly warmer dark; less "developer tool". |
| Foreground `#F8FAFC` | Warm white `#F3EFE7` | Softer on dark for long reading. |
| Accent green `#22C55E` | Cool accent `#7CC0FF` | Green means "price up" in this app. An action colour that is also a direction colour would make every button look like a gain. |
| No mastery colour | Warm accent `#F0BF6E` | Used only for completed lessons, demonstrated skills and achievements. |
| Destructive `#EF4444` | Down `#FF8F80`, up `#5FD09A` | Both meet 4.5:1 as text on every surface. Always paired with ▲/▼, "gain/loss", or hollow/filled. |
| Border `#475569` | `#2C374A` decorative, `#6D7A91` for control edges | Control edges must meet 3:1 (WCAG 1.4.11); decorative dividers need not. |
| Scroll-reveal GSAP motion | None | Content never hides behind animation. Only a short fade on step change, and it drops to 0ms under reduced motion. |
| Google Fonts `@import` | Self-hosted `@fontsource-variable/inter` | Works offline; no third-party request. |

## Tokens

### Colour

| Token | Value | Use |
| --- | --- | --- |
| `--color-ink` | `#0C1017` | Page background |
| `--color-surface` | `#151B25` | Cards, rail, bottom nav |
| `--color-surface-2` / `-3` | `#1C2431` / `#243042` | Raised cells, selected rows |
| `--color-border` | `#2C374A` | Decorative dividers |
| `--color-border-strong` | `#6D7A91` | Input, option and button outlines (≥3:1) |
| `--color-text` | `#F3EFE7` | Body text |
| `--color-text-muted` / `-faint` | `#AEB5C1` / `#8A93A3` | Secondary text (both ≥4.5:1 on surface) |
| `--color-accent` / `-strong` / `-soft` | `#7CC0FF` / `#A9D5FF` / `#16304A` | Primary actions, links, current step |
| `--color-mastery` / `-soft` | `#F0BF6E` / `#3A2C15` | Completed, demonstrated, achievements only |
| `--color-up` / `-soft` | `#5FD09A` / `#133426` | Price rose, gain, correct |
| `--color-down` / `-soft` | `#FF8F80` / `#3D1D1B` | Price fell, loss, stop line |
| `--color-warn` / `-soft` | `#F3C969` / `#3A3016` | "Not quite yet", synthetic/virtual badges |
| `--color-focus` | `#A9D5FF` | 3px focus ring |

### Type, space and size

- Inter Variable for interface text, self-hosted. Body 1rem (16px) with 1.55 line height.
- Instrument Serif (latin, self-hosted) for page titles, lesson headlines, the continue card and the current pathway step. It is the one place the interface stops looking like a form. Numbers stay in Inter with tabular figures.
- `font-variant-numeric: tabular-nums` on every money, price, quantity and statistic (`.num`, `.tabular`, tables, key/value lists).
- Text scale setting: 100%, 115% or 130%, applied as the root font size so every rem-based size grows. Verified by the enlarged-text screenshots.
- Spacing scale `--space-1`…`--space-10` (4px base). Radii 8/12/18px.
- `--touch: 44px`: every button, option, segmented control, stepper and nav item has at least this height and width.

### Motion

- `--duration` is 180ms normally and 0ms when `prefers-reduced-motion: reduce` is set, or when the learner picks "Reduce" in Settings (`html[data-motion='reduce']`). "Standard" in Settings keeps motion even if the OS asks to reduce it.
- No confetti, no counters that spin up, no auto-scrolling. Simulator playback is user-started and pauses when the tab is hidden.

## Layout

- **Mobile (<1024px):** top bar (brand, "Virtual money" badge, glossary, settings) and a fixed bottom navigation with the five primary areas. Safe-area insets pad both. The bottom nav hides in focus mode (lesson player, practice sessions, onboarding) so the Continue bar has room.
- **Desktop (≥1024px):** a left navigation rail with the five primary areas plus Glossary and Settings. Learn, Practice and the simulator use a main column plus side panel.
- Content width is capped for reading (`.page`), wider for the simulator and journal (`.page-wide`).

## Signature elements

1. **Pathway** (`src/components/Pathway.tsx`). Each unit is a vertical connected path of nodes. Circle nodes are lessons; the diamond is the checkpoint. Every state is a shape plus a word: ✓ completed (mastery colour), ▶ up next (accent ring), padlock locked with the reason ("finish X first"), and open.
2. **Candle canvas** (`src/components/CandleChart.tsx`, `CandleFigure.tsx`). A custom SVG chart. Up candles are hollow and down candles are filled, so direction never depends on colour; a legend says so. The candle that is still forming is dashed. Selectable charts support tap, arrow keys, Home and End, and announce the selected candle's OHLC. Every chart has a text label and a "Chart data as a table" disclosure.
3. **Feedback panel** (`src/components/FeedbackPanel.tsx`). Calm and specific. A wrong answer is "Not quite yet", names the likely misconception in plain words and invites a retry. The full explanation appears once the answer is correct or after two attempts. Focus moves to the panel so screen readers hear it. There is no red flash and no sound.

## Chart decision

The skill recommends TradingView Lightweight Charts. It was not used because:

- its licence requires visible attribution, which clutters a teaching chart;
- it renders to canvas, which offers no per-candle accessible names or keyboard selection;
- the exercises need tap-to-select candles, zones and labelled parts, which would be custom code on top of it anyway.

The custom SVG chart follows the skill's accessibility notes directly: filled vs hollow bodies, OHLC text values, a table fallback, keyboard focus revealing values, and live updates that never steal focus.

## Rules that follow from the UX guidance

- **No drag-only interactions.** Sequences reorder with up/down buttons; categorising uses tap-to-pick then a select; candle building uses steppers; chart zones use tap or steppers.
- **No hover-only information.** Glossary terms are buttons that expand inline (`aria-expanded`). Chart values show on tap or focus.
- **No scroll trapping.** Charts do not capture wheel or touch scrolling.
- **Visible focus.** A 3px `--color-focus` ring on every control, including inside the native `<dialog>`. Headings and the feedback panel receive focus programmatically for screen readers and show no ring, because they are not controls.
- **Predictable back.** Every lesson and practice screen has a labelled back link. Browser back works because every screen is a real URL.
- **Errors.** Inline errors are `role="alert"`, linked with `aria-describedby`, and focus moves to the field.
- **Honest states.** Empty states say what to do next. Storage problems, offline mode and available updates appear as plain-language banners and never claim more than is true.
