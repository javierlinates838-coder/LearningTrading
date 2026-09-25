import type { Visual as VisualData } from '../content/schema';
import { formatMoney } from '../domain/money';
import { CandleChart } from './CandleChart';
import { CandleFigure } from './CandleFigure';

export function Visual({ visual }: { visual: VisualData }) {
  switch (visual.kind) {
    case 'candles':
      return (
        <figure style={{ margin: 0 }}>
          <CandleChart
            candles={visual.candles}
            label={visual.caption}
            highlight={visual.highlight}
            levels={visual.levels?.map((l) => ({ ...l, tone: 'mastery' as const }))}
            zones={visual.zones}
            showVolume={visual.showVolume}
          />
          <figcaption className="chart-caption">{visual.caption}</figcaption>
        </figure>
      );
    case 'candle':
      return (
        <figure style={{ margin: 0 }}>
          <CandleFigure
            ohlc={visual.ohlc}
            showLabels={visual.showLabels}
            label={`${visual.caption} Open ${formatMoney(visual.ohlc.open)}, high ${formatMoney(visual.ohlc.high)}, low ${formatMoney(visual.ohlc.low)}, close ${formatMoney(visual.ohlc.close)}.`}
            height={220}
          />
          <figcaption className="chart-caption">{visual.caption}</figcaption>
        </figure>
      );
    case 'shares': {
      return (
        <figure className="card" style={{ margin: 0 }}>
          <div className="row" aria-hidden="true" style={{ gap: 6, marginBottom: 12 }}>
            {Array.from({ length: Math.min(visual.shares, 20) }, (_, i) => (
              <span key={i} style={{ width: 28, height: 36, borderRadius: 6, border: '2px solid var(--color-accent)', background: 'var(--color-accent-soft)' }} />
            ))}
            {visual.shares > 20 ? <span className="muted">+{visual.shares - 20} more</span> : null}
          </div>
          <dl className="kv">
            <dt>Shares</dt>
            <dd>{visual.shares}</dd>
            <dt>Price per share</dt>
            <dd>{formatMoney(visual.price)}</dd>
            {visual.basis !== undefined ? (
              <>
                <dt>Bought at</dt>
                <dd>{formatMoney(visual.basis)}</dd>
              </>
            ) : null}
          </dl>
          <figcaption className="chart-caption">
            {visual.caption}
          </figcaption>
        </figure>
      );
    }
    case 'quote':
      return (
        <figure className="card" style={{ margin: 0 }}>
          <div className="quote-strip">
            <div className="quote-cell">
              <div className="k">Bid (sell here)</div>
              <div className="v">{formatMoney(visual.bid)}</div>
            </div>
            <div className="quote-cell">
              <div className="k">Ask (buy here)</div>
              <div className="v">{formatMoney(visual.ask)}</div>
            </div>
            <div className="quote-cell">
              <div className="k">Spread</div>
              <div className="v">{formatMoney(visual.ask - visual.bid)}</div>
            </div>
            {visual.last !== undefined ? (
              <div className="quote-cell">
                <div className="k">Last trade</div>
                <div className="v">{formatMoney(visual.last)}</div>
              </div>
            ) : null}
          </div>
          <figcaption className="chart-caption">{visual.caption}</figcaption>
        </figure>
      );
    case 'plan':
      return (
        <figure className="card" style={{ margin: 0 }}>
          <dl className="kv">
            <dt>
              <span className="up" aria-hidden>
                ▲{' '}
              </span>
              Target
            </dt>
            <dd>{formatMoney(visual.target)}</dd>
            <dt>Entry</dt>
            <dd>{formatMoney(visual.entry)}</dd>
            <dt>
              <span className="down" aria-hidden>
                ▼{' '}
              </span>
              Stop
            </dt>
            <dd>{formatMoney(visual.stop)}</dd>
            {visual.shares ? (
              <>
                <dt>Shares</dt>
                <dd>{visual.shares}</dd>
              </>
            ) : null}
          </dl>
          <figcaption className="chart-caption">{visual.caption}</figcaption>
        </figure>
      );
    case 'table':
      return (
        <figure className="card" style={{ margin: 0 }}>
          <table>
            <tbody>
              {visual.rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  <td className="num">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <figcaption className="chart-caption">{visual.caption}</figcaption>
        </figure>
      );
  }
}
