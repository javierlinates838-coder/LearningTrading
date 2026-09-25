export interface Candle {
  /** Stable index within its series. */
  i: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  /** Optional time label, e.g. "10:30". */
  label?: string;
}

export type OhlcIssue =
  | 'high-below-open'
  | 'high-below-close'
  | 'low-above-open'
  | 'low-above-close'
  | 'high-below-low'
  | 'non-positive';

export function validateOhlc(c: Pick<Candle, 'open' | 'high' | 'low' | 'close'>): OhlcIssue[] {
  const issues: OhlcIssue[] = [];
  if ([c.open, c.high, c.low, c.close].some((v) => !(v > 0))) issues.push('non-positive');
  if (c.high < c.low) issues.push('high-below-low');
  if (c.high < c.open) issues.push('high-below-open');
  if (c.high < c.close) issues.push('high-below-close');
  if (c.low > c.open) issues.push('low-above-open');
  if (c.low > c.close) issues.push('low-above-close');
  return issues;
}

export function isValidCandle(c: Pick<Candle, 'open' | 'high' | 'low' | 'close'>): boolean {
  return validateOhlc(c).length === 0;
}

/**
 * Adjust one OHLC field while keeping the candle valid: the high is pushed up
 * and the low pushed down when the open or close moves beyond them, and the
 * high/low cannot cross the body.
 */
export function adjustOhlc(
  c: Pick<Candle, 'open' | 'high' | 'low' | 'close'>,
  field: 'open' | 'high' | 'low' | 'close',
  value: number,
): Pick<Candle, 'open' | 'high' | 'low' | 'close'> {
  const next = { ...c, [field]: Math.max(1, Math.round(value)) };
  const bodyTop = Math.max(next.open, next.close);
  const bodyBottom = Math.min(next.open, next.close);
  if (field === 'high') next.high = Math.max(next.high, bodyTop);
  else if (field === 'low') next.low = Math.min(next.low, bodyBottom);
  else {
    next.high = Math.max(next.high, bodyTop);
    next.low = Math.min(next.low, bodyBottom);
  }
  return next;
}

export type CandleDirection = 'up' | 'down' | 'unchanged';

export function candleDirection(c: Pick<Candle, 'open' | 'close'>): CandleDirection {
  if (c.close > c.open) return 'up';
  if (c.close < c.open) return 'down';
  return 'unchanged';
}

export function candleAnatomy(c: Pick<Candle, 'open' | 'high' | 'low' | 'close'>) {
  const bodyTop = Math.max(c.open, c.close);
  const bodyBottom = Math.min(c.open, c.close);
  return {
    body: bodyTop - bodyBottom,
    upperWick: c.high - bodyTop,
    lowerWick: bodyBottom - c.low,
    range: c.high - c.low,
    direction: candleDirection(c),
  };
}

export function describeCandle(c: Pick<Candle, 'open' | 'high' | 'low' | 'close'>, fmt: (n: number) => string): string {
  const a = candleAnatomy(c);
  const dir = a.direction === 'up' ? 'Closed higher than it opened' : a.direction === 'down' ? 'Closed lower than it opened' : 'Closed where it opened';
  return `${dir}. Open ${fmt(c.open)}, high ${fmt(c.high)}, low ${fmt(c.low)}, close ${fmt(c.close)}.`;
}

/**
 * A swing high at index k is confirmed only once `lookahead` later candles
 * have printed lower highs. Returns the index at which confirmation becomes
 * possible, i.e. k + lookahead.
 */
export function isSwingHigh(candles: Candle[], k: number, lookback = 2, lookahead = 2): boolean {
  const c = candles[k];
  if (!c) return false;
  for (let j = k - lookback; j <= k + lookahead; j++) {
    if (j === k) continue;
    const other = candles[j];
    if (!other || other.high >= c.high) return false;
  }
  return true;
}

export function isSwingLow(candles: Candle[], k: number, lookback = 2, lookahead = 2): boolean {
  const c = candles[k];
  if (!c) return false;
  for (let j = k - lookback; j <= k + lookahead; j++) {
    if (j === k) continue;
    const other = candles[j];
    if (!other || other.low <= c.low) return false;
  }
  return true;
}

/** Swing points that can be confirmed using only candles visible up to `visibleCount`. */
export function confirmedSwings(candles: Candle[], visibleCount: number, lookback = 2, lookahead = 2) {
  const visible = candles.slice(0, visibleCount);
  const highs: number[] = [];
  const lows: number[] = [];
  for (let k = 0; k < visible.length; k++) {
    if (isSwingHigh(visible, k, lookback, lookahead)) highs.push(k);
    if (isSwingLow(visible, k, lookback, lookahead)) lows.push(k);
  }
  return { highs, lows };
}
