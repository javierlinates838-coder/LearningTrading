import { describe, expect, it } from 'vitest';
import { computeSizing, maxSharesForRisk } from './sizing';
import { adjustOhlc, confirmedSwings, isValidCandle, validateOhlc, type Candle } from './candles';
import { centsToDollarString, formatMoney, parseDollars } from './money';

describe('money', () => {
  it('parses dollars into integer cents without floating-point drift', () => {
    expect(parseDollars('0.1')).toBe(10);
    expect(parseDollars('$1,000.25')).toBe(100025);
    expect(parseDollars('19.99')).toBe(1999);
    expect(parseDollars('12')).toBe(1200);
    expect(parseDollars('1.234')).toBeNull();
    expect(parseDollars('abc')).toBeNull();
    expect(centsToDollarString(-505)).toBe('-5.05');
    expect(formatMoney(2000)).toBe('$20.00');
    expect(formatMoney(400, { signed: true })).toBe('+$4.00');
  });
});

describe('position sizing fixture', () => {
  it('matches the documented $1,000 / $10 budget / $20 entry / $19 stop / $22 target example', () => {
    const r = computeSizing({ entry: 2000, stop: 1900, target: 2200, shares: 10, cash: 100_000 });
    expect(r.valid).toBe(true);
    expect(r.riskPerShare).toBe(100);
    expect(r.plannedRisk).toBe(1000);
    expect(r.potentialReward).toBe(2000);
    expect(r.rewardToRisk).toBe(2);
    expect(r.exposure).toBe(20_000);
    expect(maxSharesForRisk({ entry: 2000, stop: 1900, riskBudget: 1000, cash: 100_000 })).toBe(10);
  });

  it('includes costs and slippage when estimating execution risk', () => {
    const r = computeSizing({ entry: 2000, stop: 1900, target: 2200, shares: 10, cash: 100_000, feePerFill: 50, slippagePerShare: 1 });
    expect(r.plannedRiskWithCosts).toBe(1000 + 100 + 20);
    expect(r.cashNeeded).toBe(2001 * 10 + 50);
    expect(maxSharesForRisk({ entry: 2000, stop: 1900, riskBudget: 1000, cash: 100_000, feePerFill: 50, slippagePerShare: 1 })).toBe(8);
  });

  it('is constrained by cash as well as risk', () => {
    expect(maxSharesForRisk({ entry: 2000, stop: 1990, riskBudget: 10_000, cash: 100_000 })).toBe(50);
    const r = computeSizing({ entry: 2000, stop: 1990, target: 2100, shares: 60, cash: 100_000 });
    expect(r.affordable).toBe(false);
    expect(r.valid).toBe(false);
  });

  it('rejects invalid long-trade relationships', () => {
    expect(computeSizing({ entry: 2000, stop: 2100, target: 2200, shares: 1, cash: 100_000 }).valid).toBe(false);
    expect(computeSizing({ entry: 2000, stop: 1900, target: 1950, shares: 1, cash: 100_000 }).rewardToRisk).toBeNull();
  });
});

describe('candles', () => {
  it('validates OHLC relationships', () => {
    expect(isValidCandle({ open: 10, high: 12, low: 9, close: 11 })).toBe(true);
    expect(validateOhlc({ open: 10, high: 9, low: 8, close: 9 })).toContain('high-below-open');
    expect(validateOhlc({ open: 10, high: 12, low: 11, close: 11 })).toContain('low-above-open');
  });

  it('keeps candles valid when adjusting a field', () => {
    const c = { open: 1000, high: 1100, low: 900, close: 1050 };
    const up = adjustOhlc(c, 'close', 1200);
    expect(up.high).toBe(1200);
    expect(isValidCandle(up)).toBe(true);
    const lowTry = adjustOhlc(c, 'low', 1040);
    expect(lowTry.low).toBe(1000);
    expect(isValidCandle(lowTry)).toBe(true);
    const highTry = adjustOhlc(c, 'high', 950);
    expect(highTry.high).toBe(1050);
  });

  it('confirms swing points only after later candles exist', () => {
    const highs = [10, 12, 15, 13, 11, 12, 14];
    const cs: Candle[] = highs.map((h, i) => ({ i, open: h - 2, high: h, low: h - 3, close: h - 1 }));
    expect(confirmedSwings(cs, 3).highs).toEqual([]);
    expect(confirmedSwings(cs, 4).highs).toEqual([]);
    expect(confirmedSwings(cs, 5).highs).toEqual([2]);
  });
});
