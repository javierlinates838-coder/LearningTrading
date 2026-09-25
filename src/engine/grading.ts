import type {
  CandleBuildExercise,
  CandleRule,
  CategorizeExercise,
  ChoiceExercise,
  DecisionExercise,
  Exercise,
  LabelPartsExercise,
  NumericExercise,
  Ohlc,
  OrderSimExercise,
  RiskBuildExercise,
  SequenceExercise,
  ZoneExercise,
  CandlePickExercise,
} from '../content/schema';
import { candleAnatomy, validateOhlc } from '../domain/candles';
import { computeSizing, maxSharesForRisk } from '../domain/sizing';
import { formatMoney } from '../domain/money';
import { runLabOrder, type LabOrderType, type LabOutcome } from './orderLab';

export type ExerciseResponse =
  | { kind: 'choice'; optionId: string }
  | { kind: 'numeric'; value: number }
  | { kind: 'candle-pick'; index: number }
  | { kind: 'zone'; center: number }
  | { kind: 'candle-build'; ohlc: Ohlc }
  | { kind: 'label-parts'; assignments: Record<string, string> }
  | { kind: 'order-sim'; orderType: LabOrderType; price?: number }
  | { kind: 'risk-build'; entry: number; stop: number; target: number; shares: number }
  | { kind: 'decision'; actionId: string; reasonId: string }
  | { kind: 'sequence'; order: string[] }
  | { kind: 'categorize'; assignments: Record<string, string> };

export interface GradeResult {
  correct: boolean;
  /** Feedback about this specific answer (identifies the misconception when wrong). */
  feedback: string;
  /** The general explanation of the accepted answer. */
  explanation: string;
  misconception?: string;
  details?: string[];
  orderOutcome?: LabOutcome;
}

export class ResponseMismatchError extends Error {}

export function gradeExercise(ex: Exercise, response: ExerciseResponse): GradeResult {
  if (ex.kind !== response.kind) throw new ResponseMismatchError(`Response kind ${response.kind} does not match ${ex.kind}`);
  switch (ex.kind) {
    case 'choice':
      return gradeChoice(ex, response as Extract<ExerciseResponse, { kind: 'choice' }>);
    case 'numeric':
      return gradeNumeric(ex, response as Extract<ExerciseResponse, { kind: 'numeric' }>);
    case 'candle-pick':
      return gradeCandlePick(ex, response as Extract<ExerciseResponse, { kind: 'candle-pick' }>);
    case 'zone':
      return gradeZone(ex, response as Extract<ExerciseResponse, { kind: 'zone' }>);
    case 'candle-build':
      return gradeCandleBuild(ex, response as Extract<ExerciseResponse, { kind: 'candle-build' }>);
    case 'label-parts':
      return gradeLabelParts(ex, response as Extract<ExerciseResponse, { kind: 'label-parts' }>);
    case 'order-sim':
      return gradeOrderSim(ex, response as Extract<ExerciseResponse, { kind: 'order-sim' }>);
    case 'risk-build':
      return gradeRiskBuild(ex, response as Extract<ExerciseResponse, { kind: 'risk-build' }>);
    case 'decision':
      return gradeDecision(ex, response as Extract<ExerciseResponse, { kind: 'decision' }>);
    case 'sequence':
      return gradeSequence(ex, response as Extract<ExerciseResponse, { kind: 'sequence' }>);
    case 'categorize':
      return gradeCategorize(ex, response as Extract<ExerciseResponse, { kind: 'categorize' }>);
  }
}

function gradeChoice(ex: ChoiceExercise, r: { optionId: string }): GradeResult {
  const option = ex.options.find((o) => o.id === r.optionId);
  if (!option) throw new ResponseMismatchError(`Unknown option ${r.optionId}`);
  return {
    correct: option.correct === true,
    feedback: option.feedback,
    explanation: ex.explanation,
    misconception: option.correct ? undefined : option.misconception,
  };
}

function gradeNumeric(ex: NumericExercise, r: { value: number }): GradeResult {
  if (!Number.isFinite(r.value)) throw new ResponseMismatchError('Numeric answer must be a finite number');
  if (Math.abs(r.value - ex.answer) <= ex.tolerance + 1e-9) {
    return { correct: true, feedback: 'That matches.', explanation: ex.explanation };
  }
  const m = ex.misconceptions.find((mc) => Math.abs(r.value - mc.value) <= (mc.tolerance ?? ex.tolerance) + 1e-9);
  return {
    correct: false,
    feedback: m ? m.feedback : ex.wrongFeedback,
    explanation: ex.explanation,
    misconception: m?.misconception,
  };
}

function gradeCandlePick(ex: CandlePickExercise, r: { index: number }): GradeResult {
  if (ex.accept.includes(r.index)) return { correct: true, feedback: 'Yes, that candle fits.', explanation: ex.explanation };
  const m = ex.misconceptions.find((mc) => mc.indices.includes(r.index));
  return { correct: false, feedback: m ? m.feedback : ex.wrongFeedback, explanation: ex.explanation, misconception: m?.misconception };
}

function gradeZone(ex: ZoneExercise, r: { center: number }): GradeResult {
  const hit = ex.accept.some((z) => r.center >= z.low && r.center <= z.high);
  if (hit) return { correct: true, feedback: 'That area is a defensible choice.', explanation: ex.explanation };
  const m = ex.misconceptions.find((mc) => r.center >= mc.low && r.center <= mc.high);
  return { correct: false, feedback: m ? m.feedback : ex.wrongFeedback, explanation: ex.explanation, misconception: m?.misconception };
}

export function checkCandleRule(rule: CandleRule, c: Ohlc): boolean {
  const a = candleAnatomy(c);
  const range = a.range || 1;
  switch (rule.type) {
    case 'direction':
      return a.direction === rule.value;
    case 'upperWickMinRatio':
      return a.upperWick / range >= rule.ratio;
    case 'lowerWickMinRatio':
      return a.lowerWick / range >= rule.ratio;
    case 'upperWickMaxRatio':
      return a.upperWick / range <= rule.ratio;
    case 'lowerWickMaxRatio':
      return a.lowerWick / range <= rule.ratio;
    case 'bodyMaxRatio':
      return a.body / range <= rule.ratio;
    case 'bodyMinRatio':
      return a.body / range >= rule.ratio;
    case 'equals':
      return c[rule.field] === rule.value;
  }
}

function gradeCandleBuild(ex: CandleBuildExercise, r: { ohlc: Ohlc }): GradeResult {
  const issues = validateOhlc(r.ohlc);
  if (issues.length) {
    return {
      correct: false,
      feedback: 'That combination is impossible: the high must be the top of the candle and the low the bottom.',
      explanation: ex.explanation,
      misconception: 'invalid-ohlc',
    };
  }
  const failed = ex.rules.filter((rule) => !checkCandleRule(rule, r.ohlc));
  if (failed.length === 0) return { correct: true, feedback: 'Your candle meets every requirement.', explanation: ex.explanation };
  return {
    correct: false,
    feedback: failed[0]!.failFeedback,
    explanation: ex.explanation,
    details: failed.map((f) => f.failFeedback),
  };
}

function gradeLabelParts(ex: LabelPartsExercise, r: { assignments: Record<string, string> }): GradeResult {
  const wrong = ex.markers.filter((m) => r.assignments[m.id] !== m.correct);
  if (wrong.length === 0) return { correct: true, feedback: 'Every label is in the right place.', explanation: ex.explanation };
  const labelText = (id: string | undefined) => ex.labels.find((l) => l.id === id)?.text ?? 'nothing';
  return {
    correct: false,
    feedback: ex.wrongFeedback,
    explanation: ex.explanation,
    details: wrong.map((m, i) => `Marker ${ex.markers.indexOf(m) + 1}: you chose ${labelText(r.assignments[m.id])}${i === 0 ? '. Look again at where it sits on the candle.' : '.'}`),
  };
}

function gradeOrderSim(ex: OrderSimExercise, r: { orderType: LabOrderType; price?: number }): GradeResult {
  if (!ex.allowed.includes(r.orderType)) throw new ResponseMismatchError(`Order type ${r.orderType} not allowed`);
  const outcome = runLabOrder({ side: ex.side, type: r.orderType, price: r.orderType === 'market' ? undefined : r.price, quotes: ex.quotes });
  const better = (fill: number, limit: number) => (ex.side === 'buy' ? fill <= limit : fill >= limit);
  let correct = false;
  const rub = ex.rubric;
  switch (rub.type) {
    case 'fill-at-or-better':
      correct = outcome.filled && outcome.fillPrice !== null && better(outcome.fillPrice, rub.price);
      break;
    case 'must-fill':
      correct = outcome.filled;
      break;
    case 'no-fill-worse-than':
      correct = !outcome.filled || (outcome.fillPrice !== null && better(outcome.fillPrice, rub.price));
      break;
    case 'exit-triggered-by':
      correct = r.orderType === 'stop' && r.price !== undefined && Math.abs(r.price - rub.price) <= 5;
      break;
  }
  return {
    correct,
    feedback: correct ? outcome.summary : `${outcome.summary} ${rub.failFeedback}`,
    explanation: ex.explanation,
    orderOutcome: outcome,
    misconception: correct ? undefined : `order-${rub.type}`,
  };
}

function gradeRiskBuild(ex: RiskBuildExercise, r: { entry: number; stop: number; target: number; shares: number }): GradeResult {
  const sizing = computeSizing({
    entry: r.entry,
    stop: r.stop,
    target: r.target,
    shares: r.shares,
    cash: ex.cash,
    feePerFill: ex.feePerFill,
    slippagePerShare: ex.slippagePerShare,
  });
  const costsIncluded = ex.feePerFill > 0 || ex.slippagePerShare > 0;
  const risk = costsIncluded ? sizing.plannedRiskWithCosts : sizing.plannedRisk;
  const rub = ex.rubric;
  const details: string[] = [];
  if (!sizing.valid) details.push(...sizing.errors);
  if (r.shares < 1) details.push('Choose at least one share.');

  const maxShares = maxSharesForRisk({
    entry: r.entry,
    stop: r.stop,
    riskBudget: ex.riskBudget,
    cash: ex.cash,
    feePerFill: rub.type === 'max-shares-within-budget' && !rub.includeCosts ? 0 : ex.feePerFill,
    slippagePerShare: rub.type === 'max-shares-within-budget' && !rub.includeCosts ? 0 : ex.slippagePerShare,
  });

  let correct = sizing.valid && r.shares >= 1;
  if (correct && risk !== null && risk > ex.riskBudget) {
    correct = false;
    details.push(`Planned risk is ${formatMoney(risk)}, above the ${formatMoney(ex.riskBudget)} budget.`);
  }
  if (correct && rub.type === 'max-shares-within-budget' && r.shares !== maxShares) {
    correct = false;
    details.push(
      r.shares < maxShares
        ? `You are within budget, but this exercise asks for the largest whole-share size that fits: ${maxShares} shares.`
        : `That size goes over the budget. The largest whole-share size that fits is ${maxShares}.`,
    );
  }
  if (correct && rub.type === 'stop-at-invalidation') {
    if (r.stop !== rub.stop) {
      correct = false;
      details.push(`The stop belongs where the plan is proven wrong (${formatMoney(rub.stop)}), not where it makes the size look nicer.`);
    } else if (r.shares !== rub.shares) {
      correct = false;
      details.push(`With the stop at ${formatMoney(rub.stop)}, the size that fits the budget is ${rub.shares} shares.`);
    }
  }
  return {
    correct,
    feedback: correct ? 'The plan fits the budget and the cash you have.' : details[0] ?? ex.wrongFeedback,
    explanation: ex.explanation,
    details,
    misconception: correct ? undefined : 'sizing-error',
  };
}

function gradeDecision(ex: DecisionExercise, r: { actionId: string; reasonId: string }): GradeResult {
  const reason = ex.reasons.find((x) => x.id === r.reasonId);
  if (!reason || !ex.actions.some((a) => a.id === r.actionId)) throw new ResponseMismatchError('Unknown decision response');
  const consistent = reason.supports.includes(r.actionId);
  const score = consistent ? reason.points : 0;
  const feedback = consistent
    ? reason.feedback
    : `That reason does not lead to the action you picked. ${reason.feedback}`;
  return {
    correct: score === 2,
    feedback,
    explanation: ex.explanation,
    details: [`Reasoning score: ${score} of 2`],
    misconception: score === 2 ? undefined : reason.misconception ?? 'weak-reasoning',
  };
}

function gradeSequence(ex: SequenceExercise, r: { order: string[] }): GradeResult {
  const firstWrong = ex.correctOrder.findIndex((id, i) => r.order[i] !== id);
  if (firstWrong === -1) return { correct: true, feedback: 'That order works.', explanation: ex.explanation };
  const item = ex.items.find((i) => i.id === ex.correctOrder[firstWrong]);
  return {
    correct: false,
    feedback: `Step ${firstWrong + 1} is out of place. ${item?.feedback ?? ''}`.trim(),
    explanation: ex.explanation,
    misconception: 'sequence-order',
  };
}

function gradeCategorize(ex: CategorizeExercise, r: { assignments: Record<string, string> }): GradeResult {
  const wrong = ex.items.filter((i) => r.assignments[i.id] !== i.category);
  if (wrong.length === 0) return { correct: true, feedback: 'Every item is sorted correctly.', explanation: ex.explanation };
  return {
    correct: false,
    feedback: `${wrong.length} of ${ex.items.length} need another look. ${wrong[0]!.feedback}`,
    explanation: ex.explanation,
    details: wrong.map((w) => `“${w.text}”: ${w.feedback}`),
    misconception: 'categorize',
  };
}
