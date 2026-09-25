import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowClockwise, FastForward, Info, Pause, Play, SkipForward, Warning } from '@phosphor-icons/react';
import { useAppState, syncJournal } from '../state/app';
import { appStore } from '../storage/store';
import {
  balances,
  cancelOrder,
  createSim,
  currentEvent,
  estimateEntry,
  eventsFor,
  hasMoreEvents,
  openTrade,
  pendingOrders,
  placeEntry,
  placeMarketExit,
  setStop,
  setTarget,
  stepSim,
  visibleEvents,
  type SimResult,
  type SimState,
} from '../sim/engine';
import { EVENTS_PER_CANDLE, SCENARIOS, buildCandles, formatTrainingTime, getInstrument, getScenario } from '../sim/scenarios';
import { formatMoney, parseDollars, describeChange } from '../domain/money';
import { STARTING_CASH_CENTS } from '../config/app';
import { Page, SimBadge, usePageTitle } from '../components/Page';
import { CandleChart, type ChartLevel } from '../components/CandleChart';
import { Dialog } from '../components/Dialog';

const TICK_MS = 800;
const WINDOW = 36;

export const RATIONALES = [
  'Uptrend: higher highs and higher lows',
  'Bounce from a support zone',
  'Breakout above resistance',
  'Testing how the order types work',
];

function Money({ cents, signed }: { cents: number; signed?: boolean }) {
  if (!signed) return <span className="num">{formatMoney(cents)}</span>;
  const c = describeChange(cents);
  return (
    <span className={`num ${c.direction}`}>
      {c.direction === 'up' ? '▲ ' : c.direction === 'down' ? '▼ ' : ''}
      {c.text}
      <span className="visually-hidden"> {c.word}</span>
    </span>
  );
}

function ScenarioPicker() {
  const { settings, journal } = useAppState();
  return (
    <Page
      title="Simulator"
      intro={
        <>
          Practice placing orders on synthetic price data. You start each run with {formatMoney(STARTING_CASH_CENTS)} of virtual money. <strong>No real trades happen here.</strong>
        </>
      }
    >
      <ul className="list grid-2" style={{ marginBottom: 'var(--space-5)' }}>
        {SCENARIOS.filter((s) => !s.id.startsWith('test-')).map((s) => {
          const inst = getInstrument(s.instrumentId);
          return (
            <li key={s.id} className="card stack-sm">
              <SimBadge />
              <h2 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>{s.title}</h2>
              <p className="small muted" style={{ margin: 0 }}>
                {inst?.symbol} · {inst?.name} (fictional)
              </p>
              <p className="small" style={{ margin: 0 }}>
                {s.description}
              </p>
              <button type="button" className="btn btn-primary" onClick={() => appStore.update('sim', () => createSim(s.id, settings.simAssumptions))}>
                Start this run
              </button>
            </li>
          );
        })}
      </ul>
      {journal.entries.length ? (
        <p className="small muted">
          Your {journal.entries.length} journaled trade{journal.entries.length === 1 ? '' : 's'} stay in the <Link to="/journal">Journal</Link> when you start a new run.
        </p>
      ) : null}
      <SimLimits />
    </Page>
  );
}

function SimLimits() {
  const { settings } = useAppState();
  return (
    <details className="disclosure">
      <summary>
        <Info size={18} aria-hidden /> How this simulator works, and its limits
      </summary>
      <div className="disclosure-body small">
        <ul>
          <li>Prices are synthetic and generated from a fixed seed. They are not real market data and don’t predict anything.</li>
          <li>Quotes arrive one at a time. Orders are only checked against quotes that arrive after you place them, so you can’t trade on a price you already saw.</li>
          <li>Buys fill at the ask and sells at the bid. Market orders and triggered stops also pay {formatMoney(settings.simAssumptions.slippagePerShare)} slippage per share.</li>
          <li>Every fill costs a {formatMoney(settings.simAssumptions.feePerFill)} training fee. Real costs vary by broker; change these assumptions in Settings.</li>
          <li>If price gaps past your stop, the stop fills at the next available bid, which can be well below the stop price.</li>
          <li>Long positions only, whole shares, one position at a time, no borrowing or margin, no short selling, no taxes.</li>
          <li>Real markets have partial fills, queues, halts and much more. Treat results here as practice for the process, not a measure of skill.</li>
        </ul>
      </div>
    </details>
  );
}

function OrderTicket({ sim, onResult }: { sim: SimState; onResult: (r: SimResult) => void }) {
  const ev = currentEvent(sim);
  const [type, setType] = useState<'market' | 'limit'>('market');
  const [qty, setQty] = useState('10');
  const [limit, setLimit] = useState(formatMoney(ev.bid).replace('$', ''));
  const [stop, setStopText] = useState('');
  const [target, setTargetText] = useState('');
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ids = { type: useId(), qty: useId(), limit: useId(), stop: useId(), target: useId(), note: useId() };

  const qtyN = /^\d+$/.test(qty.trim()) ? Number(qty) : NaN;
  const limitC = parseDollars(limit);
  const stopC = stop.trim() ? parseDollars(stop) : undefined;
  const targetC = target.trim() ? parseDollars(target) : undefined;
  const est =
    Number.isInteger(qtyN) && qtyN > 0 && (type === 'market' || limitC)
      ? estimateEntry(sim, { type, qty: qtyN, limitPrice: limitC ?? undefined, stop: stopC ?? undefined, target: targetC ?? undefined })
      : null;

  const submit = () => {
    setError(null);
    if (!Number.isInteger(qtyN) || qtyN < 1) return setError('Enter a whole number of shares, at least 1.');
    if (type === 'limit' && !limitC) return setError('Enter a limit price such as 20.50.');
    if (stop.trim() && stopC === null) return setError('The stop price doesn’t look like a dollar amount.');
    if (target.trim() && targetC === null) return setError('The target price doesn’t look like a dollar amount.');
    const r = placeEntry(sim, { type, qty: qtyN, limitPrice: limitC ?? undefined, stop: stopC ?? undefined, target: targetC ?? undefined, rationale: reasons, note });
    if (!r.ok) setError(r.message);
    onResult(r);
  };

  return (
    <section className="card stack" aria-labelledby="ticket-h">
      <h2 id="ticket-h" style={{ fontSize: 'var(--text-lg)', margin: 0 }}>
        Plan and place a buy
      </h2>
      <fieldset>
        <legend>Order type</legend>
        <div className="segmented">
          <label>
            <input type="radio" name={ids.type} checked={type === 'market'} onChange={() => setType('market')} /> Market
          </label>
          <label>
            <input type="radio" name={ids.type} checked={type === 'limit'} onChange={() => setType('limit')} /> Limit
          </label>
        </div>
        <p className="hint" style={{ marginTop: 6 }}>
          {type === 'market' ? 'Fills at the next ask plus slippage.' : 'Fills only if the ask reaches your limit or lower.'}
        </p>
      </fieldset>
      <div className="grid-2">
        <div className="field">
          <label htmlFor={ids.qty}>Shares</label>
          <input id={ids.qty} className="input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        {type === 'limit' ? (
          <div className="field">
            <label htmlFor={ids.limit}>Limit price</label>
            <div className="input-affix">
              <span className="affix">$</span>
              <input id={ids.limit} className="input" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} />
            </div>
          </div>
        ) : null}
        <div className="field">
          <label htmlFor={ids.stop}>Protective stop (recommended)</label>
          <div className="input-affix">
            <span className="affix">$</span>
            <input id={ids.stop} className="input" inputMode="decimal" value={stop} placeholder="e.g. below support" onChange={(e) => setStopText(e.target.value)} aria-describedby={`${ids.stop}-h`} />
          </div>
          <span id={`${ids.stop}-h`} className="hint">
            Where your idea is proven wrong.
          </span>
        </div>
        <div className="field">
          <label htmlFor={ids.target}>Take-profit target (optional)</label>
          <div className="input-affix">
            <span className="affix">$</span>
            <input id={ids.target} className="input" inputMode="decimal" value={target} onChange={(e) => setTargetText(e.target.value)} />
          </div>
        </div>
      </div>
      <fieldset>
        <legend>Why this trade? (choose any)</legend>
        <div className="options">
          {RATIONALES.map((r) => (
            <label key={r} className="option" style={{ padding: '8px 12px' }}>
              <input type="checkbox" checked={reasons.includes(r)} onChange={(e) => setReasons((cur) => (e.target.checked ? [...cur, r] : cur.filter((x) => x !== r)))} />
              <span className="small">{r}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor={ids.note}>Plan note (optional)</label>
        <textarea id={ids.note} className="input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {est ? (
        <dl className="kv small" aria-live="polite">
          <dt>Cash set aside while pending</dt>
          <dd>{formatMoney(est.reserve)}</dd>
          <dt>Estimated risk to stop, incl. costs</dt>
          <dd>{est.estimatedRiskWithCosts !== null ? formatMoney(est.estimatedRiskWithCosts) : 'No stop set'}</dd>
          <dt>Estimated reward to target, after costs</dt>
          <dd>{est.estimatedRewardAfterCosts !== null ? formatMoney(est.estimatedRewardAfterCosts) : 'No target set'}</dd>
        </dl>
      ) : null}
      {!stop.trim() ? (
        <p className="notice notice-warn small" style={{ margin: 0 }}>
          <Warning size={18} aria-hidden style={{ flex: 'none' }} /> Without a stop, your loss isn’t limited by a plan, and the journal can’t calculate R.
        </p>
      ) : null}
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      <button type="button" className="btn btn-primary" onClick={submit}>
        Place buy order
      </button>
      <p className="hint" style={{ margin: 0 }}>
        The order is checked on the next quote, never on the one you see now.
      </p>
    </section>
  );
}

function PositionPanel({ sim, onResult }: { sim: SimState; onResult: (r: SimResult) => void }) {
  const t = openTrade(sim)!;
  const b = balances(sim);
  const stopO = pendingOrders(sim).find((o) => o.role === 'stop');
  const targetO = pendingOrders(sim).find((o) => o.role === 'target');
  const exitPending = pendingOrders(sim).some((o) => o.role === 'exit');
  const [stopText, setStopText] = useState(stopO?.price ? formatMoney(stopO.price).replace('$', '') : '');
  const [targetText, setTargetText] = useState(targetO?.price ? formatMoney(targetO.price).replace('$', '') : '');
  const [msg, setMsg] = useState<string | null>(null);
  const ids = { stop: useId(), target: useId() };
  const run = (r: SimResult) => {
    setMsg(r.message);
    onResult(r);
  };
  return (
    <section className="card stack" aria-labelledby="pos-h">
      <h2 id="pos-h" style={{ fontSize: 'var(--text-lg)', margin: 0 }}>
        Your position
      </h2>
      <dl className="kv">
        <dt>Shares</dt>
        <dd>{t.qty}</dd>
        <dt>Entry fill</dt>
        <dd>{formatMoney(t.entryPrice)}</dd>
        <dt>Marked at bid</dt>
        <dd>{formatMoney(b.markPrice)}</dd>
        <dt>Unrealized P&amp;L (before exit fee)</dt>
        <dd>
          <Money cents={b.unrealizedPnl} signed />
        </dd>
        <dt>Initial risk (frozen)</dt>
        <dd>{t.initialRisk !== null ? formatMoney(t.initialRisk) : 'Unavailable (no stop at entry)'}</dd>
        <dt>Stop</dt>
        <dd>{stopO?.price ? formatMoney(stopO.price) : 'None'}</dd>
        <dt>Target</dt>
        <dd>{targetO?.price ? formatMoney(targetO.price) : 'None'}</dd>
      </dl>
      {exitPending ? (
        <p className="notice notice-info small" style={{ margin: 0 }}>
          A market sell is waiting for the next quote.
        </p>
      ) : (
        <>
          <div className="grid-2">
            <div className="field">
              <label htmlFor={ids.stop}>{stopO ? 'Move stop' : 'Add a stop'}</label>
              <div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}>
                <div className="input-affix" style={{ flex: 1 }}>
                  <span className="affix">$</span>
                  <input id={ids.stop} className="input" inputMode="decimal" value={stopText} onChange={(e) => setStopText(e.target.value)} />
                </div>
                <button type="button" className="btn" onClick={() => run(setStop(sim, parseDollars(stopText) ?? -1))}>
                  Set
                </button>
              </div>
            </div>
            <div className="field">
              <label htmlFor={ids.target}>{targetO ? 'Move target' : 'Add a target'}</label>
              <div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}>
                <div className="input-affix" style={{ flex: 1 }}>
                  <span className="affix">$</span>
                  <input id={ids.target} className="input" inputMode="decimal" value={targetText} onChange={(e) => setTargetText(e.target.value)} />
                </div>
                <button type="button" className="btn" onClick={() => run(setTarget(sim, parseDollars(targetText) ?? -1))}>
                  Set
                </button>
              </div>
            </div>
          </div>
          <p className="hint" style={{ margin: 0 }}>
            Moving a stop further away increases your risk; the journal records it.
          </p>
          <button type="button" className="btn btn-danger" onClick={() => run(placeMarketExit(sim))}>
            Sell all at market
          </button>
        </>
      )}
      {msg ? (
        <p className="small" role="status">
          {msg}
        </p>
      ) : null}
    </section>
  );
}

function AccountPanel({ sim }: { sim: SimState }) {
  const b = balances(sim);
  return (
    <section className="card" aria-labelledby="acct-h">
      <h2 id="acct-h" className="eyebrow">
        Virtual account
      </h2>
      <dl className="kv small">
        <dt>Cash</dt>
        <dd>{formatMoney(b.cash)}</dd>
        <dt>Reserved for pending buys</dt>
        <dd>{formatMoney(b.reserved)}</dd>
        <dt>Available</dt>
        <dd>{formatMoney(b.available)}</dd>
        <dt>Position value (at bid)</dt>
        <dd>{formatMoney(b.positionValue)}</dd>
        <dt>Equity</dt>
        <dd>{formatMoney(b.equity)}</dd>
        <dt>Realized P&amp;L (after costs)</dt>
        <dd>
          <Money cents={b.realizedPnl} signed />
        </dd>
        <dt>Unrealized P&amp;L</dt>
        <dd>
          <Money cents={b.unrealizedPnl} signed />
        </dd>
        <dt>Fees paid</dt>
        <dd>{formatMoney(b.feesPaid)}</dd>
      </dl>
      <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
        All balances come from the run’s ledger. Slippage is included in fill prices.
      </p>
    </section>
  );
}

function SimView({ sim }: { sim: SimState }) {
  usePageTitle('Simulator');
  const [playing, setPlaying] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [newJournal, setNewJournal] = useState<string[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);
  const scenario = getScenario(sim.scenarioId);
  const inst = scenario ? getInstrument(scenario.instrumentId) : undefined;
  const events = eventsFor(sim);
  const ev = currentEvent(sim);

  const apply = useCallback((r: SimResult) => {
    if (r.state !== appStore.getSnapshot().sim) appStore.update('sim', () => r.state);
    if (r.notices.length) setLog((l) => [...r.notices.slice().reverse(), ...l].slice(0, 30));
    if (r.closedTradeIds.length) {
      const created = syncJournal(r.state);
      if (created.length) {
        setNewJournal(created);
        setPlaying(false);
      }
    }
  }, []);

  const step = useCallback(
    (n = 1) => {
      for (let k = 0; k < n; k++) {
        const s = appStore.getSnapshot().sim;
        if (!s || !hasMoreEvents(s)) {
          setPlaying(false);
          return;
        }
        const r = stepSim(s);
        apply(r);
        if (r.closedTradeIds.length || r.notices.some((x) => /filled|triggered|bought|sold|rejected/i.test(x))) return;
      }
    },
    [apply],
  );

  useEffect(() => {
    syncJournal(sim);
    // Only on mount: recover journal entries if the tab closed between a fill and the journal write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => step(1), TICK_MS);
    return () => window.clearInterval(id);
  }, [playing, step]);

  useEffect(() => {
    const pause = () => {
      if (document.visibilityState === 'hidden') setPlaying(false);
    };
    const hide = () => setPlaying(false);
    document.addEventListener('visibilitychange', pause);
    window.addEventListener('pagehide', hide);
    return () => {
      document.removeEventListener('visibilitychange', pause);
      window.removeEventListener('pagehide', hide);
    };
  }, []);

  const allCandles = useMemo(() => buildCandles(visibleEvents(sim)), [sim]);
  const offset = Math.max(0, allCandles.length - WINDOW);
  const candles = allCandles.slice(offset);
  const trade = openTrade(sim);
  const pend = pendingOrders(sim);
  const levels: ChartLevel[] = [];
  if (trade) levels.push({ price: trade.entryPrice, label: `Entry ${formatMoney(trade.entryPrice)}`, tone: 'muted' });
  for (const o of pend) {
    if (o.price === undefined) continue;
    if (o.role === 'stop') levels.push({ price: o.price, label: `Stop ${formatMoney(o.price)}`, tone: 'down' });
    if (o.role === 'target') levels.push({ price: o.price, label: `Target ${formatMoney(o.price)}`, tone: 'up' });
    if (o.role === 'entry') levels.push({ price: o.price, label: `Buy limit ${formatMoney(o.price)}`, tone: 'accent' });
  }
  const finished = sim.ended || !hasMoreEvents(sim);
  const toCandleEnd = EVENTS_PER_CANDLE - ((sim.cursor + 1) % EVENTS_PER_CANDLE || EVENTS_PER_CANDLE) || EVENTS_PER_CANDLE;
  const history = sim.orders.filter((o) => o.status !== 'pending').slice().reverse().slice(0, 12);

  const reset = () => {
    syncJournal(appStore.getSnapshot().sim);
    appStore.update('sim', () => null);
    setConfirmReset(false);
  };

  return (
    <div className="page-wide">
      <header className="spread" style={{ marginBottom: 'var(--space-4)' }}>
        <div>
          <div className="row" style={{ gap: 8, marginBottom: 4 }}>
            <SimBadge />
            <span className="sim-badge">Virtual money</span>
          </div>
          <h1 style={{ marginBottom: 0 }}>
            {inst?.symbol} <span className="muted" style={{ fontWeight: 400, fontSize: 'var(--text-lg)' }}>{inst?.name} · {scenario?.title}</span>
          </h1>
        </div>
        <button type="button" className="btn btn-sm" onClick={() => setConfirmReset(true)}>
          <ArrowClockwise size={18} aria-hidden /> New run
        </button>
      </header>

      <div className="sim-layout">
        <div className="stack">
          <section className="card stack-sm" aria-label="Price chart and quote">
            <div className="spread small muted">
              <span className="num">{formatTrainingTime(ev, events)}</span>
              <span className="num">
                Quote {sim.cursor + 1} of {events.length}
              </span>
            </div>
            <CandleChart candles={candles} numberFrom={offset + 1} levels={levels} showVolume label={`Synthetic ${inst?.symbol ?? ''} price chart, ${candles.length} candles of ${EVENTS_PER_CANDLE} quotes each. Latest close ${formatMoney(ev.last)}.`} height={280} />
            <div className="quote-strip" aria-live="off">
              <div className="quote-cell">
                <div className="k">Bid (sell)</div>
                <div className="v">{formatMoney(ev.bid)}</div>
              </div>
              <div className="quote-cell">
                <div className="k">Ask (buy)</div>
                <div className="v">{formatMoney(ev.ask)}</div>
              </div>
              <div className="quote-cell">
                <div className="k">Spread</div>
                <div className="v">{formatMoney(ev.ask - ev.bid)}</div>
              </div>
              <div className="quote-cell">
                <div className="k">Last</div>
                <div className="v">{formatMoney(ev.last)}</div>
              </div>
            </div>
            <div className="player-controls" role="group" aria-label="Replay controls">
              <button type="button" className="btn btn-primary" disabled={finished} onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
                {playing ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />} {playing ? 'Pause' : 'Play'}
              </button>
              <button type="button" className="btn" disabled={finished || playing} onClick={() => step(1)}>
                <SkipForward size={18} aria-hidden /> Next quote
              </button>
              <button type="button" className="btn" disabled={finished || playing} onClick={() => step(toCandleEnd)}>
                <FastForward size={18} aria-hidden /> Finish candle
              </button>
            </div>
            <p className="hint" style={{ margin: 0 }}>
              Playback pauses when you switch tabs or apps. Stepping stops early when an order fills.
            </p>
          </section>

          {newJournal.length ? (
            <div className="notice notice-info" role="status">
              <div className="notice-body">
                <p>Trade closed. A journal entry was created automatically.</p>
                <div className="btn-row">
                  <Link to={`/journal/${encodeURIComponent(newJournal[newJournal.length - 1]!)}`} className="btn btn-sm btn-primary">
                    Review and reflect
                  </Link>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setNewJournal([])}>
                    Keep practicing
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {finished ? (
            <section className="card">
              <h2 style={{ fontSize: 'var(--text-lg)' }}>This scenario has ended</h2>
              <p className="small muted">Any open position was closed at the final bid minus slippage, and pending orders were canceled.</p>
              <div className="btn-row">
                <Link to="/journal" className="btn btn-primary">
                  Open journal
                </Link>
                <button type="button" className="btn" onClick={reset}>
                  Choose another scenario
                </button>
              </div>
            </section>
          ) : null}

          <section className="card" aria-labelledby="log-h">
            <h2 id="log-h" className="eyebrow">
              What just happened
            </h2>
            <div aria-live="polite">
              {log.length ? (
                <ul className="order-log">
                  {log.slice(0, 6).map((m, i) => (
                    <li key={`${i}-${m}`}>{m}</li>
                  ))}
                </ul>
              ) : (
                <p className="small muted" style={{ margin: 0 }}>
                  Fills, triggers and cancellations will be explained here.
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="stack">
          {!finished && !trade && !pend.some((o) => o.role === 'entry') ? <OrderTicket key={sim.runId + sim.orders.length} sim={sim} onResult={apply} /> : null}
          {trade ? <PositionPanel key={trade.id + pend.map((o) => o.id).join()} sim={sim} onResult={apply} /> : null}
          {pend.length ? (
            <section className="card" aria-labelledby="pend-h">
              <h2 id="pend-h" className="eyebrow">
                Pending orders
              </h2>
              <ul className="order-log">
                {pend.map((o) => (
                  <li key={o.id} className="spread">
                    <span>
                      <strong>
                        {o.role === 'entry' ? 'Buy' : o.role === 'stop' ? 'Stop' : o.role === 'target' ? 'Target' : 'Sell'} {o.qty} · {o.type}
                        {o.price ? ` ${formatMoney(o.price)}` : ''}
                      </strong>
                      <br />
                      <span className="muted">{o.message}</span>
                    </span>
                    {o.role !== 'exit' ? (
                      <button type="button" className="btn btn-sm" onClick={() => apply(cancelOrder(sim, o.id))} aria-label={`Cancel ${o.role} order`}>
                        Cancel
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <AccountPanel sim={sim} />
          {history.length ? (
            <details className="disclosure">
              <summary>Order history ({sim.orders.filter((o) => o.status !== 'pending').length})</summary>
              <div className="disclosure-body">
                <ul className="order-log">
                  {history.map((o) => (
                    <li key={o.id}>
                      <strong>
                        {o.status === 'filled' ? 'Filled' : o.status === 'canceled' ? 'Canceled' : 'Rejected'}: {o.side} {o.qty} {o.type}
                        {o.fillPrice ? ` at ${formatMoney(o.fillPrice)}` : ''}
                      </strong>
                      <br />
                      <span className="muted">{o.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          ) : null}
          <SimLimits />
        </div>
      </div>

      <Dialog
        open={confirmReset}
        title="Start a new run?"
        onClose={() => setConfirmReset(false)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setConfirmReset(false)}>
              Keep this run
            </button>
            <button type="button" className="btn btn-primary" onClick={reset}>
              Start a new run
            </button>
          </>
        }
      >
        <p>This run ends and the virtual balance resets to {formatMoney(STARTING_CASH_CENTS)}. Closed trades stay in your journal and your learning progress isn’t affected.</p>
        {trade ? <p className="notice notice-warn small">You have an open position. It will be discarded without a journal entry.</p> : null}
      </Dialog>
    </div>
  );
}

export function Simulator() {
  const { sim, ready } = useAppState();
  if (!ready) return <p className="muted">Loading…</p>;
  if (!sim || !getScenario(sim.scenarioId)) return <ScenarioPicker />;
  return <SimView sim={sim} />;
}
