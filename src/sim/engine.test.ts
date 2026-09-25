import { beforeAll, describe, expect, it } from 'vitest';
import {
  applyEvent,
  balances,
  cancelOrder,
  checkSimIntegrity,
  createSim,
  eventsFor,
  placeEntry,
  placeMarketExit,
  setStop,
  setTarget,
  stepSim,
  visibleEvents,
  type SimState,
} from './engine';
import { SCENARIOS, buildCandles, generateEvents, type Scenario } from './scenarios';
import { entryNet, entryR, journalEntryFor, journalStats, reconcile, type JournalEntry } from './journal';

const noFees = { feePerFill: 0, slippagePerShare: 0 };

// Exact, noise-free paths so fills can be asserted to the cent.
const flatUp: Scenario = {
  id: 'test-flat-up',
  version: 1,
  instrumentId: 'hblt',
  title: 'Test up',
  shape: 'uptrend',
  description: '',
  seed: 1,
  startPrice: 1990,
  segments: [{ events: 30, drift: 10, noise: 0, spread: 2 }],
};
// 1000 → drifts down 10/event, then gaps down 300.
const gapDown: Scenario = {
  id: 'test-gap-down',
  version: 1,
  instrumentId: 'qfld',
  title: 'Test gap',
  shape: 'gap-down',
  description: '',
  seed: 1,
  startPrice: 2000,
  segments: [
    { events: 5, drift: 0, noise: 0, spread: 2 },
    { events: 5, drift: 0, noise: 0, spread: 2, gap: -300 },
  ],
};

const jumpUp: Scenario = {
  id: 'test-jump-up',
  version: 1,
  instrumentId: 'hblt',
  title: 'Test jump',
  shape: 'gap-up',
  description: '',
  seed: 1,
  startPrice: 2000,
  segments: [
    { events: 1, drift: 0, noise: 0, spread: 2 },
    { events: 5, drift: 0, noise: 0, spread: 2, gap: 500 },
  ],
};

beforeAll(() => {
  SCENARIOS.push(flatUp, gapDown, jumpUp);
});

function run(state: SimState, steps: number): SimState {
  let s = state;
  for (let i = 0; i < steps; i++) s = stepSim(s).state;
  return s;
}

describe('synthetic scenarios', () => {
  it('are deterministic for the same seed', () => {
    for (const sc of SCENARIOS) {
      const a = generateEvents(sc);
      const b = generateEvents({ ...sc, id: sc.id + '-copy' });
      expect(b).toEqual(a);
    }
  });

  it('have valid quotes, strictly increasing sequence ids and exactly one final event', () => {
    for (const sc of SCENARIOS) {
      const ev = generateEvents(sc);
      ev.forEach((e, i) => {
        expect(e.ask).toBeGreaterThan(e.bid);
        expect(e.bid).toBeGreaterThan(0);
        expect(Number.isInteger(e.bid) && Number.isInteger(e.ask)).toBe(true);
        if (i > 0) expect(e.seq).toBe(ev[i - 1]!.seq + 1);
      });
      expect(ev.filter((e) => e.final)).toHaveLength(1);
      expect(ev[ev.length - 1]!.final).toBe(true);
    }
  });

  it('builds candles only from visible events (no hindsight)', () => {
    let s = createSim('steady-climb', noFees);
    s = run(s, 8);
    const vis = visibleEvents(s);
    expect(vis).toHaveLength(9);
    const candles = buildCandles(vis);
    const maxSeq = Math.max(...candles.map((c) => c.endSeq));
    expect(maxSeq).toBe(vis[vis.length - 1]!.seq);
    expect(candles[candles.length - 1]!.complete).toBe(false);
    const all = eventsFor(s);
    const future = all.slice(9).map((e) => e.last);
    const visibleHigh = Math.max(...candles.map((c) => c.high));
    expect(visibleHigh).toBe(Math.max(...vis.map((e) => e.last)));
    expect(future.length).toBeGreaterThan(0);
  });

  it('never lets a candle span a session boundary', () => {
    const sc = SCENARIOS.find((s) => s.id === 'overnight-drop')!;
    for (const c of buildCandles(generateEvents(sc))) {
      const evs = generateEvents(sc).filter((e) => e.seq >= c.startSeq && e.seq <= c.endSeq);
      expect(new Set(evs.map((e) => e.session)).size).toBe(1);
    }
  });
});

describe('orders and fills', () => {
  it('fills a market buy on the NEXT event at ask plus slippage, with fee', () => {
    let s = createSim('test-flat-up', { feePerFill: 50, slippagePerShare: 1 });
    const ev0 = eventsFor(s)[0]!;
    const r = placeEntry(s, { type: 'market', qty: 10, rationale: [], note: '' });
    expect(r.ok).toBe(true);
    s = r.state;
    expect(s.trades).toHaveLength(0);
    expect(balances(s).reserved).toBe(10 * (ev0.ask + 1) + 50);
    s = stepSim(s).state;
    const ev1 = eventsFor(s)[1]!;
    const t = s.trades[0]!;
    expect(t.entryPrice).toBe(ev1.ask + 1);
    const b = balances(s);
    expect(b.cash).toBe(100_000 - 10 * (ev1.ask + 1) - 50);
    expect(b.reserved).toBe(0);
    expect(b.shares).toBe(10);
    expect(b.unrealizedPnl).toBe(10 * ev1.bid - 10 * (ev1.ask + 1));
  });

  it('respects limit prices and waits until the ask reaches the limit', () => {
    let s = createSim('test-gap-down', noFees);
    const r = placeEntry(s, { type: 'limit', qty: 5, limitPrice: 1800, rationale: [], note: '' });
    expect(r.ok).toBe(true);
    s = r.state;
    s = run(s, 4);
    expect(s.trades).toHaveLength(0);
    expect(balances(s).reserved).toBe(5 * 1800);
    s = stepSim(s).state;
    const t = s.trades[0]!;
    const gapEvent = eventsFor(s)[5]!;
    expect(gapEvent.ask).toBeLessThanOrEqual(1800);
    expect(t.entryPrice).toBe(gapEvent.ask);
    expect(t.entryPrice).toBeLessThanOrEqual(1800);
  });

  it('fills a gapped stop BELOW its trigger price and reports it', () => {
    let s = createSim('test-gap-down', { feePerFill: 0, slippagePerShare: 1 });
    s = placeEntry(s, { type: 'market', qty: 10, stop: 1950, rationale: ['plan'], note: '' }).state;
    s = stepSim(s).state;
    expect(s.trades[0]!.status).toBe('open');
    s = run(s, 3);
    const res = stepSim(s);
    s = res.state;
    const t = s.trades[0]!;
    expect(t.status).toBe('closed');
    expect(t.exitReason).toBe('stop');
    const gapEvent = eventsFor(s)[5]!;
    expect(t.exitPrice).toBe(gapEvent.bid - 1);
    expect(t.exitPrice!).toBeLessThan(1950);
    expect(res.notices.join(' ')).toMatch(/below the stop price/);
    // Loss exceeds the planned (entry − stop) risk.
    const net = s.ledger.filter((l) => l.tradeId === t.id).reduce((a, l) => a + l.cash, 0);
    expect(-net).toBeGreaterThan(t.initialRisk!);
  });

  it('links stop and target: one exit cancels the other', () => {
    let s = createSim('test-flat-up', noFees);
    s = placeEntry(s, { type: 'market', qty: 3, stop: 1900, target: 2050, rationale: [], note: '' }).state;
    s = stepSim(s).state;
    const pending = s.orders.filter((o) => o.status === 'pending');
    expect(pending.map((o) => o.role).sort()).toEqual(['stop', 'target']);
    s = run(s, 10);
    const t = s.trades[0]!;
    expect(t.exitReason).toBe('target');
    const stop = s.orders.find((o) => o.role === 'stop')!;
    expect(stop.status).toBe('canceled');
    expect(s.orders.filter((o) => o.status === 'filled' && o.side === 'sell')).toHaveLength(1);
  });

  it('attached exits cannot fill on the same event as the entry', () => {
    let s = createSim('test-flat-up', noFees);
    const ev1 = eventsFor(s)[1]!;
    // Target at the next bid would be reachable on the entry event if same-event exits were allowed.
    s = placeEntry(s, { type: 'market', qty: 1, target: ev1.bid, rationale: [], note: '' }).state;
    s = stepSim(s).state;
    expect(s.trades[0]!.status).toBe('open');
    s = stepSim(s).state;
    expect(s.trades[0]!.status).toBe('closed');
  });

  it('rejects unaffordable orders at placement', () => {
    const s = createSim('test-flat-up', noFees);
    const r = placeEntry(s, { type: 'market', qty: 1000, rationale: [], note: '' });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/Not enough virtual cash/);
    expect(r.state).toBe(s);
  });

  it('rejects a market buy that becomes unaffordable at execution', () => {
    let s = createSim('test-jump-up', noFees);
    const ask0 = eventsFor(s)[0]!.ask;
    const qty = Math.floor(100_000 / ask0);
    expect(qty * eventsFor(s)[1]!.ask).toBeGreaterThan(100_000);
    const r = placeEntry(s, { type: 'market', qty, rationale: [], note: '' });
    expect(r.ok).toBe(true);
    s = stepSim(r.state).state;
    const entry = s.orders.find((o) => o.role === 'entry')!;
    expect(entry.status).toBe('rejected');
    expect(entry.message).toMatch(/Rejected at execution/);
    expect(balances(s).cash).toBe(100_000);
    expect(balances(s).reserved).toBe(0);
  });

  it('prevents a second position, overselling and borrowing', () => {
    let s = createSim('test-flat-up', noFees);
    expect(placeMarketExit(s).ok).toBe(false);
    s = placeEntry(s, { type: 'market', qty: 2, rationale: [], note: '' }).state;
    expect(placeEntry(s, { type: 'market', qty: 1, rationale: [], note: '' }).ok).toBe(false);
    s = stepSim(s).state;
    expect(placeEntry(s, { type: 'market', qty: 1, rationale: [], note: '' }).ok).toBe(false);
    s = placeMarketExit(s).state;
    expect(placeMarketExit(s).ok).toBe(false);
    s = stepSim(s).state;
    expect(balances(s).shares).toBe(0);
    expect(checkSimIntegrity(s)).toEqual([]);
  });

  it('validates stop and target placement', () => {
    let s = createSim('test-flat-up', noFees);
    const ask = eventsFor(s)[0]!.ask;
    expect(placeEntry(s, { type: 'market', qty: 1, stop: ask + 5, rationale: [], note: '' }).ok).toBe(false);
    expect(placeEntry(s, { type: 'market', qty: 1, target: ask - 5, rationale: [], note: '' }).ok).toBe(false);
    expect(placeEntry(s, { type: 'market', qty: 0, rationale: [], note: '' }).ok).toBe(false);
    expect(placeEntry(s, { type: 'market', qty: 1.5, rationale: [], note: '' }).ok).toBe(false);
    s = placeEntry(s, { type: 'market', qty: 1, rationale: [], note: '' }).state;
    s = stepSim(s).state;
    const bid = eventsFor(s)[1]!.bid;
    expect(setStop(s, bid).ok).toBe(false);
    expect(setTarget(s, bid).ok).toBe(false);
    expect(setStop(s, bid - 20).ok).toBe(true);
  });

  it('cancels pending entry and releases reserved cash', () => {
    let s = createSim('test-flat-up', noFees);
    s = placeEntry(s, { type: 'limit', qty: 5, limitPrice: 1000, rationale: [], note: '' }).state;
    expect(balances(s).reserved).toBe(5000);
    const id = s.orders[0]!.id;
    s = cancelOrder(s, id).state;
    expect(balances(s).reserved).toBe(0);
    expect(s.orders[0]!.status).toBe('canceled');
    s = run(s, 5);
    expect(s.trades).toHaveLength(0);
  });

  it('ignores duplicate or out-of-order events', () => {
    let s = createSim('test-flat-up', noFees);
    s = placeEntry(s, { type: 'market', qty: 1, rationale: [], note: '' }).state;
    const ev1 = eventsFor(s)[1]!;
    s = applyEvent(s, ev1).state;
    const again = applyEvent(s, ev1);
    expect(again.ok).toBe(false);
    expect(again.state).toBe(s);
    const skip = applyEvent(s, eventsFor(s)[5]!);
    expect(skip.ok).toBe(false);
    expect(s.ledger.filter((l) => l.kind === 'buy')).toHaveLength(1);
  });

  it('orders submitted while paused wait for the next event', () => {
    let s = createSim('test-flat-up', noFees);
    s = run(s, 3);
    s = placeEntry(s, { type: 'market', qty: 1, rationale: [], note: '' }).state;
    expect(s.trades).toHaveLength(0);
    const cursor = s.cursor;
    s = stepSim(s).state;
    expect(s.trades[0]!.entrySeq).toBe(eventsFor(s)[cursor + 1]!.seq);
  });

  it('closes an open position at the final event and ends the scenario', () => {
    let s = createSim('test-gap-down', noFees);
    s = placeEntry(s, { type: 'market', qty: 1, rationale: [], note: '' }).state;
    s = run(s, 20);
    expect(s.ended).toBe(true);
    expect(s.trades[0]!.exitReason).toBe('scenario-end');
    expect(balances(s).shares).toBe(0);
    expect(stepSim(s).ok).toBe(false);
  });

  it('survives a JSON round trip (refresh) and continues identically', () => {
    let s = createSim('steady-climb', { feePerFill: 50, slippagePerShare: 1 });
    s = placeEntry(s, { type: 'market', qty: 10, stop: 1950, target: 2100, rationale: ['x'], note: '' }).state;
    s = run(s, 12);
    const restored = JSON.parse(JSON.stringify(s)) as SimState;
    expect(checkSimIntegrity(restored)).toEqual([]);
    const a = run(s, 30);
    const b = run(restored, 30);
    expect(b).toEqual(a);
  });
});

describe('ledger, risk and journal', () => {
  it('freezes initial risk from the actual fill and original stop', () => {
    let s = createSim('test-flat-up', { feePerFill: 50, slippagePerShare: 1 });
    s = placeEntry(s, { type: 'market', qty: 10, stop: 1950, rationale: ['plan'], note: '' }).state;
    s = stepSim(s).state;
    const t = s.trades[0]!;
    expect(t.initialRisk).toBe((t.entryPrice - 1950) * 10);
    // Moving the stop later must not change the frozen denominator.
    s = setStop(s, 1900).state;
    expect(s.trades[0]!.initialRisk).toBe(t.initialRisk);
    s = placeMarketExit(s).state;
    s = stepSim(s).state;
    const entry = journalEntryFor(s, t.id, '2026-01-01T00:00:00Z')!;
    expect(entry.stopWidened).toBe(true);
    expect(entryR(entry)).toBeCloseTo(entryNet(entry) / t.initialRisk!);
  });

  it('reports R as unavailable without a stop', () => {
    let s = createSim('test-flat-up', noFees);
    s = placeEntry(s, { type: 'market', qty: 1, rationale: [], note: '' }).state;
    s = run(s, 1);
    s = placeMarketExit(s).state;
    s = run(s, 1);
    const e = journalEntryFor(s, s.trades[0]!.id, 'now')!;
    expect(e.initialRisk).toBeNull();
    expect(entryR(e)).toBeNull();
  });

  it('reconciles journal totals with the ledger across several trades', () => {
    let s = createSim('steady-climb', { feePerFill: 50, slippagePerShare: 2 });
    const entries: JournalEntry[] = [];
    for (let k = 0; k < 4; k++) {
      s = placeEntry(s, { type: 'market', qty: 7 + k, stop: eventsFor(s)[s.cursor]!.bid - 40, rationale: [], note: '' }).state;
      s = run(s, 4);
      if (s.trades.some((t) => t.status === 'open')) s = placeMarketExit(s).state;
      const r = stepSim(s);
      s = r.state;
      for (const t of s.trades.filter((x) => x.status === 'closed')) {
        if (!entries.find((e) => e.tradeId === t.id)) entries.push(journalEntryFor(s, t.id, 'now')!);
      }
    }
    const { ledgerChange, journalNet } = reconcile(s, entries);
    expect(journalNet).toBe(ledgerChange);
    const b = balances(s);
    expect(b.cash).toBe(100_000 + ledgerChange);
    expect(b.realizedPnl).toBe(ledgerChange);
    const stats = journalStats(entries);
    expect(stats.count).toBe(entries.length);
    expect(stats.wins + stats.losses + stats.breakeven).toBe(stats.count);
    expect(stats.totalNet).toBe(ledgerChange);
    expect(stats.totalCosts).toBe(entries.length * 100);
  });

  it('shows unavailable statistics as null rather than zero', () => {
    const stats = journalStats([]);
    expect(stats.winRate).toBeNull();
    expect(stats.averageWin).toBeNull();
    expect(stats.averageLoss).toBeNull();
    expect(stats.averageR).toBeNull();
  });
});
