import { forwardRef } from 'react';
import { CheckCircle, Info, Sparkle } from '@phosphor-icons/react';
import type { GradeResult } from '../engine/grading';
import { InlineText } from './RichText';

/**
 * Calm, specific feedback. Wrong answers name the likely misunderstanding
 * and invite a retry; they never shame or use alarm colors.
 */
export const FeedbackPanel = forwardRef<
  HTMLDivElement,
  {
    result: GradeResult;
    attempts: number;
    rubricNote?: string;
    xpGained?: number;
    notes?: string[];
    achievements?: string[];
  }
>(function FeedbackPanel({ result, attempts, rubricNote, xpGained, notes, achievements }, ref) {
  const showExplanation = result.correct || attempts >= 2;
  const details = (result.details ?? []).filter((d) => !result.feedback.includes(d));
  return (
    <div ref={ref} tabIndex={-1} className={`feedback fade-in ${result.correct ? 'is-correct' : 'is-wrong'}`} role="status" aria-live="polite">
      <p className="feedback-title">
        {result.correct ? <CheckCircle size={24} weight="fill" aria-hidden /> : <Info size={24} weight="fill" aria-hidden />}
        {result.correct ? 'Correct' : 'Not quite yet'}
      </p>
      <p>
        <InlineText text={result.feedback} />
      </p>
      {details.length ? (
        <ul className="small">
          {details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      ) : null}
      {!result.correct && attempts < 2 ? <p className="small muted">Adjust your answer and check again. Your progress is saved.</p> : null}
      {showExplanation ? (
        <div className="feedback-explain">
          <p className="small" style={{ fontWeight: 700, marginBottom: 4 }}>
            Why
          </p>
          <p className="small">
            <InlineText text={result.explanation} />
          </p>
          {rubricNote ? <p className="rubric-note">{rubricNote}</p> : null}
        </div>
      ) : null}
      {xpGained ? (
        <p className="xp-note" style={{ marginTop: 8, marginBottom: 0 }}>
          <Sparkle size={16} weight="fill" aria-hidden /> +{xpGained} XP for learning
        </p>
      ) : null}
      {notes?.map((n) => (
        <p key={n} className="small" style={{ marginTop: 8, marginBottom: 0 }}>
          {n}
        </p>
      ))}
      {achievements?.map((a) => (
        <p key={a} className="small mastery" style={{ marginTop: 8, marginBottom: 0, fontWeight: 700 }}>
          Achievement earned: {a}
        </p>
      ))}
    </div>
  );
});
