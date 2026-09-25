import { useEffect, useRef, useState } from 'react';
import { ChartLineUp, Scales } from '@phosphor-icons/react';
import type { Exercise } from '../content/schema';
import { gradeExercise, type ExerciseResponse, type GradeResult } from '../engine/grading';
import type { AttemptContext } from '../engine/progress';
import { submitAnswer, type AnswerOutcome } from '../state/app';
import { FeedbackPanel } from '../components/FeedbackPanel';
import { InlineText } from '../components/RichText';
import { Visual } from '../components/Visual';
import { formatMoney } from '../domain/money';
import { CategorizeInput, ChoiceInput, DecisionInput, NumericInput, SequenceInput, initialSequence } from './basicInputs';
import { CandleBuildInput, CandlePickInput, LabelPartsInput, ZoneInput } from './chartInputs';
import { OrderSimInput, RiskBuildInput } from './tradeInputs';

export function initialResponse(ex: Exercise, seed: string): ExerciseResponse {
  switch (ex.kind) {
    case 'choice':
      return { kind: 'choice', optionId: '' };
    case 'numeric':
      return { kind: 'numeric', value: Number.NaN };
    case 'candle-pick':
      return { kind: 'candle-pick', index: -1 };
    case 'zone':
      return { kind: 'zone', center: ex.start };
    case 'candle-build':
      return { kind: 'candle-build', ohlc: { ...ex.start } };
    case 'label-parts':
      return { kind: 'label-parts', assignments: {} };
    case 'order-sim':
      return { kind: 'order-sim', orderType: ex.allowed[0]!, price: ex.allowed[0] === 'market' ? undefined : ex.startPrice };
    case 'risk-build':
      return { kind: 'risk-build', ...ex.start };
    case 'decision':
      return { kind: 'decision', actionId: '', reasonId: '' };
    case 'sequence':
      return { kind: 'sequence', order: initialSequence(ex, seed) };
    case 'categorize':
      return { kind: 'categorize', assignments: {} };
  }
}

export function incompleteReason(ex: Exercise, r: ExerciseResponse): string | null {
  switch (r.kind) {
    case 'choice':
      return r.optionId ? null : 'Choose an answer first.';
    case 'numeric':
      return Number.isFinite(r.value) ? null : 'Enter a number first.';
    case 'candle-pick':
      return r.index >= 0 ? null : 'Select a candle first.';
    case 'label-parts':
      return ex.kind === 'label-parts' && ex.markers.every((m) => r.assignments[m.id]) ? null : 'Label every marker first.';
    case 'decision':
      return !r.actionId ? 'Choose an action first.' : !r.reasonId ? 'Choose a reason too.' : null;
    case 'categorize':
      return ex.kind === 'categorize' && ex.items.every((i) => r.assignments[i.id]) ? null : 'Sort every item first.';
    default:
      return null;
  }
}

const KIND_LABEL: Record<Exercise['kind'], string> = {
  choice: 'Question',
  numeric: 'Calculate',
  'candle-pick': 'Chart detective',
  zone: 'Chart detective',
  'candle-build': 'Candle lab',
  'label-parts': 'Candle lab',
  'order-sim': 'Order lab',
  'risk-build': 'Risk builder',
  decision: 'Decision scenario',
  sequence: 'Put in order',
  categorize: 'Sort it',
};

/**
 * One assessed item. Grading and progress rules live in the shared engine;
 * this component only collects a response, submits it, and shows feedback.
 */
export function ExerciseView({
  exercise,
  context,
  lessonId,
  stepId,
  priorAttempts = 0,
  alreadyCorrect = false,
  seed = 'default',
  onCorrect,
  headingLevel = 2,
}: {
  exercise: Exercise;
  context: AttemptContext;
  lessonId?: string;
  stepId?: string;
  priorAttempts?: number;
  alreadyCorrect?: boolean;
  seed?: string;
  onCorrect?: () => void;
  headingLevel?: 2 | 3;
}) {
  const [draft, setDraft] = useState<ExerciseResponse>(() => initialResponse(exercise, seed));
  const [result, setResult] = useState<GradeResult | null>(null);
  const [attempts, setAttempts] = useState(priorAttempts);
  const [outcome, setOutcome] = useState<AnswerOutcome | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [solved, setSolved] = useState(alreadyCorrect);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (result) feedbackRef.current?.focus();
  }, [result]);

  const locked = solved;
  const change = (r: ExerciseResponse) => {
    setDraft(r);
    setWarning(null);
    if (result && !result.correct) setResult(null);
  };

  const check = () => {
    const missing = incompleteReason(exercise, draft);
    if (missing) {
      setWarning(missing);
      return;
    }
    const r = gradeExercise(exercise, draft);
    const out = submitAnswer({ exercise, result: r, context, firstTry: attempts === 0, lessonId, stepId });
    setAttempts((a) => a + 1);
    setResult(r);
    setOutcome(out);
    if (r.correct) {
      setSolved(true);
      onCorrect?.();
    }
  };

  const H = headingLevel === 2 ? 'h2' : 'h3';
  const common = { disabled: locked, seed: `${seed}` };

  return (
    <section className="stack" aria-label={KIND_LABEL[exercise.kind]}>
      <div>
        <p className="eyebrow">{KIND_LABEL[exercise.kind]}</p>
        <H className="exercise-prompt">
          <InlineText text={exercise.prompt} />
        </H>
        {exercise.rubricNote ? (
          <p className="rubric-note">
            <Scales size={18} aria-hidden style={{ flex: 'none', marginTop: 2 }} />
            <span>{exercise.rubricNote}</span>
          </p>
        ) : null}
      </div>
      {exercise.visual ? <Visual visual={exercise.visual} /> : null}

      {exercise.kind === 'choice' && draft.kind === 'choice' ? <ChoiceInput ex={exercise} value={draft} onChange={change} {...common} /> : null}
      {exercise.kind === 'numeric' && draft.kind === 'numeric' ? <NumericInput ex={exercise} value={draft} onChange={change} disabled={locked} /> : null}
      {exercise.kind === 'candle-pick' && draft.kind === 'candle-pick' ? <CandlePickInput ex={exercise} value={draft} onChange={change} disabled={locked} /> : null}
      {exercise.kind === 'zone' && draft.kind === 'zone' ? <ZoneInput ex={exercise} value={draft} onChange={change} disabled={locked} /> : null}
      {exercise.kind === 'candle-build' && draft.kind === 'candle-build' ? <CandleBuildInput ex={exercise} value={draft} onChange={change} disabled={locked} /> : null}
      {exercise.kind === 'label-parts' && draft.kind === 'label-parts' ? <LabelPartsInput ex={exercise} value={draft} onChange={change} {...common} /> : null}
      {exercise.kind === 'order-sim' && draft.kind === 'order-sim' ? <OrderSimInput ex={exercise} value={draft} onChange={change} disabled={locked} /> : null}
      {exercise.kind === 'risk-build' && draft.kind === 'risk-build' ? <RiskBuildInput ex={exercise} value={draft} onChange={change} disabled={locked} /> : null}
      {exercise.kind === 'decision' && draft.kind === 'decision' ? <DecisionInput ex={exercise} value={draft} onChange={change} {...common} /> : null}
      {exercise.kind === 'sequence' && draft.kind === 'sequence' ? <SequenceInput ex={exercise} value={draft} onChange={change} disabled={locked} /> : null}
      {exercise.kind === 'categorize' && draft.kind === 'categorize' ? <CategorizeInput ex={exercise} value={draft} onChange={change} {...common} /> : null}

      {alreadyCorrect && !result ? (
        <p className="notice notice-info small" role="note">
          You already answered this correctly. You can continue, or review the question.
        </p>
      ) : null}

      {!locked ? (
        <div className="stack-sm">
          {warning ? (
            <p className="error-text" role="alert">
              {warning}
            </p>
          ) : null}
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={check}>
              {attempts > 0 && result === null ? 'Check again' : 'Check answer'}
            </button>
          </div>
        </div>
      ) : null}

      {result ? (
        <FeedbackPanel
          ref={feedbackRef}
          result={result}
          attempts={attempts}
          rubricNote={exercise.rubricNote}
          xpGained={outcome?.xpGained}
          notes={outcome?.notes}
          achievements={outcome?.unlocked.map((a) => a.title)}
        />
      ) : null}

      {result?.orderOutcome ? (
        <details className="disclosure" open>
          <summary>
            <ChartLineUp size={18} aria-hidden /> What happened, quote by quote
          </summary>
          <div className="disclosure-body table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Quote</th>
                  <th scope="col" className="num">
                    Bid
                  </th>
                  <th scope="col" className="num">
                    Ask
                  </th>
                  <th scope="col">Your order</th>
                </tr>
              </thead>
              <tbody>
                {exercise.kind === 'order-sim' ? (
                  <tr>
                    <th scope="row">1 (submitted)</th>
                    <td className="num">{formatMoney(exercise.quotes[0]!.bid)}</td>
                    <td className="num">{formatMoney(exercise.quotes[0]!.ask)}</td>
                    <td>Order placed; it can’t fill on this quote.</td>
                  </tr>
                ) : null}
                {result.orderOutcome.steps.map((s) => (
                  <tr key={s.index}>
                    <th scope="row">{s.index + 1}</th>
                    <td className="num">{formatMoney(s.quote.bid)}</td>
                    <td className="num">{formatMoney(s.quote.ask)}</td>
                    <td>{s.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </section>
  );
}
