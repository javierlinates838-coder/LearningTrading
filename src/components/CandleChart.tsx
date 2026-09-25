import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Candle } from '../domain/candles';
import { candleDirection } from '../domain/candles';
import { formatMoney } from '../domain/money';

export interface ChartCandle extends Candle {
  complete?: boolean;
}

export interface ChartLevel {
  price: number;
  label: string;
  tone?: 'accent' | 'up' | 'down' | 'mastery' | 'muted';
}

export interface ChartZone {
  low: number;
  high: number;
  label: string;
  tone?: 'accent' | 'mastery' | 'muted';
}

const TONE: Record<string, string> = {
  accent: 'var(--color-accent)',
  up: 'var(--color-up)',
  down: 'var(--color-down)',
  mastery: 'var(--color-mastery)',
  muted: 'var(--color-text-faint)',
};

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setW(Math.round(entry!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function describeOhlc(c: Candle): string {
  const dir = candleDirection(c);
  const word = dir === 'up' ? 'up (close above open)' : dir === 'down' ? 'down (close below open)' : 'unchanged';
  return `Open ${formatMoney(c.open)}, high ${formatMoney(c.high)}, low ${formatMoney(c.low)}, close ${formatMoney(c.close)}. ${word}.`;
}

export function CandleChart({
  candles,
  label,
  height = 240,
  highlight = [],
  levels = [],
  zones = [],
  showVolume = false,
  selectable = false,
  selected = null,
  onSelect,
  onPriceTap,
  priceRange,
  showTable = true,
  describedBy,
  numberFrom = 1,
}: {
  candles: ChartCandle[];
  label: string;
  height?: number;
  highlight?: number[];
  levels?: ChartLevel[];
  zones?: ChartZone[];
  showVolume?: boolean;
  selectable?: boolean;
  selected?: number | null;
  onSelect?: (index: number) => void;
  /** Tap on the chart body reports a price (used by zone placement). */
  onPriceTap?: (price: number) => void;
  priceRange?: { min: number; max: number };
  showTable?: boolean;
  describedBy?: string;
  /** Number shown for the first candle (default 1). */
  numberFrom?: number;
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const readoutId = useId();
  const n = candles.length;
  const axisW = 64;
  const padTop = 16;
  const labelsH = 22;
  const volH = showVolume ? 44 : 0;
  const plotW = Math.max(0, width - axisW - 8);
  const plotH = height - padTop - labelsH - volH;

  const { min, max } = useMemo(() => {
    if (priceRange) return priceRange;
    let lo = Infinity;
    let hi = -Infinity;
    for (const c of candles) {
      lo = Math.min(lo, c.low);
      hi = Math.max(hi, c.high);
    }
    for (const l of levels) {
      lo = Math.min(lo, l.price);
      hi = Math.max(hi, l.price);
    }
    for (const z of zones) {
      lo = Math.min(lo, z.low);
      hi = Math.max(hi, z.high);
    }
    if (!Number.isFinite(lo)) return { min: 0, max: 100 };
    const pad = Math.max(5, Math.round((hi - lo) * 0.08));
    return { min: lo - pad, max: hi + pad };
  }, [candles, levels, zones, priceRange]);

  const y = useCallback((p: number) => padTop + ((max - p) / (max - min || 1)) * plotH, [max, min, plotH]);
  const slot = n > 0 ? plotW / n : 0;
  const bodyW = Math.max(3, Math.min(28, slot * 0.62));
  const x = (i: number) => 4 + slot * i + slot / 2;

  const ticks = useMemo(() => {
    const count = 4;
    const out: number[] = [];
    for (let k = 0; k <= count; k++) out.push(Math.round(min + ((max - min) * k) / count));
    return out;
  }, [min, max]);
  const maxVol = Math.max(1, ...candles.map((c) => c.volume ?? 0));
  const labelEvery = n <= 16 ? 1 : n <= 32 ? 2 : 5;

  const indexFromEvent = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - 4;
    return Math.min(n - 1, Math.max(0, Math.floor(px / (slot || 1))));
  };
  const priceFromEvent = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const py = e.clientY - rect.top;
    return Math.round(max - ((py - padTop) / (plotH || 1)) * (max - min));
  };

  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    if (onPriceTap) onPriceTap(priceFromEvent(e));
    else if (selectable && onSelect && n) onSelect(indexFromEvent(e));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!selectable || !onSelect || !n) return;
    const cur = selected ?? -1;
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(n - 1, cur + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, cur < 0 ? 0 : cur - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next !== null) {
      e.preventDefault();
      onSelect(next);
    }
  };

  const sel = selected !== null ? candles[selected] : undefined;
  const announce = selectable && sel && selected !== null ? `Candle ${selected + numberFrom} of ${n}. ${describeOhlc(sel)}` : '';

  return (
    <div>
      <div
        ref={wrapRef}
        className="chart"
        tabIndex={selectable ? 0 : undefined}
        role={selectable ? 'group' : 'img'}
        aria-label={selectable ? `${label}. Use left and right arrow keys to choose a candle.` : label}
        aria-describedby={[describedBy, selectable ? readoutId : undefined].filter(Boolean).join(' ') || undefined}
        onKeyDown={onKeyDown}
      >
        {width > 0 ? (
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" onPointerUp={selectable || onPriceTap ? onPointerUp : undefined} style={{ cursor: selectable || onPriceTap ? 'pointer' : 'default' }}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={plotW + 8} y1={y(t)} y2={y(t)} stroke="var(--color-border)" strokeWidth={1} />
                <text x={width - 4} y={y(t) + 4} textAnchor="end" fontSize={12} fill="var(--color-text-faint)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatMoney(t)}
                </text>
              </g>
            ))}
            {zones.map((z, k) => (
              <g key={`z${k}`}>
                <rect x={0} width={plotW + 8} y={y(z.high)} height={Math.max(2, y(z.low) - y(z.high))} fill={TONE[z.tone ?? 'accent']} opacity={0.14} />
                <line x1={0} x2={plotW + 8} y1={y(z.high)} y2={y(z.high)} stroke={TONE[z.tone ?? 'accent']} strokeDasharray="4 3" />
                <line x1={0} x2={plotW + 8} y1={y(z.low)} y2={y(z.low)} stroke={TONE[z.tone ?? 'accent']} strokeDasharray="4 3" />
                <text x={6} y={y(z.high) - 4} fontSize={12} fill={TONE[z.tone ?? 'accent']} fontWeight={600}>
                  {z.label}
                </text>
              </g>
            ))}
            {highlight.map((i) =>
              candles[i] ? <rect key={`h${i}`} x={x(i) - slot / 2} width={slot} y={padTop} height={plotH} fill="var(--color-mastery)" opacity={0.1} /> : null,
            )}
            {selected !== null && candles[selected] ? (
              <rect x={x(selected) - slot / 2 + 1} width={Math.max(2, slot - 2)} y={padTop - 6} height={plotH + 12} fill="none" stroke="var(--color-accent)" strokeWidth={2} rx={6} />
            ) : null}
            {candles.map((c, i) => {
              const dir = candleDirection(c);
              const color = dir === 'up' ? 'var(--color-up)' : dir === 'down' ? 'var(--color-down)' : 'var(--color-text-muted)';
              const top = y(Math.max(c.open, c.close));
              const bottom = y(Math.min(c.open, c.close));
              const incomplete = c.complete === false;
              return (
                <g key={i} opacity={incomplete ? 0.7 : 1}>
                  <line x1={x(i)} x2={x(i)} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth={1.5} strokeDasharray={incomplete ? '3 2' : undefined} />
                  {dir === 'unchanged' ? (
                    <line x1={x(i) - bodyW / 2} x2={x(i) + bodyW / 2} y1={top} y2={top} stroke={color} strokeWidth={2} />
                  ) : (
                    <rect
                      x={x(i) - bodyW / 2}
                      width={bodyW}
                      y={top}
                      height={Math.max(1.5, bottom - top)}
                      rx={1.5}
                      fill={dir === 'up' ? 'var(--color-ink)' : color}
                      stroke={color}
                      strokeWidth={1.5}
                      strokeDasharray={incomplete ? '3 2' : undefined}
                    />
                  )}
                  {showVolume && c.volume !== undefined ? (
                    <rect
                      x={x(i) - bodyW / 2}
                      width={bodyW}
                      y={height - labelsH - (c.volume / maxVol) * (volH - 8)}
                      height={(c.volume / maxVol) * (volH - 8)}
                      fill="var(--color-text-faint)"
                      opacity={0.55}
                    />
                  ) : null}
                  {(i % labelEvery === 0 || i === n - 1) && slot > 0 ? (
                    <text x={x(i)} y={height - 6} textAnchor="middle" fontSize={11} fill={highlight.includes(i) || selected === i ? 'var(--color-text)' : 'var(--color-text-faint)'} fontWeight={selected === i ? 700 : 400}>
                      {i + numberFrom}
                    </text>
                  ) : null}
                </g>
              );
            })}
            {levels.map((l, k) => (
              <g key={`l${k}`}>
                <line x1={0} x2={plotW + 8} y1={y(l.price)} y2={y(l.price)} stroke={TONE[l.tone ?? 'accent']} strokeWidth={1.5} strokeDasharray="6 4" />
                <rect x={2} y={y(l.price) - 18} width={Math.min(plotW, l.label.length * 7 + 12)} height={16} rx={4} fill="var(--color-ink)" opacity={0.85} />
                <text x={8} y={y(l.price) - 6} fontSize={12} fill={TONE[l.tone ?? 'accent']} fontWeight={600}>
                  {l.label}
                </text>
              </g>
            ))}
          </svg>
        ) : (
          <div style={{ height }} />
        )}
      </div>
      {selectable ? (
        <p id={readoutId} className="visually-hidden" aria-live="polite">
          {announce}
        </p>
      ) : null}
      <div className="legend" aria-hidden="true">
        <span>
          <span className="swatch" style={{ border: '1.5px solid var(--color-up)', background: 'var(--color-ink)' }} /> Hollow = up (close above open)
        </span>
        <span>
          <span className="swatch" style={{ background: 'var(--color-down)' }} /> Filled = down
        </span>
        {candles.some((c) => c.complete === false) ? <span>Dashed = still forming</span> : null}
      </div>
      {showTable ? <ChartTable candles={candles} showVolume={showVolume} numberFrom={numberFrom} /> : null}
    </div>
  );
}

export function ChartTable({ candles, showVolume, numberFrom = 1 }: { candles: ChartCandle[]; showVolume?: boolean; numberFrom?: number }) {
  return (
    <details className="disclosure" style={{ marginTop: 8 }}>
      <summary>Chart data as a table</summary>
      <div className="disclosure-body table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Candle</th>
              <th scope="col" className="num">
                Open
              </th>
              <th scope="col" className="num">
                High
              </th>
              <th scope="col" className="num">
                Low
              </th>
              <th scope="col" className="num">
                Close
              </th>
              <th scope="col">Direction</th>
              {showVolume ? (
                <th scope="col" className="num">
                  Volume
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {candles.map((c, i) => {
              const dir = candleDirection(c);
              return (
                <tr key={i}>
                  <th scope="row">
                    {i + numberFrom}
                    {c.complete === false ? ' (forming)' : ''}
                  </th>
                  <td className="num">{formatMoney(c.open)}</td>
                  <td className="num">{formatMoney(c.high)}</td>
                  <td className="num">{formatMoney(c.low)}</td>
                  <td className="num">{formatMoney(c.close)}</td>
                  <td>{dir === 'up' ? '▲ Up' : dir === 'down' ? '▼ Down' : '• Unchanged'}</td>
                  {showVolume ? <td className="num">{(c.volume ?? 0).toLocaleString('en-US')}</td> : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
