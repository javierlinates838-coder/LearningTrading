import { candleDirection } from '../domain/candles';
import { formatMoney } from '../domain/money';
import type { Ohlc } from '../content/schema';

export type Anchor = 'high' | 'low' | 'bodyTop' | 'bodyBottom' | 'upperWick' | 'lowerWick' | 'body';

export interface FigureMarker {
  id: string;
  number: number;
  anchor: Anchor;
  text?: string;
  active?: boolean;
  onClick?: () => void;
}

export function anchorPrice(c: Ohlc, a: Anchor): number {
  const top = Math.max(c.open, c.close);
  const bottom = Math.min(c.open, c.close);
  switch (a) {
    case 'high':
      return c.high;
    case 'low':
      return c.low;
    case 'bodyTop':
      return top;
    case 'bodyBottom':
      return bottom;
    case 'upperWick':
      return (c.high + top) / 2;
    case 'lowerWick':
      return (c.low + bottom) / 2;
    case 'body':
      return (top + bottom) / 2;
  }
}

/** One large candle, optionally with price labels and numbered tap targets. */
export function CandleFigure({
  ohlc,
  showLabels = false,
  markers = [],
  height = 240,
  range,
  label,
}: {
  ohlc: Ohlc;
  showLabels?: boolean;
  markers?: FigureMarker[];
  height?: number;
  range?: { min: number; max: number };
  label: string;
}) {
  const width = 320;
  const pad = 24;
  const min = range?.min ?? ohlc.low - Math.max(10, Math.round((ohlc.high - ohlc.low) * 0.15));
  const max = range?.max ?? ohlc.high + Math.max(10, Math.round((ohlc.high - ohlc.low) * 0.15));
  const y = (p: number) => pad + ((max - p) / (max - min || 1)) * (height - 2 * pad);
  const cx = 170;
  const bw = 56;
  const dir = candleDirection(ohlc);
  const color = dir === 'up' ? 'var(--color-up)' : dir === 'down' ? 'var(--color-down)' : 'var(--color-text-muted)';
  const top = y(Math.max(ohlc.open, ohlc.close));
  const bottom = y(Math.min(ohlc.open, ohlc.close));
  const priceLabels: Array<[string, number]> = [
    ['High', ohlc.high],
    [dir === 'down' ? 'Open' : 'Close', Math.max(ohlc.open, ohlc.close)],
    [dir === 'down' ? 'Close' : 'Open', Math.min(ohlc.open, ohlc.close)],
    ['Low', ohlc.low],
  ];

  return (
    <div className="chart" style={{ maxWidth: 420, margin: '0 auto', position: 'relative' }} role="img" aria-label={label}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" aria-hidden="true">
        <line x1={cx} x2={cx} y1={y(ohlc.high)} y2={y(ohlc.low)} stroke={color} strokeWidth={3} />
        {dir === 'unchanged' ? (
          <line x1={cx - bw / 2} x2={cx + bw / 2} y1={top} y2={top} stroke={color} strokeWidth={4} />
        ) : (
          <rect x={cx - bw / 2} width={bw} y={top} height={Math.max(3, bottom - top)} rx={3} fill={dir === 'up' ? 'var(--color-ink)' : color} stroke={color} strokeWidth={3} />
        )}
        {showLabels
          ? priceLabels.map(([name, p]) => (
              <g key={name}>
                <line x1={cx + bw / 2 + 6} x2={cx + bw / 2 + 22} y1={y(p)} y2={y(p)} stroke="var(--color-text-faint)" />
                <text x={cx + bw / 2 + 26} y={y(p) + 5} fontSize={14} fill="var(--color-text)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {name} {formatMoney(p)}
                </text>
              </g>
            ))
          : null}
        {markers.map((m) => (
          <line key={m.id} x1={62} x2={cx - 6} y1={y(anchorPrice(ohlc, m.anchor))} y2={y(anchorPrice(ohlc, m.anchor))} stroke="var(--color-accent)" strokeDasharray="3 3" />
        ))}
      </svg>
      {markers.map((m) => (
        <button
          key={m.id}
          type="button"
          className="marker-badge"
          aria-pressed={m.active}
          aria-label={`Marker ${m.number}${m.text ? `: labeled ${m.text}` : ': not labeled yet'}`}
          onClick={m.onClick}
          style={{
            position: 'absolute',
            left: 'calc(19% - 22px)',
            top: `calc(${(y(anchorPrice(ohlc, m.anchor)) / height) * 100}% - 22px)`,
            width: 44,
            height: 44,
            border: m.active ? '3px solid var(--color-text)' : 0,
            cursor: 'pointer',
          }}
        >
          {m.number}
        </button>
      ))}
    </div>
  );
}
