import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, ArrowsClockwise, ChartBar, Crosshair, Scales, ShoppingCart, SquaresFour, CheckCircle } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { EXERCISES, lessonById, type ExerciseRef } from '../content';
import { SKILLS, skillById } from '../content/skills';
import { dueReviews, skillStatus } from '../engine/progress';
import { seededShuffle } from '../engine/random';
import { useAppState } from '../state/app';
import { appStore } from '../storage/store';
import { Page, usePageTitle } from '../components/Page';
import { ExerciseView } from '../exercises/ExerciseView';
import { NotFound } from './NotFound';

interface Lab {
  id: string;
  title: string;
  description: string;
  icon: Icon;
  filter: (e: ExerciseRef) => boolean;
}

export const LABS: Lab[] = [
  {
    id: 'candle-lab',
    title: 'Candle Lab',
    description: 'Build candles from rules, label their parts, and match numbers to shapes.',
    icon: SquaresFour,
    filter: (e) => ['candle-build', 'label-parts'].includes(e.exercise.kind) || e.exercise.skills.some((s) => s === 'ohlc' || s === 'candle-anatomy'),
  },
  {
    id: 'chart-detective',
    title: 'Chart Detective',
    description: 'Find trends, confirmed swing points and support or resistance zones.',
    icon: Crosshair,
    filter: (e) => ['candle-pick', 'zone'].includes(e.exercise.kind) && !e.exercise.skills.includes('ohlc'),
  },
  {
    id: 'order-lab',
    title: 'Order Lab',
    description: 'Predict fills for market, limit and stop orders, including spreads and gaps.',
    icon: ShoppingCart,
    filter: (e) => e.exercise.kind === 'order-sim' || e.exercise.skills.some((s) => ['spread', 'market-vs-limit', 'stop-orders', 'order-management'].includes(s)),
  },
  {
    id: 'risk-builder',
    title: 'Risk Builder',
    description: 'Size positions to a risk budget, including fees and slippage.',
    icon: Scales,
    filter: (e) => e.exercise.kind === 'risk-build' || e.exercise.skills.some((s) => ['position-sizing', 'reward-risk', 'costs-slippage'].includes(s)),
  },
  {
    id: 'decisions',
    title: 'Decision Scenarios',
    description: 'Choose an action and the reason behind it. Graded on reasoning, not outcome.',
    icon: ChartBar,
    filter: (e) => e.exercise.kind === 'decision',
  },
];

export function Practice() {
  const { progress } = useAppState();
  const due = dueReviews(progress, new Date().toISOString());
  const practiced = SKILLS.filter((s) => skillStatus(progress, s.id) !== 'not-started');
  return (
    <Page title="Practice" intro="Practice any item as often as you like. XP comes only from the first correct answer on each item.">
      <section className="card card-raised" aria-labelledby="rq-h" style={{ marginBottom: 'var(--space-5)' }}>
        <h2 id="rq-h">
          <ArrowsClockwise size={22} aria-hidden style={{ verticalAlign: '-4px' }} /> Review queue
        </h2>
        {due.length ? (
          <>
            <p>
              {due.length} skill{due.length === 1 ? ' is' : 's are'} ready for a check on a different example.
            </p>
            <Link to="/practice/review" className="btn btn-primary">
              Start review
            </Link>
          </>
        ) : (
          <p className="muted" style={{ marginBottom: 0 }}>
            Nothing is due. Skills you miss on the first try will appear here with a new example.
          </p>
        )}
      </section>

      <h2>Labs</h2>
      <ul className="list grid-2" style={{ marginBottom: 'var(--space-6)' }}>
        {LABS.map((lab) => {
          const count = EXERCISES.filter(lab.filter).length;
          const Icon = lab.icon;
          return (
            <li key={lab.id}>
              <Link to={`/practice/lab/${lab.id}`} className="list-link" style={{ alignItems: 'flex-start', height: '100%' }}>
                <Icon size={28} aria-hidden style={{ flex: 'none', color: 'var(--color-accent)' }} />
                <span className="grow">
                  <strong>{lab.title}</strong>
                  <span className="small muted" style={{ display: 'block' }}>
                    {lab.description}
                  </span>
                  <span className="xs faint">{count} items</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <h2>Targeted practice</h2>
      {practiced.length ? (
        <ul className="list">
          {practiced.map((s) => {
            const st = skillStatus(progress, s.id);
            return (
              <li key={s.id}>
                <Link to={`/practice/skill/${s.id}`} className="list-link">
                  <span className="grow">{s.name}</span>
                  <span className={`pill ${st === 'demonstrated' ? 'pill-mastery' : st === 'needs-review' ? 'pill-warn' : 'pill-accent'}`}>
                    {st === 'demonstrated' ? '★ Demonstrated' : st === 'needs-review' ? 'Review due' : 'Practiced'}
                  </span>
                  <ArrowRight size={18} aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">Skills appear here once you’ve tried them in a lesson.</p>
      )}
    </Page>
  );
}

function buildSession(mode: string, arg: string | undefined, seed: string): { title: string; items: ExerciseRef[]; intro: string } | null {
  const progress = appStore.getSnapshot().progress;
  if (mode === 'lab') {
    const lab = LABS.find((l) => l.id === arg);
    if (!lab) return null;
    return { title: lab.title, intro: lab.description, items: seededShuffle(EXERCISES.filter(lab.filter), seed).slice(0, 8) };
  }
  if (mode === 'skill') {
    const skill = arg ? skillById(arg) : undefined;
    if (!skill) return null;
    const pool = EXERCISES.filter((e) => e.exercise.skills.includes(skill.id));
    const fresh = pool.filter((e) => !progress.items[e.exercise.id]);
    return { title: skill.name, intro: 'Items that use this skill, unseen ones first.', items: [...seededShuffle(fresh, seed), ...seededShuffle(pool.filter((e) => !fresh.includes(e)), seed)].slice(0, 6) };
  }
  if (mode === 'review') {
    const due = dueReviews(progress, new Date().toISOString());
    const items: ExerciseRef[] = [];
    for (const r of due.slice(0, 6)) {
      const pool = EXERCISES.filter((e) => e.exercise.skills.includes(r.skillId) && e.exercise.id !== r.missedItemId && !items.includes(e));
      const unseen = pool.filter((e) => !progress.items[e.exercise.id]);
      const pick = seededShuffle(unseen.length ? unseen : pool, `${seed}:${r.skillId}`)[0];
      if (pick) items.push(pick);
    }
    return { title: 'Review', intro: 'One new example for each skill that’s due. Answer on the first try to count it.', items };
  }
  return null;
}

export function PracticeSession() {
  const { mode = '', arg } = useParams();
  const [seed] = useState(() => `s${Date.now()}`);
  const session = useMemo(() => buildSession(mode, arg, seed), [mode, arg, seed]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [attempted, setAttempted] = useState<Record<string, boolean>>({});
  usePageTitle(session ? `Practice: ${session.title}` : 'Practice');
  const { progress } = useAppState();
  if (!session) return <NotFound what="practice set" />;

  const done = index >= session.items.length;
  const ref = session.items[index];
  const correctCount = Object.values(results).filter(Boolean).length;

  return (
    <div className="player">
      <div className="player-head">
        <Link to="/practice" className="icon-btn" aria-label="Back to Practice">
          <ArrowLeft size={22} aria-hidden />
        </Link>
        <div>
          <p className="xs muted" style={{ margin: 0 }}>
            Practice · {session.title}
          </p>
          <div className="progress-bar" role="progressbar" aria-label="Practice progress" aria-valuemin={0} aria-valuemax={session.items.length} aria-valuenow={Math.min(index, session.items.length)}>
            <span style={{ width: `${session.items.length ? (Math.min(index, session.items.length) / session.items.length) * 100 : 100}%` }} />
          </div>
        </div>
        <span className="xs muted num">
          {Math.min(index + 1, session.items.length)}/{session.items.length}
        </span>
      </div>
      <h1 style={{ fontSize: 'var(--text-lg)' }}>{session.title}</h1>

      {session.items.length === 0 ? (
        <div className="empty">
          <p>There’s nothing to practice here right now.</p>
          <Link to="/practice" className="btn">
            Back to Practice
          </Link>
        </div>
      ) : done ? (
        <section className="card stack" aria-live="polite">
          <h2>
            <CheckCircle size={24} aria-hidden className="up" style={{ verticalAlign: '-5px' }} /> Set complete
          </h2>
          <p>
            {correctCount} of {session.items.length} answered correctly (retries included).
          </p>
          {mode === 'review' && dueReviews(progress, new Date().toISOString()).length === 0 ? <p className="mastery">Your review queue is clear for now.</p> : null}
          <div className="btn-row">
            <Link to="/practice" className="btn btn-primary">
              Back to Practice
            </Link>
            <Link to="/" className="btn">
              Learn
            </Link>
          </div>
        </section>
      ) : ref ? (
        <>
          <p className="xs muted" style={{ margin: 0 }}>
            From: {lessonById(ref.lessonId)?.title}
          </p>
          <ExerciseView
            key={`${seed}:${ref.exercise.id}`}
            exercise={ref.exercise}
            context={mode === 'review' ? 'review' : 'practice'}
            seed={seed}
            onCorrect={() => setResults((r) => ({ ...r, [ref.exercise.id]: true }))}
          />
          <div className="player-foot">
            <button
              type="button"
              className={`btn ${results[ref.exercise.id] ? 'btn-primary' : ''}`}
              onClick={() => {
                setAttempted((a) => ({ ...a, [ref.exercise.id]: true }));
                setIndex((i) => i + 1);
              }}
            >
              {results[ref.exercise.id] ? 'Next item' : attempted[ref.exercise.id] ? 'Next' : 'Skip for now'} <ArrowRight size={18} aria-hidden />
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
