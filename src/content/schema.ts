import { z } from 'zod';
import { SCENE_IDS } from './scenes';

const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'ids are lowercase kebab-case');

export const ohlcSchema = z.object({
  open: z.number().int().positive(),
  high: z.number().int().positive(),
  low: z.number().int().positive(),
  close: z.number().int().positive(),
});

export const candleSchema = ohlcSchema.extend({
  i: z.number().int().nonnegative(),
  volume: z.number().int().nonnegative().optional(),
  label: z.string().optional(),
});

export const visualSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('candles'),
    candles: z.array(candleSchema).min(1),
    highlight: z.array(z.number().int()).optional(),
    levels: z.array(z.object({ price: z.number().int(), label: z.string() })).optional(),
    zones: z.array(z.object({ low: z.number().int(), high: z.number().int(), label: z.string() })).optional(),
    showVolume: z.boolean().optional(),
    caption: z.string(),
  }),
  z.object({
    kind: z.literal('candle'),
    ohlc: ohlcSchema,
    showLabels: z.boolean().optional(),
    caption: z.string(),
  }),
  z.object({
    kind: z.literal('shares'),
    shares: z.number().int().positive(),
    price: z.number().int().positive(),
    basis: z.number().int().positive().optional(),
    caption: z.string(),
  }),
  z.object({
    kind: z.literal('quote'),
    bid: z.number().int().positive(),
    ask: z.number().int().positive(),
    last: z.number().int().positive().optional(),
    caption: z.string(),
  }),
  z.object({
    kind: z.literal('plan'),
    entry: z.number().int().positive(),
    stop: z.number().int().positive(),
    target: z.number().int().positive(),
    shares: z.number().int().positive().optional(),
    caption: z.string(),
  }),
  z.object({
    kind: z.literal('table'),
    rows: z.array(z.object({ label: z.string(), value: z.string() })).min(1),
    caption: z.string(),
  }),
  z.object({
    kind: z.literal('scene'),
    scene: z.enum(SCENE_IDS),
    caption: z.string(),
  }),
]);

const exerciseBase = {
  id,
  skills: z.array(id).min(1),
  prompt: z.string().min(1),
  visual: visualSchema.optional(),
  /** Why the accepted answer is accepted. Always shown after grading. */
  explanation: z.string().min(1),
  /** Present when grading uses an instructor-defined rubric rather than a uniquely correct fact. */
  rubricNote: z.string().optional(),
};

const misconception = z.object({ feedback: z.string().min(1), misconception: id });

export const choiceExerciseSchema = z.object({
  ...exerciseBase,
  kind: z.literal('choice'),
  options: z
    .array(
      z.object({
        id,
        text: z.string().min(1),
        correct: z.boolean().optional(),
        feedback: z.string().min(1),
        misconception: id.optional(),
      }),
    )
    .min(2),
});

export const numericExerciseSchema = z.object({
  ...exerciseBase,
  kind: z.literal('numeric'),
  unit: z.enum(['usd', 'shares', 'number', 'ratio']),
  /** For usd, the answer is in cents. */
  answer: z.number(),
  tolerance: z.number().nonnegative(),
  misconceptions: z.array(misconception.extend({ value: z.number(), tolerance: z.number().nonnegative().optional() })),
  wrongFeedback: z.string().min(1),
  inputLabel: z.string().min(1),
});

export const candlePickExerciseSchema = z.object({
  ...exerciseBase,
  kind: z.literal('candle-pick'),
  candles: z.array(candleSchema).min(2),
  accept: z.array(z.number().int().nonnegative()).min(1),
  misconceptions: z.array(misconception.extend({ indices: z.array(z.number().int()) })),
  wrongFeedback: z.string().min(1),
});

export const zoneExerciseSchema = z.object({
  ...exerciseBase,
  kind: z.literal('zone'),
  candles: z.array(candleSchema).min(5),
  accept: z.array(z.object({ low: z.number().int(), high: z.number().int() })).min(1),
  zoneHeight: z.number().int().positive(),
  start: z.number().int().positive(),
  step: z.number().int().positive(),
  misconceptions: z.array(misconception.extend({ low: z.number().int(), high: z.number().int() })),
  wrongFeedback: z.string().min(1),
});

export const candleRuleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('direction'), value: z.enum(['up', 'down', 'unchanged']), failFeedback: z.string() }),
  z.object({ type: z.literal('upperWickMinRatio'), ratio: z.number(), failFeedback: z.string() }),
  z.object({ type: z.literal('lowerWickMinRatio'), ratio: z.number(), failFeedback: z.string() }),
  z.object({ type: z.literal('upperWickMaxRatio'), ratio: z.number(), failFeedback: z.string() }),
  z.object({ type: z.literal('lowerWickMaxRatio'), ratio: z.number(), failFeedback: z.string() }),
  z.object({ type: z.literal('bodyMaxRatio'), ratio: z.number(), failFeedback: z.string() }),
  z.object({ type: z.literal('bodyMinRatio'), ratio: z.number(), failFeedback: z.string() }),
  z.object({
    type: z.literal('equals'),
    field: z.enum(['open', 'high', 'low', 'close']),
    value: z.number().int(),
    failFeedback: z.string(),
  }),
]);

export const candleBuildExerciseSchema = z.object({
  ...exerciseBase,
  kind: z.literal('candle-build'),
  start: ohlcSchema,
  step: z.number().int().positive(),
  rules: z.array(candleRuleSchema).min(1),
});

export const labelPartsExerciseSchema = z.object({
  ...exerciseBase,
  kind: z.literal('label-parts'),
  candle: ohlcSchema,
  markers: z
    .array(z.object({ id, anchor: z.enum(['high', 'low', 'bodyTop', 'bodyBottom', 'upperWick', 'lowerWick', 'body']), correct: id }))
    .min(2),
  labels: z.array(z.object({ id, text: z.string() })).min(2),
  wrongFeedback: z.string().min(1),
});

export const orderSimExerciseSchema = z.object({
  ...exerciseBase,
  kind: z.literal('order-sim'),
  side: z.enum(['buy', 'sell']),
  quantity: z.number().int().positive(),
  quotes: z.array(z.object({ bid: z.number().int().positive(), ask: z.number().int().positive() })).min(2),
  allowed: z.array(z.enum(['market', 'limit', 'stop'])).min(1),
  startPrice: z.number().int().positive(),
  priceStep: z.number().int().positive(),
  rubric: z.discriminatedUnion('type', [
    z.object({ type: z.literal('fill-at-or-better'), price: z.number().int(), failFeedback: z.string() }),
    z.object({ type: z.literal('must-fill'), failFeedback: z.string() }),
    z.object({ type: z.literal('no-fill-worse-than'), price: z.number().int(), failFeedback: z.string() }),
    z.object({ type: z.literal('exit-triggered-by'), price: z.number().int(), failFeedback: z.string() }),
  ]),
  goal: z.string().min(1),
});

export const riskBuildExerciseSchema = z.object({
  ...exerciseBase,
  kind: z.literal('risk-build'),
  cash: z.number().int().positive(),
  riskBudget: z.number().int().positive(),
  feePerFill: z.number().int().nonnegative(),
  slippagePerShare: z.number().int().nonnegative(),
  start: z.object({ entry: z.number().int(), stop: z.number().int(), target: z.number().int(), shares: z.number().int() }),
  adjustable: z.array(z.enum(['entry', 'stop', 'target', 'shares'])).min(1),
  priceStep: z.number().int().positive(),
  rubric: z.discriminatedUnion('type', [
    z.object({ type: z.literal('max-shares-within-budget'), includeCosts: z.boolean() }),
    z.object({ type: z.literal('risk-within-budget') }),
    z.object({ type: z.literal('stop-at-invalidation'), stop: z.number().int(), shares: z.number().int() }),
  ]),
  wrongFeedback: z.string().min(1),
});

export const decisionExerciseSchema = z.object({
  ...exerciseBase,
  kind: z.literal('decision'),
  situation: z.string().min(1),
  actions: z.array(z.object({ id, text: z.string() })).min(2),
  reasons: z
    .array(
      z.object({
        id,
        text: z.string(),
        points: z.number().int().min(0).max(2),
        supports: z.array(id).min(1),
        feedback: z.string().min(1),
        misconception: id.optional(),
      }),
    )
    .min(3),
});

export const sequenceExerciseSchema = z.object({
  ...exerciseBase,
  kind: z.literal('sequence'),
  items: z.array(z.object({ id, text: z.string(), feedback: z.string() })).min(3),
  /** Item ids in the correct order. */
  correctOrder: z.array(id).min(3),
});

export const categorizeExerciseSchema = z.object({
  ...exerciseBase,
  kind: z.literal('categorize'),
  categories: z.array(z.object({ id, label: z.string() })).min(2),
  items: z.array(z.object({ id, text: z.string(), category: id, feedback: z.string() })).min(2),
});

export const exerciseSchema = z.discriminatedUnion('kind', [
  choiceExerciseSchema,
  numericExerciseSchema,
  candlePickExerciseSchema,
  zoneExerciseSchema,
  candleBuildExerciseSchema,
  labelPartsExerciseSchema,
  orderSimExerciseSchema,
  riskBuildExerciseSchema,
  decisionExerciseSchema,
  sequenceExerciseSchema,
  categorizeExerciseSchema,
]);

export const stepSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('concept'),
    id,
    title: z.string().min(1),
    body: z.string().min(1),
    more: z.string().optional(),
    visual: visualSchema.optional(),
  }),
  z.object({ kind: z.literal('exercise'), id, exercise: exerciseSchema }),
]);

export const lessonSchema = z.object({
  id,
  version: z.number().int().positive(),
  unitId: id,
  kind: z.enum(['lesson', 'checkpoint']),
  title: z.string().min(1),
  objective: z.string().min(1),
  minutes: z.number().int().min(1).max(8),
  prerequisites: z.array(id),
  /** factual = market mechanics with sources; interpretive = chart reading with rubrics; scenario = authored decision practice. */
  contentType: z.enum(['factual', 'interpretive', 'scenario']),
  steps: z.array(stepSchema).min(2),
  recap: z.array(z.string().min(1)).min(1),
  glossary: z.array(id),
  sources: z.array(id),
  review: z.object({ skills: z.array(id).min(1) }),
  help: z.object({ simpler: z.string().min(1), example: z.string().min(1) }),
});

export const unitSchema = z.object({
  id,
  number: z.number().int().min(1),
  title: z.string(),
  summary: z.string(),
  lessons: z.array(lessonSchema).min(4),
});

export const sourceSchema = z.object({
  id,
  title: z.string(),
  publisher: z.string(),
  url: z.string().url(),
  checkedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const glossaryTermSchema = z.object({
  id,
  term: z.string(),
  short: z.string(),
  example: z.string().optional(),
});

export const skillSchema = z.object({ id, name: z.string(), unitId: id, achievement: z.string().optional() });

export type Ohlc = z.infer<typeof ohlcSchema>;
export type Visual = z.infer<typeof visualSchema>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type ExerciseKind = Exercise['kind'];
export type ChoiceExercise = z.infer<typeof choiceExerciseSchema>;
export type NumericExercise = z.infer<typeof numericExerciseSchema>;
export type CandlePickExercise = z.infer<typeof candlePickExerciseSchema>;
export type ZoneExercise = z.infer<typeof zoneExerciseSchema>;
export type CandleBuildExercise = z.infer<typeof candleBuildExerciseSchema>;
export type CandleRule = z.infer<typeof candleRuleSchema>;
export type LabelPartsExercise = z.infer<typeof labelPartsExerciseSchema>;
export type OrderSimExercise = z.infer<typeof orderSimExerciseSchema>;
export type RiskBuildExercise = z.infer<typeof riskBuildExerciseSchema>;
export type DecisionExercise = z.infer<typeof decisionExerciseSchema>;
export type SequenceExercise = z.infer<typeof sequenceExerciseSchema>;
export type CategorizeExercise = z.infer<typeof categorizeExerciseSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type GlossaryTerm = z.infer<typeof glossaryTermSchema>;
export type Skill = z.infer<typeof skillSchema>;
