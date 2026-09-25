import { z } from 'zod';
import { STARTING_CASH_CENTS } from '../config/app';
import { formatMoney } from '../domain/money';
import { generateEvents, getScenario, type QuoteEvent } from './scenarios';

/*
 * Bounded training simulator.
 * - Whole shares, long only, no borrowing, one position at a time.
 * - Every order is evaluated only against events that arrive AFTER it was placed.
 * - Buys execute on the ask, sells on the bid. Market-style fills (market
 *   orders and triggered stops) add adverse slippage. Limit orders fill at the
 *   quote when it is at or better than the limit, never worse.
 * - A fixed training fee is charged on every fill.
 * - Balances are always derived from the ledger.
 */

export const assumptionsSchema = z.object({
  feePerFill: z.number().int().min(0).max(1000),
  slippagePerShare: z.number().int().min(0).max(100),
});
export type Assumptions = z.infer<typeof assumptionsSchema>;
export const DEFAULT_ASSUMPTIONS: Assumptions = { feePerFill: 50, slippagePerShare: 1 };

export const orderSchema = z.object({
  id: z.string(),
  role: z.enum(['entry', 'stop', 'target', 'exit']),
  side: z.enum(['buy', 'sell']),
  type: z.enum(['market', 'limit', 'stop']),
  qty: z.number().int().positive(),
  price: z.number().int().positive().optional(),
  status: z.enum(['pending', 'filled', 'canceled', 'rejected']),
  placedAtSeq: z.number().int().nonnegative(),
  closedAtSeq: z.number().int().optional(),
  fillPrice: z.number().int().optional(),
  fee: z.number().int().optional(),
  reserved: z.number().int().nonnegative(),
  message: z.string(),
  tradeId: z.string().optional(),
  planId: z.string().optional(),
  attachStop: z.number().int().positive().optional(),
  attachTarget: z.number().int().positive().optional(),
});
export type Order = z.infer<typeof orderSchema>;

export const ledgerEntrySchema = z.object({
  id: z.string(),
  seq: z.number().int().nonnegative(),
  kind: z.enum(['deposit', 'buy', 'sell', 'fee']),
  cash: z.number().int(),
  shares: z.number().int(),
  price: z.number().int().optional(),
  orderId: z.string().optional(),
  tradeId: z.string().optional(),
  note: z.string(),
});
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;

export const planSchema = z.object({
  id: z.string(),
  createdAtSeq: z.number().int(),
  entryType: z.enum(['market', 'limit']),
  referencePrice: z.number().int(),
  stop: z.number().int().optional(),
  target: z.number().int().optional(),
  qty: z.number().int().positive(),
  rationale: z.array(z.string()),
  note: z.string(),
  estimatedRiskWithCosts: z.number().int().nullable(),
  estimatedRewardAfterCosts: z.number().int().nullable(),
});
export type Plan = z.infer<typeof planSchema>;

export const tradeSchema = z.object({
  id: z.string(),
  scenarioId: z.string(),
  scenarioVersion: z.number().int(),
  planId: z.string(),
  entryOrderId: z.string(),
  entrySeq: z.number().int(),
  entryPrice: z.number().int(),
  qty: z.number().int().positive(),
  entryFee: z.number().int(),
  initialStop: z.number().int().nullable(),
  /** Frozen at entry: (entry fill − original stop) × filled shares. Null when undefined. */
  initialRisk: z.number().int().nullable(),
  stopHistory: z.array(z.object({ seq: z.number().int(), price: z.number().int().nullable() })),
  status: z.enum(['open', 'closed']),
  exitSeq: z.number().int().optional(),
  exitPrice: z.number().int().optional(),
  exitFee: z.number().int().optional(),
  exitReason: z.enum(['stop', 'target', 'manual', 'scenario-end']).optional(),
});
export type Trade = z.infer<typeof tradeSchema>;

export const simStateSchema = z.object({
  scenarioId: z.string(),
  scenarioVersion: z.number().int(),
  /** Index into the event array of the most recent event revealed and processed. */
  cursor: z.number().int().nonnegative(),
  lastProcessedSeq: z.number().int().nonnegative(),
  assumptions: assumptionsSchema,
  orders: z.array(orderSchema),
  ledger: z.array(ledgerEntrySchema),
  plans: z.array(planSchema),
  trades: z.array(tradeSchema),
  nextId: z.number().int().positive(),
  ended: z.boolean(),
  runId: z.string(),
});
export type SimState = z.infer<typeof simStateSchema>;

export interface Balances {
  cash: number;
  reserved: number;
  available: number;
  shares: number;
  costBasis: number;
  positionValue: number;
  equity: number;
  realizedPnl: number;
  unrealizedPnl: number;
  feesPaid: number;
  markPrice: number;
}

export interface SimResult {
  state: SimState;
  ok: boolean;
  message: string;
  notices: string[];
  closedTradeIds: string[];
}

export function eventsFor(state: Pick<SimState, 'scenarioId'>): QuoteEvent[] {
  const s = getScenario(state.scenarioId);
  if (!s) throw new Error(`Unknown scenario ${state.scenarioId}`);
  return generateEvents(s);
}

export function currentEvent(state: SimState): QuoteEvent {
  const e = eventsFor(state)[state.cursor];
  if (!e) throw new Error('Replay cursor out of range');
  return e;
}

/** Only events up to and including the cursor. */
export function visibleEvents(state: SimState): QuoteEvent[] {
  return eventsFor(state).slice(0, state.cursor + 1);
}

export function createSim(scenarioId: string, assumptions: Assumptions = DEFAULT_ASSUMPTIONS, runId = `run-${Date.now()}`): SimState {
  const s = getScenario(scenarioId);
  if (!s) throw new Error(`Unknown scenario ${scenarioId}`);
  const events = generateEvents(s);
  const cursor = Math.min(s.warmupEvents ?? 0, events.length - 2);
  return {
    scenarioId,
    scenarioVersion: s.version,
    cursor,
    lastProcessedSeq: events[cursor]!.seq,
    assumptions,
    orders: [],
    ledger: [{ id: 'l1', seq: 0, kind: 'deposit', cash: STARTING_CASH_CENTS, shares: 0, note: 'Virtual training balance' }],
    plans: [],
    trades: [],
    nextId: 2,
    ended: false,
    runId,
  };
}

function nextId(state: SimState, prefix: string): [string, SimState] {
  return [`${prefix}${state.nextId}`, { ...state, nextId: state.nextId + 1 }];
}

export function openTrade(state: SimState): Trade | undefined {
  return state.trades.find((t) => t.status === 'open');
}

export function pendingOrders(state: SimState): Order[] {
  return state.orders.filter((o) => o.status === 'pending');
}

export function balances(state: SimState, mark?: QuoteEvent): Balances {
  const ev = mark ?? currentEvent(state);
  const cash = state.ledger.reduce((s, l) => s + l.cash, 0);
  const shares = state.ledger.reduce((s, l) => s + l.shares, 0);
  const reserved = pendingOrders(state).reduce((s, o) => s + o.reserved, 0);
  const feesPaid = -state.ledger.filter((l) => l.kind === 'fee').reduce((s, l) => s + l.cash, 0);
  const trade = openTrade(state);
  const costBasis = trade ? trade.entryPrice * trade.qty : 0;
  const positionValue = shares * ev.bid;
  const realizedPnl = state.trades
    .filter((t) => t.status === 'closed')
    .reduce((s, t) => s + tradeNet(state.ledger, t.id), 0);
  const unrealizedPnl = shares > 0 ? positionValue - costBasis : 0;
  return {
    cash,
    reserved,
    available: cash - reserved,
    shares,
    costBasis,
    positionValue,
    equity: cash + positionValue,
    realizedPnl,
    unrealizedPnl,
    feesPaid,
    markPrice: ev.bid,
  };
}

/** Net cash result of a trade from its ledger lines (buy cost, sale proceeds and fees). */
export function tradeNet(ledger: LedgerEntry[], tradeId: string): number {
  return ledger.filter((l) => l.tradeId === tradeId).reduce((s, l) => s + l.cash, 0);
}

function reject(state: SimState, message: string): SimResult {
  return { state, ok: false, message, notices: [], closedTradeIds: [] };
}

export interface EntryRequest {
  type: 'market' | 'limit';
  qty: number;
  limitPrice?: number;
  stop?: number;
  target?: number;
  rationale: string[];
  note: string;
}

export function estimateEntry(state: SimState, req: Pick<EntryRequest, 'type' | 'qty' | 'limitPrice' | 'stop' | 'target'>) {
  const ev = currentEvent(state);
  const { feePerFill, slippagePerShare } = state.assumptions;
  const ref = req.type === 'limit' && req.limitPrice ? req.limitPrice : ev.ask + slippagePerShare;
  const reserve = req.qty * ref + feePerFill;
  const risk =
    req.stop !== undefined ? (ref - req.stop) * req.qty + req.qty * slippagePerShare + 2 * feePerFill : null;
  const reward = req.target !== undefined ? (req.target - ref) * req.qty - 2 * feePerFill : null;
  return { referencePrice: ref, reserve, estimatedRiskWithCosts: risk, estimatedRewardAfterCosts: reward };
}

export function placeEntry(state: SimState, req: EntryRequest): SimResult {
  if (state.ended) return reject(state, 'This scenario has ended. Start a new run to keep practicing.');
  if (openTrade(state)) return reject(state, 'You already hold a position. This simulator allows one position at a time.');
  if (pendingOrders(state).some((o) => o.role === 'entry')) return reject(state, 'You already have a pending buy order. Cancel it first.');
  if (!Number.isInteger(req.qty) || req.qty < 1) return reject(state, 'Enter a whole number of shares, at least 1.');
  if (req.type === 'limit' && (!req.limitPrice || req.limitPrice <= 0)) return reject(state, 'Enter a limit price above $0.');

  const ev = currentEvent(state);
  const est = estimateEntry(state, req);
  const ref = est.referencePrice;
  if (req.stop !== undefined && req.stop >= ref)
    return reject(state, `A protective stop must be below your expected entry (${formatMoney(ref)}).`);
  if (req.stop !== undefined && req.stop <= 0) return reject(state, 'The stop price must be above $0.');
  if (req.target !== undefined && req.target <= ref)
    return reject(state, `A take-profit target must be above your expected entry (${formatMoney(ref)}).`);

  const b = balances(state, ev);
  if (est.reserve > b.available) {
    return reject(
      state,
      `Not enough virtual cash. This order needs about ${formatMoney(est.reserve)} including the fee and slippage allowance, and ${formatMoney(b.available)} is available.`,
    );
  }

  let s = state;
  let planId: string;
  let orderId: string;
  [planId, s] = nextId(s, 'p');
  [orderId, s] = nextId(s, 'o');

  const plan: Plan = {
    id: planId,
    createdAtSeq: ev.seq,
    entryType: req.type,
    referencePrice: ref,
    stop: req.stop,
    target: req.target,
    qty: req.qty,
    rationale: req.rationale,
    note: req.note.slice(0, 500),
    estimatedRiskWithCosts: est.estimatedRiskWithCosts,
    estimatedRewardAfterCosts: est.estimatedRewardAfterCosts,
  };

  const order: Order = {
    id: orderId,
    role: 'entry',
    side: 'buy',
    type: req.type,
    qty: req.qty,
    price: req.type === 'limit' ? req.limitPrice : undefined,
    status: 'pending',
    placedAtSeq: ev.seq,
    reserved: est.reserve,
    message:
      req.type === 'market'
        ? 'Waiting for the next quote. A market buy fills at the next ask plus slippage.'
        : `Waiting until the ask is at or below ${formatMoney(req.limitPrice!)}.`,
    planId,
    attachStop: req.stop,
    attachTarget: req.target,
  };

  s = { ...s, plans: [...s.plans, plan], orders: [...s.orders, order] };
  return { state: s, ok: true, message: order.message, notices: [], closedTradeIds: [] };
}

export function cancelOrder(state: SimState, orderId: string): SimResult {
  const o = state.orders.find((x) => x.id === orderId);
  if (!o || o.status !== 'pending') return reject(state, 'That order is no longer pending.');
  const ev = currentEvent(state);
  const orders = state.orders.map((x) =>
    x.id === orderId ? { ...x, status: 'canceled' as const, closedAtSeq: ev.seq, reserved: 0, message: 'Canceled by you before it filled.' } : x,
  );
  let s: SimState = { ...state, orders };
  if (o.role === 'stop') s = recordStopChange(s, ev.seq, null);
  return { state: s, ok: true, message: 'Order canceled. Any reserved cash is available again.', notices: [], closedTradeIds: [] };
}

function recordStopChange(state: SimState, seq: number, price: number | null): SimState {
  const t = openTrade(state);
  if (!t) return state;
  return {
    ...state,
    trades: state.trades.map((x) => (x.id === t.id ? { ...x, stopHistory: [...x.stopHistory, { seq, price }] } : x)),
  };
}

/** Place or replace the protective sell stop for the open position. */
export function setStop(state: SimState, price: number): SimResult {
  const t = openTrade(state);
  if (!t) return reject(state, 'There is no open position to protect.');
  const ev = currentEvent(state);
  if (!Number.isInteger(price) || price <= 0) return reject(state, 'Enter a stop price above $0.');
  if (price >= ev.bid) return reject(state, `A sell stop must be below the current bid (${formatMoney(ev.bid)}); otherwise it would trigger at once.`);
  const target = pendingOrders(state).find((o) => o.role === 'target');
  if (target?.price !== undefined && price >= target.price) return reject(state, 'The stop must be below your take-profit target.');
  let s = state;
  const old = pendingOrders(s).find((o) => o.role === 'stop');
  if (old) s = cancelOrder(s, old.id).state;
  let id: string;
  [id, s] = nextId(s, 'o');
  const order: Order = {
    id,
    role: 'stop',
    side: 'sell',
    type: 'stop',
    qty: t.qty,
    price,
    status: 'pending',
    placedAtSeq: ev.seq,
    reserved: 0,
    message: `Protective stop: if the bid falls to ${formatMoney(price)} or lower, sell all shares at the next available bid.`,
    tradeId: t.id,
  };
  s = recordStopChange({ ...s, orders: [...s.orders, order] }, ev.seq, price);
  return { state: s, ok: true, message: order.message, notices: [], closedTradeIds: [] };
}

export function setTarget(state: SimState, price: number): SimResult {
  const t = openTrade(state);
  if (!t) return reject(state, 'There is no open position.');
  const ev = currentEvent(state);
  if (!Number.isInteger(price) || price <= 0) return reject(state, 'Enter a target price above $0.');
  if (price <= ev.bid) return reject(state, `A take-profit limit must be above the current bid (${formatMoney(ev.bid)}).`);
  const stop = pendingOrders(state).find((o) => o.role === 'stop');
  if (stop?.price !== undefined && price <= stop.price) return reject(state, 'The target must be above your stop.');
  let s = state;
  const old = pendingOrders(s).find((o) => o.role === 'target');
  if (old) s = cancelOrder(s, old.id).state;
  let id: string;
  [id, s] = nextId(s, 'o');
  const order: Order = {
    id,
    role: 'target',
    side: 'sell',
    type: 'limit',
    qty: t.qty,
    price,
    status: 'pending',
    placedAtSeq: ev.seq,
    reserved: 0,
    message: `Take-profit: sell all shares if the bid reaches ${formatMoney(price)} or higher.`,
    tradeId: t.id,
  };
  s = { ...s, orders: [...s.orders, order] };
  return { state: s, ok: true, message: order.message, notices: [], closedTradeIds: [] };
}

/** Market exit of the full position. Linked stop and target are canceled so shares cannot be sold twice. */
export function placeMarketExit(state: SimState): SimResult {
  const t = openTrade(state);
  if (!t) return reject(state, 'There is no open position to sell.');
  if (pendingOrders(state).some((o) => o.role === 'exit')) return reject(state, 'A sell order is already waiting for the next quote.');
  const ev = currentEvent(state);
  let s = state;
  for (const o of pendingOrders(s)) {
    if (o.role === 'stop' || o.role === 'target') {
      s = {
        ...s,
        orders: s.orders.map((x) =>
          x.id === o.id ? { ...x, status: 'canceled' as const, closedAtSeq: ev.seq, message: 'Canceled because you chose to sell at market.' } : x,
        ),
      };
    }
  }
  let id: string;
  [id, s] = nextId(s, 'o');
  const order: Order = {
    id,
    role: 'exit',
    side: 'sell',
    type: 'market',
    qty: t.qty,
    status: 'pending',
    placedAtSeq: ev.seq,
    reserved: 0,
    message: 'Waiting for the next quote. A market sell fills at the next bid minus slippage.',
    tradeId: t.id,
  };
  s = { ...s, orders: [...s.orders, order] };
  return { state: s, ok: true, message: order.message, notices: [], closedTradeIds: [] };
}

function fillSell(s: SimState, order: Order, ev: QuoteEvent, price: number, reason: Trade['exitReason'], note: string): SimState {
  const t = s.trades.find((x) => x.id === order.tradeId);
  if (!t || t.status !== 'open') return s;
  const fee = s.assumptions.feePerFill;
  let lid1: string;
  let lid2: string;
  [lid1, s] = nextId(s, 'l');
  [lid2, s] = nextId(s, 'l');
  const ledger: LedgerEntry[] = [
    ...s.ledger,
    { id: lid1, seq: ev.seq, kind: 'sell', cash: price * t.qty, shares: -t.qty, price, orderId: order.id, tradeId: t.id, note },
    { id: lid2, seq: ev.seq, kind: 'fee', cash: -fee, shares: 0, orderId: order.id, tradeId: t.id, note: 'Training fee on sale' },
  ];
  const orders = s.orders.map((o) => {
    if (o.id === order.id) return { ...o, status: 'filled' as const, closedAtSeq: ev.seq, fillPrice: price, fee, message: note };
    if (o.status === 'pending' && o.tradeId === t.id)
      return { ...o, status: 'canceled' as const, closedAtSeq: ev.seq, message: 'Canceled automatically because the position was closed (one exit cancels the other).' };
    return o;
  });
  const trades = s.trades.map((x) =>
    x.id === t.id ? { ...x, status: 'closed' as const, exitSeq: ev.seq, exitPrice: price, exitFee: fee, exitReason: reason } : x,
  );
  return { ...s, ledger, orders, trades };
}

/**
 * Apply one quote event. Events at or before the last processed sequence are
 * ignored, so replaying or double-applying an event can never create a
 * duplicate fill.
 */
export function applyEvent(state: SimState, ev: QuoteEvent): SimResult {
  if (ev.seq <= state.lastProcessedSeq) {
    return { state, ok: false, message: 'Event already processed.', notices: [], closedTradeIds: [] };
  }
  const events = eventsFor(state);
  const index = events.findIndex((e) => e.seq === ev.seq);
  if (index !== state.cursor + 1) {
    return { state, ok: false, message: 'Events must be applied in order.', notices: [], closedTradeIds: [] };
  }

  let s: SimState = state;
  const notices: string[] = [];
  const closed: string[] = [];
  const { slippagePerShare, feePerFill } = s.assumptions;
  const eligible = (o: Order) => o.status === 'pending' && o.placedAtSeq < ev.seq;

  const trade = openTrade(s);
  if (trade) {
    const exit = s.orders.find((o) => eligible(o) && o.role === 'exit');
    const stop = s.orders.find((o) => eligible(o) && o.role === 'stop');
    const target = s.orders.find((o) => eligible(o) && o.role === 'target');
    if (exit) {
      const price = Math.max(1, ev.bid - slippagePerShare);
      s = fillSell(s, exit, ev, price, 'manual', `Market sell filled at ${formatMoney(price)} (bid ${formatMoney(ev.bid)} minus ${slippagePerShare}¢ slippage).`);
      notices.push(`Sold ${trade.qty} shares at ${formatMoney(price)}.`);
      closed.push(trade.id);
    } else if (stop && stop.price !== undefined && ev.bid <= stop.price) {
      const price = Math.max(1, ev.bid - slippagePerShare);
      const gapped = ev.bid < stop.price;
      const note = gapped
        ? `Stop at ${formatMoney(stop.price)} triggered when the bid gapped to ${formatMoney(ev.bid)}. Filled at ${formatMoney(price)}, below the stop price.`
        : `Stop at ${formatMoney(stop.price)} triggered. Filled at ${formatMoney(price)} (bid minus slippage).`;
      s = fillSell(s, stop, ev, price, 'stop', note);
      notices.push(note);
      closed.push(trade.id);
    } else if (target && target.price !== undefined && ev.bid >= target.price) {
      const price = ev.bid;
      const note = `Take-profit limit at ${formatMoney(target.price)} filled at ${formatMoney(price)}.`;
      s = fillSell(s, target, ev, price, 'target', note);
      notices.push(note);
      closed.push(trade.id);
    }
  } else {
    const entry = s.orders.find((o) => eligible(o) && o.role === 'entry');
    if (entry) {
      let price: number | null = null;
      if (entry.type === 'market') price = ev.ask + slippagePerShare;
      else if (entry.price !== undefined && ev.ask <= entry.price) price = ev.ask;

      if (price !== null) {
        const cost = price * entry.qty + feePerFill;
        const cash = s.ledger.reduce((sum, l) => sum + l.cash, 0);
        const otherReserved = pendingOrders(s)
          .filter((o) => o.id !== entry.id)
          .reduce((sum, o) => sum + o.reserved, 0);
        if (cost > cash - otherReserved) {
          const msg = `Rejected at execution: the fill would cost ${formatMoney(cost)} but only ${formatMoney(cash - otherReserved)} is available.`;
          s = {
            ...s,
            orders: s.orders.map((o) => (o.id === entry.id ? { ...o, status: 'rejected' as const, closedAtSeq: ev.seq, reserved: 0, message: msg } : o)),
          };
          notices.push(msg);
        } else {
          let tradeId: string;
          let lid1: string;
          let lid2: string;
          [tradeId, s] = nextId(s, 't');
          [lid1, s] = nextId(s, 'l');
          [lid2, s] = nextId(s, 'l');
          const initialStop = entry.attachStop ?? null;
          const initialRisk = initialStop !== null && price - initialStop > 0 ? (price - initialStop) * entry.qty : null;
          const note =
            entry.type === 'market'
              ? `Market buy filled at ${formatMoney(price)} (ask ${formatMoney(ev.ask)} plus ${slippagePerShare}¢ slippage).`
              : `Limit buy filled at ${formatMoney(price)}, at or below your ${formatMoney(entry.price!)} limit.`;
          const newTrade: Trade = {
            id: tradeId,
            scenarioId: s.scenarioId,
            scenarioVersion: s.scenarioVersion,
            planId: entry.planId ?? '',
            entryOrderId: entry.id,
            entrySeq: ev.seq,
            entryPrice: price,
            qty: entry.qty,
            entryFee: feePerFill,
            initialStop,
            initialRisk,
            stopHistory: [],
            status: 'open',
          };
          s = {
            ...s,
            ledger: [
              ...s.ledger,
              { id: lid1, seq: ev.seq, kind: 'buy', cash: -price * entry.qty, shares: entry.qty, price, orderId: entry.id, tradeId, note },
              { id: lid2, seq: ev.seq, kind: 'fee', cash: -feePerFill, shares: 0, orderId: entry.id, tradeId, note: 'Training fee on purchase' },
            ],
            orders: s.orders.map((o) =>
              o.id === entry.id ? { ...o, status: 'filled' as const, closedAtSeq: ev.seq, fillPrice: price, fee: feePerFill, reserved: 0, message: note, tradeId } : o,
            ),
            trades: [...s.trades, newTrade],
          };
          notices.push(`Bought ${entry.qty} shares at ${formatMoney(price)}.`);
          if (entry.attachStop !== undefined) {
            let sid: string;
            [sid, s] = nextId(s, 'o');
            s = {
              ...s,
              orders: [
                ...s.orders,
                {
                  id: sid,
                  role: 'stop',
                  side: 'sell',
                  type: 'stop',
                  qty: entry.qty,
                  price: entry.attachStop,
                  status: 'pending',
                  placedAtSeq: ev.seq,
                  reserved: 0,
                  message: `Protective stop: if the bid falls to ${formatMoney(entry.attachStop)} or lower, sell at the next available bid.`,
                  tradeId,
                },
              ],
              trades: s.trades.map((x) => (x.id === tradeId ? { ...x, stopHistory: [{ seq: ev.seq, price: entry.attachStop! }] } : x)),
            };
          }
          if (entry.attachTarget !== undefined) {
            let tid: string;
            [tid, s] = nextId(s, 'o');
            s = {
              ...s,
              orders: [
                ...s.orders,
                {
                  id: tid,
                  role: 'target',
                  side: 'sell',
                  type: 'limit',
                  qty: entry.qty,
                  price: entry.attachTarget,
                  status: 'pending',
                  placedAtSeq: ev.seq,
                  reserved: 0,
                  message: `Take-profit: sell if the bid reaches ${formatMoney(entry.attachTarget)} or higher.`,
                  tradeId,
                },
              ],
            };
          }
        }
      }
    }
  }

  if (ev.final) {
    const t = openTrade(s);
    if (t) {
      const price = Math.max(1, ev.bid - slippagePerShare);
      let oid: string;
      [oid, s] = nextId(s, 'o');
      const forced: Order = {
        id: oid,
        role: 'exit',
        side: 'sell',
        type: 'market',
        qty: t.qty,
        status: 'pending',
        placedAtSeq: ev.seq,
        reserved: 0,
        message: 'Scenario ended',
        tradeId: t.id,
      };
      s = { ...s, orders: [...s.orders, forced] };
      const note = `Scenario ended. The open position was sold at the final bid minus slippage, ${formatMoney(price)}.`;
      s = fillSell(s, forced, ev, price, 'scenario-end', note);
      notices.push(note);
      closed.push(t.id);
    }
    s = {
      ...s,
      ended: true,
      orders: s.orders.map((o) =>
        o.status === 'pending' ? { ...o, status: 'canceled' as const, closedAtSeq: ev.seq, reserved: 0, message: 'Canceled because the scenario ended.' } : o,
      ),
    };
    notices.push('This synthetic scenario has ended.');
  }

  s = { ...s, cursor: index, lastProcessedSeq: ev.seq };
  return { state: s, ok: true, message: notices[0] ?? '', notices, closedTradeIds: closed };
}

/** Reveal and process the next event, if any. */
export function stepSim(state: SimState): SimResult {
  const next = eventsFor(state)[state.cursor + 1];
  if (!next || state.ended) return { state, ok: false, message: 'No more events in this scenario.', notices: [], closedTradeIds: [] };
  return applyEvent(state, next);
}

export function hasMoreEvents(state: SimState): boolean {
  return !state.ended && state.cursor + 1 < eventsFor(state).length;
}

/** Validate a restored snapshot against its deterministic event stream. */
export function checkSimIntegrity(state: SimState): string[] {
  const problems: string[] = [];
  const scenario = getScenario(state.scenarioId);
  if (!scenario) return ['Unknown scenario'];
  if (scenario.version !== state.scenarioVersion) problems.push('Scenario version changed');
  const events = generateEvents(scenario);
  const ev = events[state.cursor];
  if (!ev) problems.push('Cursor beyond scenario');
  else if (ev.seq !== state.lastProcessedSeq) problems.push('Cursor and processed sequence disagree');
  const cash = state.ledger.reduce((s, l) => s + l.cash, 0);
  const shares = state.ledger.reduce((s, l) => s + l.shares, 0);
  if (cash < 0) problems.push('Negative cash');
  if (shares < 0) problems.push('Negative shares');
  const open = state.trades.filter((t) => t.status === 'open');
  if (open.length > 1) problems.push('More than one open position');
  if ((open[0]?.qty ?? 0) !== shares) problems.push('Shares do not match open position');
  const filledIds = state.ledger.filter((l) => l.kind === 'buy' || l.kind === 'sell').map((l) => l.orderId);
  if (new Set(filledIds).size !== filledIds.length) problems.push('Duplicate fill');
  return problems;
}
