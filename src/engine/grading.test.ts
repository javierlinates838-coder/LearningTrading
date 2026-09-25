import { describe, expect, it } from 'vitest';
import { exerciseById } from '../content';
import { d } from '../content/helpers';
import { gradeExercise } from './grading';
import { runLabOrder } from './orderLab';

const ex = (id: string) => {
  const ref = exerciseById(id);
  if (!ref) throw new Error(`missing exercise ${id}`);
  return ref.exercise;
};

describe('gradeExercise', () => {
  it('accepts the exact numeric answer and names a known misconception', () => {
    const e = ex('u1-value-at-12');
    expect(gradeExercise(e, { kind: 'numeric', value: d(24) }).correct).toBe(true);
    const wrong = gradeExercise(e, { kind: 'numeric', value: d(4) });
    expect(wrong).toMatchObject({ correct: false, misconception: 'value-vs-gain' });
    expect(wrong.feedback).toMatch(/gain/);
  });

  it('falls back to general guidance for an unanticipated wrong number', () => {
    const r = gradeExercise(ex('u1-value-at-12'), { kind: 'numeric', value: d(13) });
    expect(r.correct).toBe(false);
    expect(r.misconception).toBeUndefined();
    expect(r.feedback).toMatch(/shares × current price/);
  });

  it('grades choices by option and returns that option’s feedback', () => {
    const e = ex('u1-unrealized-statement');
    expect(gradeExercise(e, { kind: 'choice', optionId: 'a' }).correct).toBe(true);
    expect(gradeExercise(e, { kind: 'choice', optionId: 'b' })).toMatchObject({ correct: false, misconception: 'unrealized-is-realized' });
  });

  it('risk-build rubric accepts only the largest size inside the budget including costs', () => {
    const e = ex('u10-capstone-size');
    const plan = { kind: 'risk-build' as const, entry: d(12.4), stop: d(12), target: d(13.2) };
    expect(gradeExercise(e, { ...plan, shares: 21 }).correct).toBe(true);
    expect(gradeExercise(e, { ...plan, shares: 22 }).correct).toBe(false);
    expect(gradeExercise(e, { ...plan, shares: 20 }).correct).toBe(false);
  });

  it('rejects a response of the wrong kind instead of guessing', () => {
    expect(() => gradeExercise(ex('u1-value-at-12'), { kind: 'choice', optionId: 'a' })).toThrow();
  });
});

describe('runLabOrder', () => {
  const quotes = [
    { bid: 1000, ask: 1002 },
    { bid: 1004, ask: 1006 },
    { bid: 998, ask: 1000 },
    { bid: 960, ask: 962 },
  ];

  it('never fills on the quote that was visible when the order was placed', () => {
    const r = runLabOrder({ side: 'buy', type: 'market', quotes });
    expect(r).toMatchObject({ filled: true, fillIndex: 1, fillPrice: 1006 });
  });

  it('a buy limit waits until the ask is at or below the limit', () => {
    const r = runLabOrder({ side: 'buy', type: 'limit', price: 1001, quotes });
    expect(r).toMatchObject({ filled: true, fillIndex: 2, fillPrice: 1000 });
    expect(r.steps[0]!.status).toBe('waiting');
  });

  it('a sell stop that is gapped through fills at the worse bid', () => {
    const r = runLabOrder({ side: 'sell', type: 'stop', price: 990, quotes });
    expect(r).toMatchObject({ filled: true, fillIndex: 3, fillPrice: 960, triggeredIndex: 3 });
    expect(r.summary).toMatch(/worse than the \$9\.90 stop/);
  });

  it('reports an unfilled order honestly', () => {
    const r = runLabOrder({ side: 'sell', type: 'limit', price: 1100, quotes });
    expect(r).toMatchObject({ filled: false, fillPrice: null });
    expect(r.summary).toMatch(/Not filled/);
  });
});
