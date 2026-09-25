import type { Visual as VisualData } from '../content/schema';
import { formatMoney } from '../domain/money';
import { CandleChart } from './CandleChart';
import { CandleFigure } from './CandleFigure';
import { SceneArt } from './scenes';

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
      const shown = Math.min(visual.shares, 8);
      return (
        <figure className="card scene-card" style={{ margin: 0 }}>
          <div className="share-row" aria-hidden="true">
            {Array.from({ length: shown }, (_, i) => (
              <span key={i} className="share-ticket">
                <span className="share-hole" />
                <span className="num">{formatMoney(visual.price)}</span>
              </span>
            ))}
            {visual.shares > shown ? <span className="muted">+{visual.shares - shown}</span> : null}
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
    case 'plan': {
      const top = Math.max(visual.target, visual.entry, visual.stop);
      const bot = Math.min(visual.target, visual.entry, visual.stop);
      const y = (price: number) => 12 + ((top - price) / Math.max(1, top - bot)) * 96;
      return (
        <figure className="card scene-card" style={{ margin: 0 }}>
          <svg className="scene scene-short" viewBox="0 0 360 130" aria-hidden="true">
            <line x1="28" y1="8" x2="28" y2="122" stroke="var(--color-border-strong)" strokeWidth="2" />
            {(
              [
                ['▲ Target', visual.target, 'var(--color-up)'],
                ['Entry', visual.entry, 'var(--color-accent)'],
                ['▼ Stop', visual.stop, 'var(--color-down)'],
              ] as const
            ).map(([name, price, color]) => (
              <g key={name}>
                <line x1="20" x2="210" y1={y(price)} y2={y(price)} stroke={color} strokeWidth="2" />
                <text x="220" y={y(price) + 5} fill={color} fontSize="14" fontFamily="inherit">
                  {name} {formatMoney(price)}
                </text>
              </g>
            ))}
            <rect x="40" y={y(visual.entry)} width="16" height={Math.max(4, y(visual.stop) - y(visual.entry))} fill="var(--color-down-soft)" stroke="var(--color-down)" />
          </svg>
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
    }
    case 'scene':
      return (
        <figure className="scene-card" style={{ margin: 0 }}>
          <SceneArt id={visual.scene} label={visual.caption} />
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
