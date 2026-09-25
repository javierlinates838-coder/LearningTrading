import { mulberry32 } from '../engine/random';
import type { Candle } from '../domain/candles';

export interface QuoteEvent {
  /** Monotonic sequence id, starting at 1. */
  seq: number;
  /** Training-clock minutes since the scenario began. */
  t: number;
  session: number;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  final?: boolean;
}

export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  description: string;
}

export interface Segment {
  events: number;
  /** Average price change per event, in cents. */
  drift: number;
  /** Random noise amplitude per event, in cents. */
  noise: number;
  /** Spread in cents during this segment. */
  spread: number;
  /** Price jump applied at the first event of this segment; also starts a new session. */
  gap?: number;
  /** Typical volume per event. */
  volume?: number;
}

export interface Scenario {
  id: string;
  version: number;
  instrumentId: string;
  title: string;
  shape: 'uptrend' | 'downtrend' | 'range' | 'gap-down' | 'gap-up' | 'failed-breakout';
  description: string;
  seed: number;
  startPrice: number;
  /** Quotes already on screen when a run starts, so the chart has context. Orders can only fill after them. */
  warmupEvents?: number;
  segments: Segment[];
}

export const EVENTS_PER_CANDLE = 6;
export const MINUTES_PER_EVENT = 5;
export const SESSION_MINUTES = 390;

export const INSTRUMENTS: Instrument[] = [
  {
    id: 'hblt',
    symbol: 'HBLT',
    name: 'Harbor Lantern Co.',
    description: 'A fictional maker of marine lighting. Invented for training; not a real company.',
  },
  {
    id: 'qfld',
    symbol: 'QFLD',
    name: 'Quillfield Foods',
    description: 'A fictional regional grocery chain. Invented for training; not a real company.',
  },
  {
    id: 'frrw',
    symbol: 'FRRW',
    name: 'Ferrow Rail Systems',
    description: 'A fictional freight-signalling supplier. Invented for training; not a real company.',
  },
];

export const SCENARIOS: Scenario[] = [
  {
    id: 'steady-climb',
    version: 1,
    instrumentId: 'hblt',
    title: 'Steady climb',
    shape: 'uptrend',
    description: 'Prices mostly make higher highs and higher lows, with pullbacks along the way.',
    seed: 1101,
    startPrice: 2000,
    warmupEvents: 36,
    segments: [
      { events: 36, drift: 2, noise: 7, spread: 2, volume: 900 },
      { events: 18, drift: -2, noise: 6, spread: 2, volume: 600 },
      { events: 42, drift: 2.5, noise: 7, spread: 2, volume: 1000 },
      { events: 18, drift: -1.5, noise: 6, spread: 3, volume: 600 },
      { events: 36, drift: 2, noise: 8, spread: 2, volume: 900 },
    ],
  },
  {
    id: 'slow-slide',
    version: 1,
    instrumentId: 'qfld',
    title: 'Slow slide',
    shape: 'downtrend',
    description: 'Lower highs and lower lows. Bounces happen, but sellers keep returning.',
    seed: 2202,
    startPrice: 3500,
    warmupEvents: 36,
    segments: [
      { events: 30, drift: -2.5, noise: 9, spread: 3, volume: 1100 },
      { events: 18, drift: 2, noise: 7, spread: 3, volume: 700 },
      { events: 42, drift: -3, noise: 9, spread: 3, volume: 1200 },
      { events: 18, drift: 1.5, noise: 7, spread: 3, volume: 700 },
      { events: 36, drift: -2, noise: 8, spread: 3, volume: 1000 },
    ],
  },
  {
    id: 'sideways-box',
    version: 1,
    instrumentId: 'frrw',
    title: 'Sideways box',
    shape: 'range',
    description: 'Price swings between a rough floor and ceiling without a clear trend.',
    seed: 3303,
    startPrice: 1500,
    warmupEvents: 36,
    segments: [
      { events: 24, drift: 2.5, noise: 5, spread: 2, volume: 700 },
      { events: 24, drift: -2.5, noise: 5, spread: 2, volume: 700 },
      { events: 24, drift: 2.5, noise: 5, spread: 2, volume: 700 },
      { events: 24, drift: -2.5, noise: 5, spread: 2, volume: 700 },
      { events: 24, drift: 2.5, noise: 5, spread: 2, volume: 700 },
      { events: 24, drift: -2, noise: 5, spread: 2, volume: 700 },
    ],
  },
  {
    id: 'overnight-drop',
    version: 1,
    instrumentId: 'qfld',
    title: 'Overnight drop',
    shape: 'gap-down',
    description: 'A calm session, then the next session opens far lower. Stops can fill well below their price.',
    seed: 4404,
    startPrice: 2800,
    warmupEvents: 36,
    segments: [
      { events: 48, drift: 0.6, noise: 6, spread: 3, volume: 800 },
      { events: 30, drift: 0.4, noise: 6, spread: 3, volume: 700 },
      { events: 36, drift: -1, noise: 12, spread: 6, gap: -260, volume: 2200 },
      { events: 30, drift: 0.5, noise: 8, spread: 4, volume: 1200 },
    ],
  },
  {
    id: 'morning-jump',
    version: 1,
    instrumentId: 'hblt',
    title: 'Morning jump',
    shape: 'gap-up',
    description: 'A new session opens well above the prior close. Chasing the jump is one of the choices.',
    seed: 5505,
    startPrice: 1800,
    warmupEvents: 36,
    segments: [
      { events: 48, drift: 0.2, noise: 5, spread: 2, volume: 700 },
      { events: 18, drift: 1.2, noise: 10, spread: 4, gap: 150, volume: 2400 },
      { events: 36, drift: -1.4, noise: 8, spread: 3, volume: 1300 },
      { events: 42, drift: 0.4, noise: 6, spread: 2, volume: 800 },
    ],
  },
  {
    id: 'false-breakout',
    version: 1,
    instrumentId: 'frrw',
    title: 'Break and fail',
    shape: 'failed-breakout',
    description: 'Price pushes above a ceiling, then falls back inside the range.',
    seed: 6606,
    startPrice: 1600,
    warmupEvents: 36,
    segments: [
      { events: 24, drift: 2, noise: 5, spread: 2, volume: 700 },
      { events: 24, drift: -2, noise: 5, spread: 2, volume: 700 },
      { events: 24, drift: 2, noise: 5, spread: 2, volume: 700 },
      { events: 12, drift: 4, noise: 6, spread: 3, volume: 1800 },
      { events: 30, drift: -4, noise: 7, spread: 3, volume: 1500 },
      { events: 30, drift: -0.5, noise: 6, spread: 2, volume: 800 },
    ],
  },
];

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

export function getInstrument(id: string): Instrument | undefined {
  return INSTRUMENTS.find((i) => i.id === id);
}

const cache = new Map<string, QuoteEvent[]>();

/**
 * Deterministically generate the synthetic quote stream for a scenario.
 * The same scenario id + version + seed always produces identical events.
 */
export function generateEvents(s: Scenario): QuoteEvent[] {
  const key = `${s.id}@${s.version}:${s.seed}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const rand = mulberry32(s.seed);
  const events: QuoteEvent[] = [];
  let price = s.startPrice;
  let seq = 0;
  let t = 0;
  let session = 1;
  let minutesIntoSession = 0;

  for (const seg of s.segments) {
    for (let k = 0; k < seg.events; k++) {
      if (k === 0 && seg.gap) {
        session++;
        t += 60 * 17;
        minutesIntoSession = 0;
        price += seg.gap;
      } else if (minutesIntoSession >= SESSION_MINUTES) {
        session++;
        t += 60 * 17;
        minutesIntoSession = 0;
      }
      const noise = (rand() * 2 - 1) * seg.noise;
      price = Math.max(100, Math.round(price + seg.drift + noise));
      const half = Math.floor(seg.spread / 2);
      const bid = Math.max(1, price - half);
      const ask = bid + seg.spread;
      const baseVol = seg.volume ?? 800;
      const volume = Math.max(10, Math.round(baseVol * (0.6 + rand() * 0.8) * (k === 0 && seg.gap ? 3 : 1)));
      seq++;
      events.push({ seq, t, session, bid, ask, last: price, volume });
      t += MINUTES_PER_EVENT;
      minutesIntoSession += MINUTES_PER_EVENT;
    }
  }
  const lastEvent = events[events.length - 1];
  if (lastEvent) lastEvent.final = true;
  cache.set(key, events);
  return events;
}

/**
 * Build candles from exactly the events provided. Callers pass only the
 * events visible at the replay cursor, so no candle can contain future data.
 * The last candle may be partial. Candles never span a session boundary.
 */
export function buildCandles(events: QuoteEvent[]): Array<Candle & { session: number; startSeq: number; endSeq: number; complete: boolean }> {
  const out: Array<Candle & { session: number; startSeq: number; endSeq: number; complete: boolean }> = [];
  let bucket: QuoteEvent[] = [];
  const flush = (complete: boolean) => {
    if (!bucket.length) return;
    const first = bucket[0]!;
    const last = bucket[bucket.length - 1]!;
    out.push({
      i: out.length,
      open: first.last,
      high: Math.max(...bucket.map((e) => e.last)),
      low: Math.min(...bucket.map((e) => e.last)),
      close: last.last,
      volume: bucket.reduce((s, e) => s + e.volume, 0),
      label: clockLabel(first),
      session: first.session,
      startSeq: first.seq,
      endSeq: last.seq,
      complete,
    });
    bucket = [];
  };
  for (const e of events) {
    const prev = bucket[bucket.length - 1];
    if (prev && prev.session !== e.session) flush(true);
    bucket.push(e);
    if (bucket.length === EVENTS_PER_CANDLE) flush(true);
  }
  flush(false);
  return out;
}

export function clockLabel(e: Pick<QuoteEvent, 'session'>): string {
  return `Day ${e.session}`;
}

export function formatTrainingTime(e: Pick<QuoteEvent, 'seq' | 'session'>, events: QuoteEvent[]): string {
  const firstOfSession = events.find((x) => x.session === e.session);
  const offset = firstOfSession ? (e.seq - firstOfSession.seq) * MINUTES_PER_EVENT : 0;
  const minutes = 9 * 60 + 30 + offset;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `Day ${e.session} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
