import type { Candle } from '../domain/candles';

/** Dollars to integer cents, for readable content authoring. */
export const d = (dollars: number): number => Math.round(dollars * 100);

/** Explicit bars in dollars: [open, high, low, close, volume?]. */
export function bars(list: Array<[number, number, number, number, number?]>): Candle[] {
  return list.map(([o, h, l, c, v], i) => ({ i, open: d(o), high: d(h), low: d(l), close: d(c), ...(v !== undefined ? { volume: v } : {}) }));
}

/** Bars from closes: each opens at the previous close, with fixed wick padding. */
export function fromCloses(first: number, closes: number[], wick = 0.12, volumes?: number[]): Candle[] {
  let prev = first;
  return closes.map((c, i) => {
    const o = prev;
    prev = c;
    return {
      i,
      open: d(o),
      close: d(c),
      high: d(Math.max(o, c) + wick),
      low: d(Math.min(o, c) - wick),
      ...(volumes ? { volume: volumes[i] ?? 0 } : {}),
    };
  });
}

/** Bars shaped from a list of highs; each spans 0.40 below its high. Alternates up/down bodies. */
export function fromHighs(highs: number[]): Candle[] {
  return highs.map((h, i) => {
    const up = i % 2 === 0;
    return { i, high: d(h), low: d(h - 0.4), open: d(up ? h - 0.3 : h - 0.05), close: d(up ? h - 0.05 : h - 0.3) };
  });
}

/** Bars shaped from a list of lows; each spans 0.40 above its low. */
export function fromLows(lows: number[]): Candle[] {
  return lows.map((l, i) => {
    const up = i % 2 === 1;
    return { i, low: d(l), high: d(l + 0.4), open: d(up ? l + 0.08 : l + 0.35), close: d(up ? l + 0.35 : l + 0.08) };
  });
}
