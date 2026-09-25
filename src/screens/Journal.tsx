import { useId, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, CaretLeft, CaretRight, CheckCircle, XCircle, Sparkle } from '@phosphor-icons/react';
import { SceneArt } from '../components/scenes';
import { useAppState, saveReflection } from '../state/app';
import {
  REFLECTION_TAGS,
  SMALL_SAMPLE,
  TAG_LABELS,
  adherenceChecks,
  entryCosts,
  entryNet,
  entryR,
  journalStats,
  type JournalEntry,
  type Reflection,
} from '../sim/journal';
import { buildCandles, formatTrainingTime, generateEvents, getScenario } from '../sim/scenarios';
import { describeChange, formatMoney } from '../domain/money';
import { Page, SimBadge } from '../components/Page';
import { CandleChart, type ChartLevel } from '../components/CandleChart';
import { NotFound } from './NotFound';

const EXIT_LABEL: Record<JournalEntry['exitReason'], string> = {
  stop: 'Stop filled',
  target: 'Target filled',
  manual: 'Sold at market',
  'scenario-end': 'Closed at scenario end',
};

function Net({ cents }: { cents: number }) {
  const c = describeChange(cents);
  return (
    <span className={`num ${c.direction}`} style={{ fontWeight: 700 }}>
      {c.direction === 'up' ? '▲ ' : c.direction === 'down' ? '▼ ' : ''}
      {c.text} <span className="small">({c.word})</span>
    </span>
  );
}

export function formatR(r: number | null): string {
  if (r === null) return 'R unavailable';
  return `${r >= 0 ? '+' : '−'}${Math.abs(r).toFixed(2)}R`;
}

export function Journal() {
  const { journal } = useAppState();
  const entries = [...journal.entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const st = journalStats(journal.entries);
  const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);
  return (
    <Page title="Journal" intro="Every closed simulator trade is recorded here automatically. Reflect on the decision, not just the result.">
      {entries.length === 0 ? (
        <div className="card empty">
          <SceneArt id="journal" label="A plan page beside a page for what actually happened." />
          <h2>No trades yet</h2>
          <p>When you close a trade in the simulator, a journal entry appears here with your plan, fills and costs.</p>
          <Link to="/simulator" className="btn btn-primary">
            Open the simulator
          </Link>
        </div>
      ) : (
        <>
          <section className="card" aria-labelledby="stats-h" style={{ marginBottom: 'var(--space-5)' }}>
            <h2 id="stats-h" style={{ fontSize: 'var(--text-lg)' }}>
              Statistics
            </h2>
            {st.count < SMALL_SAMPLE ? (
              <p className="notice notice-info small">
                Based on {st.count} trade{st.count === 1 ? '' : 's'}. With fewer than {SMALL_SAMPLE}, these numbers can swing a lot by chance. Treat them as a rough hint.
              </p>
            ) : null}
            <dl className="kv">
              <dt>Closed trades (sample size)</dt>
              <dd>{st.count}</dd>
              <dt>Win rate</dt>
              <dd>
                {pct(st.winRate)} <span className="muted small">({st.wins} wins, {st.losses} losses{st.breakeven ? `, ${st.breakeven} even` : ''})</span>
              </dd>
              <dt>Average win</dt>
              <dd>{st.averageWin === null ? '—' : formatMoney(st.averageWin)}</dd>
              <dt>Average loss</dt>
              <dd>{st.averageLoss === null ? '—' : formatMoney(st.averageLoss)}</dd>
              <dt>Average R</dt>
              <dd>
                {st.averageR === null ? 'Unavailable' : formatR(st.averageR)} <span className="muted small">(from {st.rSample} trades with a stop)</span>
              </dd>
              <dt>Net result after costs</dt>
              <dd>
                <Net cents={st.totalNet} />
              </dd>
              <dt>Fees paid</dt>
              <dd>{formatMoney(st.totalCosts)}</dd>
              <dt>Followed plan checks</dt>
              <dd>
                {st.planFollowed} of {st.count}
              </dd>
              <dt>Reflections written</dt>
              <dd>
                {st.reflected} of {st.count}
              </dd>
            </dl>
          </section>
          <h2 style={{ fontSize: 'var(--text-lg)' }}>Trades</h2>
          <ul className="list">
            {entries.map((e) => (
              <li key={e.id}>
                <Link to={`/journal/${encodeURIComponent(e.id)}`} className="list-link">
                  <span className="grow">
                    <strong>
                      {e.symbol} · {e.scenarioTitle}
                    </strong>
                    <span className="small muted" style={{ display: 'block' }}>
                      {e.qty} shares · {EXIT_LABEL[e.exitReason]} · {formatR(entryR(e))} · {e.reflection ? 'Reflected' : 'Needs reflection'}
                    </span>
                  </span>
                  <Net cents={entryNet(e)} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Page>
  );
}

function Replay({ entry }: { entry: JournalEntry }) {
  const scenario = getScenario(entry.scenarioId);
  const events = useMemo(() => (scenario && scenario.version === entry.scenarioVersion ? generateEvents(scenario) : []), [scenario, entry.scenarioVersion]);
  const start = Math.max(0, entry.plan.createdAtSeq - 1 - 60);
  const end = Math.min(events.length - 1, entry.exitSeq - 1 + 6);
  const [pos, setPos] = useState(Math.min(end, entry.plan.createdAtSeq - 1));
  const sliderId = useId();
  if (!events.length) return <p className="small muted">Replay is unavailable because this scenario has changed since the trade.</p>;
  const visible = events.slice(start, pos + 1);
  const candles = buildCandles(visible);
  const cur = events[pos]!;
  const levels: ChartLevel[] = [];
  const seq = cur.seq;
  if (seq >= entry.entrySeq) levels.push({ price: entry.entryPrice, label: `Entry ${formatMoney(entry.entryPrice)}`, tone: 'muted' });
  if (entry.initialStop !== null) levels.push({ price: entry.initialStop, label: `Initial stop ${formatMoney(entry.initialStop)}`, tone: 'down' });
  if (entry.plan.target !== undefined) levels.push({ price: entry.plan.target, label: `Target ${formatMoney(entry.plan.target)}`, tone: 'up' });
  const phase = seq < entry.entrySeq ? 'Before entry' : seq < entry.exitSeq ? 'In the trade' : seq === entry.exitSeq ? 'Exit' : 'After exit';
  return (
    <section className="card stack-sm" aria-labelledby="replay-h">
      <h2 id="replay-h" style={{ fontSize: 'var(--text-lg)', margin: 0 }}>
        Trade replay
      </h2>
      <p className="small muted" style={{ margin: 0 }}>
        Step through the quotes around this trade. {phase} · {formatTrainingTime(cur, events)}
      </p>
      <CandleChart candles={candles} levels={levels} label={`Replay of ${entry.symbol} at quote ${seq}. ${phase}.`} height={240} />
      <div className="field">
        <label htmlFor={sliderId}>Replay position</label>
        <input
          id={sliderId}
          type="range"
          min={start}
          max={end}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-valuetext={`Quote ${seq}, ${phase}`}
          style={{ width: '100%', minHeight: 44, accentColor: 'var(--color-accent)' }}
        />
      </div>
      <div className="btn-row">
        <button type="button" className="btn btn-sm" onClick={() => setPos((p) => Math.max(start, p - 1))} disabled={pos <= start}>
          <CaretLeft size={16} aria-hidden /> Back
        </button>
        <button type="button" className="btn btn-sm" onClick={() => setPos((p) => Math.min(end, p + 1))} disabled={pos >= end}>
          Forward <CaretRight size={16} aria-hidden />
        </button>
        <button type="button" className="btn btn-sm" onClick={() => setPos(entry.entrySeq - 1)}>
          Jump to entry
        </button>
        <button type="button" className="btn btn-sm" onClick={() => setPos(entry.exitSeq - 1)}>
          Jump to exit
        </button>
      </div>
    </section>
  );
}

function ReflectionForm({ entry }: { entry: JournalEntry }) {
  const r = entry.reflection;
  const [followedPlan, setFollowed] = useState<Reflection['followedPlan']>(r?.followedPlan ?? 'yes');
  const [decisionQuality, setQuality] = useState<Reflection['decisionQuality']>(r?.decisionQuality ?? 'sound');
  const [whatHappened, setWhat] = useState(r?.whatHappened ?? '');
  const [nextTime, setNext] = useState(r?.nextTime ?? '');
  const [tags, setTags] = useState<string[]>(r?.tags ?? []);
  const [saved, setSaved] = useState<{ xp: number; ach: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ids = { f: useId(), q: useId(), w: useId(), n: useId() };
  const losing = entryNet(entry) < 0;

  const save = () => {
    if (whatHappened.trim().length < 10) {
      setError('Write at least a short sentence about what happened (10 characters or more).');
      document.getElementById(ids.w)?.focus();
      return;
    }
    setError(null);
    const out = saveReflection(entry.id, { followedPlan, decisionQuality, whatHappened: whatHappened.trim(), nextTime: nextTime.trim(), tags });
    setSaved({ xp: out.xpGained, ach: out.unlocked.map((a) => a.title) });
  };

  return (
    <section className="card stack" aria-labelledby="refl-h">
      <h2 id="refl-h" style={{ fontSize: 'var(--text-lg)', margin: 0 }}>
        Reflection
      </h2>
      {losing ? <p className="small muted">Losing trades are the most useful to review. Focus on whether the decision followed your plan.</p> : null}
      <fieldset>
        <legend>Did you follow your plan?</legend>
        <div className="segmented">
          {(['yes', 'partly', 'no'] as const).map((v) => (
            <label key={v}>
              <input type="radio" name={ids.f} checked={followedPlan === v} onChange={() => setFollowed(v)} /> {v[0]!.toUpperCase() + v.slice(1)}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>How was the decision, apart from the result?</legend>
        <div className="segmented">
          {(['sound', 'mixed', 'poor'] as const).map((v) => (
            <label key={v}>
              <input type="radio" name={ids.q} checked={decisionQuality === v} onChange={() => setQuality(v)} /> {v[0]!.toUpperCase() + v.slice(1)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor={ids.w}>What happened, and why?</label>
        <textarea id={ids.w} className="input" maxLength={1000} value={whatHappened} onChange={(e) => setWhat(e.target.value)} aria-invalid={!!error} aria-describedby={error ? `${ids.w}-e` : undefined} />
        {error ? (
          <span id={`${ids.w}-e`} className="error-text" role="alert">
            {error}
          </span>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor={ids.n}>What will you do the same or differently next time? (optional)</label>
        <textarea id={ids.n} className="input" maxLength={1000} value={nextTime} onChange={(e) => setNext(e.target.value)} />
      </div>
      <fieldset>
        <legend>Tags (optional)</legend>
        <div className="chip-row">
          {REFLECTION_TAGS.map((t) => (
            <button key={t} type="button" className="chip" aria-pressed={tags.includes(t)} onClick={() => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))}>
              {TAG_LABELS[t]}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="btn-row">
        <button type="button" className="btn btn-primary" onClick={save}>
          {r ? 'Update reflection' : 'Save reflection'}
        </button>
      </div>
      {saved ? (
        <div role="status" className="feedback is-correct">
          <p className="feedback-title" style={{ fontSize: 'var(--text-md)' }}>
            <CheckCircle size={20} weight="fill" aria-hidden /> Reflection saved
          </p>
          {saved.xp ? (
            <p className="xp-note" style={{ margin: 0 }}>
              <Sparkle size={16} weight="fill" aria-hidden /> +{saved.xp} XP for reflecting
            </p>
          ) : null}
          {saved.ach.map((a) => (
            <p key={a} className="mastery small" style={{ fontWeight: 700, margin: '4px 0 0' }}>
              Achievement earned: {a}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function JournalDetail() {
  const { entryId = '' } = useParams();
  const { journal, ready } = useAppState();
  const entry = journal.entries.find((e) => e.id === decodeURIComponent(entryId));
  if (!ready) return <p className="muted">Loading…</p>;
  if (!entry) return <NotFound what="journal entry" />;
  const net = entryNet(entry);
  const r = entryR(entry);
  const checks = adherenceChecks(entry);
  return (
    <Page
      title={`${entry.symbol} trade`}
      heading={
        <>
          <Link to="/journal" className="icon-btn" aria-label="Back to Journal" style={{ verticalAlign: 'middle', marginRight: 4 }}>
            <ArrowLeft size={22} aria-hidden />
          </Link>
          {entry.symbol} · {entry.scenarioTitle}
        </>
      }
      intro={<SimBadge />}
    >
      <div className="stack">
        <section className="card" aria-labelledby="sum-h">
          <h2 id="sum-h" className="eyebrow">
            Result
          </h2>
          <dl className="kv">
            <dt>Net result after costs</dt>
            <dd>
              <Net cents={net} />
            </dd>
            <dt>R-multiple</dt>
            <dd>{formatR(r)}</dd>
            <dt>Initial risk (frozen at entry)</dt>
            <dd>{entry.initialRisk !== null ? formatMoney(entry.initialRisk) : 'Unavailable: no stop was set at entry'}</dd>
            <dt>Costs (fees)</dt>
            <dd>{formatMoney(entryCosts(entry))}</dd>
            <dt>Exit</dt>
            <dd>{EXIT_LABEL[entry.exitReason]}</dd>
          </dl>
          <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
            R = net result ÷ initial risk. Moving the stop later doesn’t change the initial risk.
          </p>
        </section>

        <section className="card" aria-labelledby="plan-h">
          <h2 id="plan-h" className="eyebrow">
            Plan versus what happened
          </h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col" />
                  <th scope="col" className="num">
                    Planned
                  </th>
                  <th scope="col" className="num">
                    Actual
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Entry</th>
                  <td className="num">
                    {entry.plan.entryType} ~{formatMoney(entry.plan.referencePrice)}
                  </td>
                  <td className="num">{formatMoney(entry.entryPrice)}</td>
                </tr>
                <tr>
                  <th scope="row">Shares</th>
                  <td className="num">{entry.plan.qty}</td>
                  <td className="num">{entry.qty}</td>
                </tr>
                <tr>
                  <th scope="row">Stop</th>
                  <td className="num">{entry.plan.stop !== undefined ? formatMoney(entry.plan.stop) : 'None'}</td>
                  <td className="num">{entry.stopWidened ? 'Moved further away' : entry.stopRemoved ? 'Removed' : entry.initialStop !== null ? 'Kept or tightened' : 'None'}</td>
                </tr>
                <tr>
                  <th scope="row">Target</th>
                  <td className="num">{entry.plan.target !== undefined ? formatMoney(entry.plan.target) : 'None'}</td>
                  <td className="num">Exit {formatMoney(entry.exitPrice)}</td>
                </tr>
                <tr>
                  <th scope="row">Estimated risk incl. costs</th>
                  <td className="num">{entry.plan.estimatedRiskWithCosts !== null ? formatMoney(entry.plan.estimatedRiskWithCosts) : '—'}</td>
                  <td className="num">{net < 0 ? formatMoney(-net) + ' lost' : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {entry.plan.rationale.length || entry.plan.note ? (
            <p className="small" style={{ marginTop: 8 }}>
              <strong>Reason written before entry:</strong> {[...entry.plan.rationale, entry.plan.note].filter(Boolean).join(' · ')}
            </p>
          ) : (
            <p className="small muted" style={{ marginTop: 8 }}>
              No reason was written before entry.
            </p>
          )}
          <ul className="list" aria-label="Plan checks">
            {checks.map((c) => (
              <li key={c.label} className="row small" style={{ gap: 8 }}>
                {c.ok ? <CheckCircle size={18} aria-hidden className="up" /> : <XCircle size={18} aria-hidden className="down" />}
                <span>
                  <span className="visually-hidden">{c.ok ? 'Done: ' : 'Not done: '}</span>
                  {c.label}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <Replay entry={entry} />
        <ReflectionForm entry={entry} />

        <details className="disclosure">
          <summary>Ledger lines for this trade</summary>
          <div className="disclosure-body table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">What</th>
                  <th scope="col" className="num">
                    Cash
                  </th>
                  <th scope="col" className="num">
                    Shares
                  </th>
                </tr>
              </thead>
              <tbody>
                {entry.ledger.map((l) => (
                  <tr key={l.id}>
                    <td>{l.note}</td>
                    <td className="num">{formatMoney(l.cash, { signed: true })}</td>
                    <td className="num">{l.shares > 0 ? `+${l.shares}` : l.shares}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </Page>
  );
}
