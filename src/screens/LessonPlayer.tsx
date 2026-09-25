import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, Lifebuoy, Sparkle, Trophy } from '@phosphor-icons/react';
import { LESSONS, lessonById } from '../content';
import { useAppState, finishLesson, updateProgress, nowIso } from '../state/app';
import { setLessonStep, startLesson } from '../engine/progress';
import { usePageTitle } from '../components/Page';
import { RichText } from '../components/RichText';
import { Visual } from '../components/Visual';
import { HelpPanel } from '../components/HelpPanel';
import { SourcesDisclosure } from '../components/SourcesDisclosure';
import { ExerciseView } from '../exercises/ExerciseView';
import { NotFound } from './NotFound';
import type { Achievement } from '../state/achievements';
import { appStore } from '../storage/store';

export function LessonPlayer() {
  const { lessonId = '' } = useParams();
  const lesson = lessonById(lessonId);
  const { progress, settings, ready } = useAppState();
  const nav = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [finish, setFinish] = useState<{ xpGained: number; unlocked: Achievement[] } | null>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  usePageTitle(lesson?.title ?? 'Lesson');

  const ls = lesson ? progress.lessons[lesson.id] : undefined;
  const [completedBefore] = useState(() => appStateLesson(lessonId)?.status === 'completed');

  useEffect(() => {
    if (!ready || !lesson) return;
    const cur = appStateLesson(lesson.id);
    if (!cur || cur.lessonVersion !== lesson.version) updateProgress((p) => startLesson(p, lesson.id, lesson.version, nowIso()));
    else updateProgress((p) => (p.lastLessonId === lesson.id ? p : { ...p, lastLessonId: lesson.id }));  }, [ready, lesson]);

  const total = lesson ? lesson.steps.length + 1 : 0;
  const index = completedBefore ? reviewIndex : Math.min(ls?.stepIndex ?? 0, total - 1);
  const isRecap = lesson ? index === lesson.steps.length : false;

  useEffect(() => {
    stepHeading.current?.focus({ preventScroll: false });
  }, [index]);

  if (!ready) return <p className="muted">Loading…</p>;
  if (!lesson) return <NotFound what="lesson" />;

  const unlocked = settings.unlockAll || lesson.prerequisites.every((id) => progress.lessons[id]?.status === 'completed');
  if (!unlocked && !ls) {
    const missing = lesson.prerequisites.map(lessonById).find((l) => l && progress.lessons[l.id]?.status !== 'completed');
    return (
      <div className="player">
        <h1>{lesson.title}</h1>
        <p>This lesson builds on earlier ones. Finish {missing ? <Link to={`/learn/${missing.id}`}>{missing.title}</Link> : 'the previous lesson'} first.</p>
        <p className="small muted">Prefer to explore freely? You can open every lesson from Settings.</p>
        <Link to="/" className="btn">
          <ArrowLeft size={18} aria-hidden /> Back to Learn
        </Link>
      </div>
    );
  }

  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(total - 1, i));
    if (completedBefore) {
      setReviewIndex(clamped);
      return;
    }
    updateProgress((p) => setLessonStep(p, lesson.id, clamped));
    if (clamped === lesson.steps.length) {
      const r = finishLesson(lesson.id);
      if (r.completed) setFinish({ xpGained: r.xpGained, unlocked: r.unlocked });
    }
  };

  const step = lesson.steps[index];
  const answeredCorrect = step?.kind === 'exercise' ? !!ls?.answers[step.id]?.correct : true;
  const canContinue = isRecap || step?.kind === 'concept' || answeredCorrect;
  const pos = LESSONS.findIndex((l) => l.id === lesson.id);
  const nextLesson = LESSONS[pos + 1];
  const unitNumber = Number(lesson.unitId.slice(1));

  return (
    <div className="player">
      <div className="player-head">
        <Link to="/" className="icon-btn" aria-label="Back to Learn">
          <ArrowLeft size={22} aria-hidden />
        </Link>
        <div>
          <p className="xs muted" style={{ margin: 0 }}>
            Unit {unitNumber} · {lesson.kind === 'checkpoint' ? 'Checkpoint' : lesson.title}
          </p>
          <div className="progress-bar" role="progressbar" aria-label="Lesson progress" aria-valuemin={1} aria-valuemax={total} aria-valuenow={index + 1} aria-valuetext={`Step ${index + 1} of ${total}`}>
            <span style={{ width: `${((index + 1) / total) * 100}%` }} />
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHelpOpen(true)}>
          <Lifebuoy size={18} aria-hidden /> Help
        </button>
      </div>
      <p className="xs muted" style={{ margin: 0 }} aria-live="polite">
        Step {index + 1} of {total}
        {completedBefore ? ' · reviewing a completed lesson' : ''}
      </p>

      {index === 0 ? (
        <div>
          <h1 style={{ fontSize: 'var(--text-lg)', marginBottom: 4 }}>{lesson.title}</h1>
          <p className="small muted" style={{ marginBottom: 0 }}>
            Goal: {lesson.objective}
          </p>
        </div>
      ) : (
        <h1 className="visually-hidden">{lesson.title}</h1>
      )}

      <div className="player-step fade-in" key={index}>
        {step?.kind === 'concept' ? (
          <section className="stack" aria-labelledby={`step-${step.id}`}>
            <h2 id={`step-${step.id}`} className="concept-title" ref={stepHeading} tabIndex={-1}>
              {step.title}
            </h2>
            <RichText text={step.body} />
            {step.visual ? <Visual visual={step.visual} /> : null}
            {step.more ? (
              <details className="disclosure">
                <summary>Tell me more</summary>
                <div className="disclosure-body">
                  <RichText text={step.more} />
                </div>
              </details>
            ) : null}
          </section>
        ) : null}

        {step?.kind === 'exercise' ? (
          <>
            <h2 className="visually-hidden" ref={stepHeading} tabIndex={-1}>
              Question
            </h2>
            <ExerciseView
              key={`${lesson.id}:${step.id}`}
              exercise={step.exercise}
              context={lesson.kind === 'checkpoint' ? 'checkpoint' : 'lesson'}
              lessonId={lesson.id}
              stepId={step.id}
              priorAttempts={ls?.answers[step.id]?.attempts ?? 0}
              alreadyCorrect={answeredCorrect}
              seed={lesson.id}
              headingLevel={3}
            />
          </>
        ) : null}

        {isRecap ? (
          <section className="stack" aria-labelledby="recap-h">
            <h2 id="recap-h" ref={stepHeading} tabIndex={-1} className="concept-title">
              {lesson.kind === 'checkpoint' ? (
                <>
                  <Trophy size={24} aria-hidden className="mastery" style={{ verticalAlign: '-4px' }} /> Checkpoint passed
                </>
              ) : (
                'Lesson recap'
              )}
            </h2>
            <ul>
              {lesson.recap.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {finish && finish.xpGained ? (
              <p className="xp-note">
                <Sparkle size={16} weight="fill" aria-hidden /> +{finish.xpGained} XP for completing this {lesson.kind === 'checkpoint' ? 'checkpoint' : 'lesson'}
              </p>
            ) : null}
            {finish?.unlocked.map((a) => (
              <p key={a.id} className="mastery" style={{ fontWeight: 700 }}>
                Achievement earned: {a.title}
              </p>
            ))}
            <SourcesDisclosure lesson={lesson} />
          </section>
        ) : null}
      </div>

      <div className="player-foot">
        {index > 0 ? (
          <button type="button" className="btn" onClick={() => goTo(index - 1)}>
            <ArrowLeft size={18} aria-hidden /> Previous
          </button>
        ) : null}
        {!isRecap ? (
          <button type="button" className="btn btn-primary" disabled={!canContinue} onClick={() => goTo(index + 1)} aria-describedby={!canContinue ? 'continue-hint' : undefined}>
            Continue <ArrowRight size={18} aria-hidden />
          </button>
        ) : nextLesson ? (
          <button type="button" className="btn btn-primary" onClick={() => nav(`/learn/${nextLesson.id}`)}>
            Next: {nextLesson.title} <ArrowRight size={18} aria-hidden />
          </button>
        ) : (
          <Link to="/progress" className="btn btn-primary">
            See your progress
          </Link>
        )}
        {isRecap ? (
          <Link to="/" className="btn">
            Back to Learn
          </Link>
        ) : null}
      </div>
      {!canContinue ? (
        <p id="continue-hint" className="hint" style={{ textAlign: 'right', marginTop: -8 }}>
          Answer correctly to continue. You can retry as many times as you like.
        </p>
      ) : null}
      <HelpPanel lesson={lesson} open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

function appStateLesson(id: string) {
  return appStore.getSnapshot().progress.lessons[id];
}

export function LessonRoute() {
  const { lessonId = '' } = useParams();
  return <LessonPlayer key={lessonId} />;
}
