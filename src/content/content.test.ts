import { describe, expect, it } from 'vitest';
import { EXERCISES, LESSONS, UNITS, plainText, termRefs, wordCount } from './index';
import { GLOSSARY, termById } from './glossary';
import { SKILLS } from './skills';
import { SOURCES, sourceById } from './sources';
import { glossaryTermSchema, skillSchema, sourceSchema, type Exercise } from './schema';
import { confirmedSwings, isValidCandle } from '../domain/candles';
import { gradeExercise, type ExerciseResponse } from '../engine/grading';

function allText(ex: Exercise): string[] {
  const t = [ex.prompt, ex.explanation];
  if (ex.kind === 'decision') t.push(ex.situation);
  return t;
}

function solvable(ex: Exercise): boolean {
  const ok = (r: ExerciseResponse) => gradeExercise(ex, r).correct;
  switch (ex.kind) {
    case 'choice':
      return ex.options.some((o) => ok({ kind: 'choice', optionId: o.id }));
    case 'numeric':
      return ok({ kind: 'numeric', value: ex.answer });
    case 'candle-pick':
      return ex.accept.every((i) => i < ex.candles.length) && ok({ kind: 'candle-pick', index: ex.accept[0]! });
    case 'zone': {
      for (let k = -200; k <= 200; k++) if (ok({ kind: 'zone', center: ex.start + k * ex.step })) return true;
      return false;
    }
    case 'candle-build': {
      const s = ex.step;
      const range = 20;
      for (let io = -range; io <= range; io++)
        for (let ic = -range; ic <= range; ic++) {
          const open = ex.start.open + io * s;
          const close = ex.start.close + ic * s;
          const top = Math.max(open, close);
          const bottom = Math.min(open, close);
          for (let ih = 0; ih <= range; ih++)
            for (let il = 0; il <= range; il++) {
              const ohlc = { open, close, high: top + ih * s, low: bottom - il * s };
              if (ohlc.low > 0 && ok({ kind: 'candle-build', ohlc })) return true;
            }
        }
      return false;
    }
    case 'label-parts':
      return ok({ kind: 'label-parts', assignments: Object.fromEntries(ex.markers.map((m) => [m.id, m.correct])) });
    case 'order-sim': {
      for (const t of ex.allowed) {
        if (t === 'market') {
          if (ok({ kind: 'order-sim', orderType: 'market' })) return true;
          continue;
        }
        for (let k = -60; k <= 60; k++) if (ok({ kind: 'order-sim', orderType: t, price: ex.startPrice + k * ex.priceStep })) return true;
      }
      return false;
    }
    case 'risk-build': {
      const adj = new Set(ex.adjustable);
      const vals = (field: 'entry' | 'stop' | 'target') =>
        adj.has(field) ? Array.from({ length: 81 }, (_, k) => ex.start[field] + (k - 40) * ex.priceStep) : [ex.start[field]];
      const sharesList = adj.has('shares') ? Array.from({ length: 300 }, (_, k) => k + 1) : [ex.start.shares];
      for (const entry of vals('entry'))
        for (const stop of vals('stop'))
          for (const target of vals('target'))
            for (const shares of sharesList) if (ok({ kind: 'risk-build', entry, stop, target, shares })) return true;
      return false;
    }
    case 'decision':
      return ex.reasons.some((r) => r.points === 2 && r.supports.some((a) => ok({ kind: 'decision', actionId: a, reasonId: r.id })));
    case 'sequence':
      return ok({ kind: 'sequence', order: ex.correctOrder });
    case 'categorize':
      return ok({ kind: 'categorize', assignments: Object.fromEntries(ex.items.map((i) => [i.id, i.category])) });
  }
}

describe('curriculum structure', () => {
  it('has 10 units with at least 3 lessons plus a checkpoint each', () => {
    expect(UNITS).toHaveLength(10);
    for (const u of UNITS) {
      expect(u.lessons.filter((l) => l.kind === 'lesson').length).toBeGreaterThanOrEqual(3);
      expect(u.lessons.filter((l) => l.kind === 'checkpoint')).toHaveLength(1);
      expect(u.lessons.at(-1)!.kind).toBe('checkpoint');
      for (const l of u.lessons) expect(l.unitId).toBe(u.id);
    }
    expect(LESSONS.length).toBeGreaterThanOrEqual(40);
  });

  it('has at least 60 assessed items with unique ids', () => {
    const ids = EXERCISES.map((e) => e.exercise.id);
    expect(ids.length).toBeGreaterThanOrEqual(60);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses unique lesson ids and unique step ids within a lesson', () => {
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of LESSONS) {
      const steps = l.steps.map((s) => s.id);
      expect(new Set(steps).size, l.id).toBe(steps.length);
      expect(l.steps.some((s) => s.kind === 'exercise'), l.id).toBe(true);
    }
  });

  it('has prerequisites that exist and come earlier (so there are no cycles)', () => {
    const seen = new Set<string>();
    for (const l of LESSONS) {
      for (const p of l.prerequisites) expect(seen.has(p), `${l.id} requires ${p}`).toBe(true);
      seen.add(l.id);
    }
    expect(LESSONS[0]!.prerequisites).toEqual([]);
  });

  it('keeps every concept screen at 80 words or fewer', () => {
    for (const l of LESSONS)
      for (const s of l.steps)
        if (s.kind === 'concept') {
          const words = wordCount(plainText(s.body, (id) => termById(id)?.term ?? id));
          expect(words, `${l.id}/${s.id} has ${words} words`).toBeLessThanOrEqual(80);
        }
  });
});

describe('references', () => {
  it('validates glossary, sources and skills', () => {
    for (const g of GLOSSARY) glossaryTermSchema.parse(g);
    for (const s of SOURCES) sourceSchema.parse(s);
    for (const s of SKILLS) skillSchema.parse(s);
    expect(new Set(GLOSSARY.map((g) => g.id)).size).toBe(GLOSSARY.length);
  });

  it('resolves every [[term]], glossary id and source id', () => {
    for (const l of LESSONS) {
      for (const g of l.glossary) expect(termById(g), `${l.id} glossary ${g}`).toBeDefined();
      for (const s of l.sources) expect(sourceById(s), `${l.id} source ${s}`).toBeDefined();
      const texts = [l.objective, ...l.recap, l.help.simpler, l.help.example];
      for (const s of l.steps) {
        if (s.kind === 'concept') texts.push(s.body, s.more ?? '');
        else texts.push(...allText(s.exercise));
      }
      for (const t of texts) for (const ref of termRefs(t)) expect(termById(ref), `${l.id} [[${ref}]]`).toBeDefined();
    }
  });

  it('gives every factual lesson at least one source', () => {
    for (const l of LESSONS.filter((x) => x.contentType === 'factual')) expect(l.sources.length, l.id).toBeGreaterThan(0);
  });

  it('marks every decision item with a rubric note', () => {
    for (const { exercise } of EXERCISES) if (exercise.kind === 'decision') expect(exercise.rubricNote, exercise.id).toBeTruthy();
  });

  it('uses only known skills, each assessed by at least two items', () => {
    const known = new Set(SKILLS.map((s) => s.id));
    const counts = new Map<string, number>();
    for (const { exercise } of EXERCISES)
      for (const s of exercise.skills) {
        expect(known.has(s), `${exercise.id} skill ${s}`).toBe(true);
        counts.set(s, (counts.get(s) ?? 0) + 1);
      }
    for (const l of LESSONS) for (const s of l.review.skills) expect(known.has(s), `${l.id} review ${s}`).toBe(true);
    for (const s of SKILLS) expect(counts.get(s.id) ?? 0, `skill ${s.id}`).toBeGreaterThanOrEqual(2);
  });
});

describe('item integrity', () => {
  it('uses valid OHLC data in every chart and item', () => {
    for (const { exercise } of EXERCISES) {
      const candles =
        exercise.kind === 'candle-pick' || exercise.kind === 'zone'
          ? exercise.candles
          : exercise.kind === 'label-parts'
            ? [exercise.candle]
            : exercise.kind === 'candle-build'
              ? [exercise.start]
              : [];
      const visual = exercise.visual;
      if (visual?.kind === 'candles') candles.push(...visual.candles);
      if (visual?.kind === 'candle') candles.push(visual.ohlc);
      for (const c of candles) expect(isValidCandle(c), exercise.id).toBe(true);
    }
    for (const l of LESSONS)
      for (const s of l.steps)
        if (s.kind === 'concept' && s.visual?.kind === 'candles') for (const c of s.visual.candles) expect(isValidCandle(c), `${l.id}/${s.id}`).toBe(true);
  });

  it('has a correct option and unique ids in every choice item', () => {
    for (const { exercise } of EXERCISES)
      if (exercise.kind === 'choice') {
        expect(exercise.options.filter((o) => o.correct).length, exercise.id).toBe(1);
        expect(new Set(exercise.options.map((o) => o.id)).size).toBe(exercise.options.length);
        for (const o of exercise.options) if (!o.correct) expect(o.misconception, `${exercise.id}/${o.id}`).toBeTruthy();
      }
  });

  it('keeps numeric misconceptions distinct from the answer', () => {
    for (const { exercise } of EXERCISES)
      if (exercise.kind === 'numeric')
        for (const m of exercise.misconceptions) expect(Math.abs(m.value - exercise.answer), exercise.id).toBeGreaterThan(exercise.tolerance);
  });

  it('only accepts swing points that are confirmed by later candles', () => {
    for (const { exercise } of EXERCISES)
      if (exercise.kind === 'candle-pick' && exercise.skills.includes('swing-points')) {
        const { highs, lows } = confirmedSwings(exercise.candles, exercise.candles.length);
        const confirmed = new Set([...highs, ...lows]);
        for (const i of exercise.accept) expect(confirmed.has(i), `${exercise.id} accepts ${i}`).toBe(true);
      }
  });

  it('references real items in sequence, categorize, label and decision items', () => {
    for (const { exercise: ex } of EXERCISES) {
      if (ex.kind === 'sequence') expect([...ex.correctOrder].sort()).toEqual(ex.items.map((i) => i.id).sort());
      if (ex.kind === 'categorize') {
        const cats = new Set(ex.categories.map((c) => c.id));
        for (const i of ex.items) expect(cats.has(i.category), `${ex.id}/${i.id}`).toBe(true);
      }
      if (ex.kind === 'label-parts') {
        const labels = new Set(ex.labels.map((l) => l.id));
        for (const m of ex.markers) expect(labels.has(m.correct), `${ex.id}/${m.id}`).toBe(true);
      }
      if (ex.kind === 'decision') {
        const actions = new Set(ex.actions.map((a) => a.id));
        for (const r of ex.reasons) for (const a of r.supports) expect(actions.has(a), `${ex.id}/${r.id}`).toBe(true);
      }
    }
  });

  it('has a reachable correct answer for every item', () => {
    for (const { exercise } of EXERCISES) expect(solvable(exercise), exercise.id).toBe(true);
  });

  it('rejects at least one plausible wrong answer for every item', () => {
    for (const { exercise: ex } of EXERCISES) {
      let wrong: ExerciseResponse | null = null;
      if (ex.kind === 'choice') wrong = { kind: 'choice', optionId: ex.options.find((o) => !o.correct)!.id };
      if (ex.kind === 'numeric') wrong = { kind: 'numeric', value: ex.answer + ex.tolerance + 1000 };
      if (ex.kind === 'sequence') wrong = { kind: 'sequence', order: [...ex.correctOrder].reverse() };
      if (ex.kind === 'decision') {
        const bad = ex.reasons.find((r) => r.points === 0)!;
        wrong = { kind: 'decision', actionId: bad.supports[0]!, reasonId: bad.id };
      }
      if (wrong) expect(gradeExercise(ex, wrong).correct, ex.id).toBe(false);
    }
  });
});
