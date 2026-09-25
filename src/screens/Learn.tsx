import { Link } from 'react-router';
import { ArrowRight, ArrowsClockwise, CalendarCheck } from '@phosphor-icons/react';
import { useAppState } from '../state/app';
import { LESSONS, lessonById } from '../content';
import { skillById } from '../content/skills';
import { dueReviews, levelFor, totalXp, weeklyGoalProgress } from '../engine/progress';
import { Page } from '../components/Page';
import { Pathway } from '../components/Pathway';
import { Onboarding } from './Onboarding';

export function Learn() {
  const { settings, progress, ready } = useAppState();
  if (!ready) return <p className="muted">Loading your progress…</p>;
  if (!settings.onboarded) return <Onboarding />;

  const done = (id: string) => progress.lessons[id]?.status === 'completed';
  const last = progress.lastLessonId ? lessonById(progress.lastLessonId) : undefined;
  const resume = last && progress.lessons[last.id]?.status === 'in-progress' ? last : undefined;
  const next = resume ?? LESSONS.find((l) => !done(l.id) && (settings.unlockAll || l.prerequisites.every(done)));
  const completed = LESSONS.filter((l) => done(l.id)).length;
  const due = dueReviews(progress, new Date().toISOString());
  const xp = totalXp(progress);
  const lvl = levelFor(xp);
  const week = settings.studyGoalMinutes ? weeklyGoalProgress(progress, settings.studyGoalMinutes, new Date()) : null;
  const stepInfo = resume ? progress.lessons[resume.id] : undefined;

  const aside = (
    <>
      <section className="card" aria-labelledby="summary-h">
        <h2 id="summary-h" className="eyebrow">
          Your progress
        </h2>
        <dl className="kv">
          <dt>Lessons completed</dt>
          <dd>
            {completed} of {LESSONS.length}
          </dd>
          <dt>Learning XP</dt>
          <dd>
            {xp} · level {lvl.level}
          </dd>
        </dl>
        <Link to="/progress" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}>
          See skills and achievements
        </Link>
      </section>
      <section className="card" aria-labelledby="review-h">
        <h2 id="review-h" className="eyebrow">
          Review queue
        </h2>
        {due.length ? (
          <>
            <p>
              {due.length} skill{due.length === 1 ? '' : 's'} ready for a quick check on a new example:{' '}
              {due
                .slice(0, 3)
                .map((d) => skillById(d.skillId)?.name ?? d.skillId)
                .join(', ')}
              {due.length > 3 ? '…' : ''}
            </p>
            <Link to="/practice/review" className="btn btn-sm">
              <ArrowsClockwise size={18} aria-hidden /> Review now
            </Link>
          </>
        ) : (
          <p className="small muted" style={{ marginBottom: 0 }}>
            Nothing due. When you miss a question on the first try, that skill comes back here with a different example.
          </p>
        )}
      </section>
      {week ? (
        <section className="card" aria-labelledby="goal-h">
          <h2 id="goal-h" className="eyebrow">
            Weekly goal
          </h2>
          <p style={{ marginBottom: 8 }}>
            <CalendarCheck size={18} aria-hidden style={{ verticalAlign: '-3px' }} /> {Math.min(week.daysMet, week.targetDays)} of {week.targetDays} days this week with{' '}
            {settings.studyGoalMinutes}+ minutes
          </p>
          <div className="progress-bar mastery" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (week.daysMet / week.targetDays) * 100)}%` }} />
          </div>
          <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
            Minutes are estimated from lessons and answers. Missed days don’t reset anything.
          </p>
        </section>
      ) : null}
    </>
  );

  return (
    <Page title="Learn" heading={settings.nickname ? `Welcome back, ${settings.nickname}` : 'Learn'} aside={aside}>
      {next ? (
        <section className="card card-raised feature-card" aria-labelledby="continue-h" style={{ marginBottom: 'var(--space-6)' }}>
          <p className="eyebrow">{resume ? 'Continue where you left off' : completed ? 'Up next' : 'Start here'}</p>
          <h2 id="continue-h">{next.title}</h2>
          <p className="muted">{next.objective}</p>
          {stepInfo ? (
            <p className="small muted">
              Step {stepInfo.stepIndex + 1} of {next.steps.length + 1}
            </p>
          ) : null}
          <Link to={`/learn/${next.id}`} className="btn btn-primary">
            {resume ? 'Continue lesson' : 'Start lesson'} <ArrowRight size={18} aria-hidden />
          </Link>
        </section>
      ) : (
        <section className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <h2>You’ve finished every lesson</h2>
          <p className="muted">Keep skills fresh in Practice, or test ideas in the simulator with virtual money.</p>
          <div className="btn-row">
            <Link to="/practice" className="btn btn-primary">
              Practice
            </Link>
            <Link to="/simulator" className="btn">
              Simulator
            </Link>
          </div>
        </section>
      )}
      <Pathway progress={progress} unlockAll={settings.unlockAll} currentId={next?.id} />
    </Page>
  );
}
