import { Link } from 'react-router';
import { Medal, LockSimple } from '@phosphor-icons/react';
import { useAppState } from '../state/app';
import { LESSONS, UNITS } from '../content';
import { SKILLS } from '../content/skills';
import { XP, XP_PER_LEVEL, dueReviews, levelFor, localDayKey, skillStatus, totalXp, upcomingReviews, type SkillStatus } from '../engine/progress';
import { ACHIEVEMENTS } from '../state/achievements';
import { Page } from '../components/Page';

const STATUS: Record<SkillStatus, { label: string; cls: string }> = {
  'not-started': { label: 'Not started', cls: '' },
  practiced: { label: 'Practiced', cls: 'pill-accent' },
  'needs-review': { label: 'Review due', cls: 'pill-warn' },
  demonstrated: { label: '★ Demonstrated', cls: 'pill-mastery' },
};

export function Progress() {
  const { progress, settings } = useAppState();
  const xp = totalXp(progress);
  const lvl = levelFor(xp);
  const now = new Date().toISOString();
  const due = dueReviews(progress, now);
  const upcoming = upcomingReviews(progress, now);
  const completed = LESSONS.filter((l) => progress.lessons[l.id]?.status === 'completed').length;
  const counts = SKILLS.reduce<Record<SkillStatus, number>>(
    (acc, s) => {
      acc[skillStatus(progress, s.id)]++;
      return acc;
    },
    { 'not-started': 0, practiced: 0, 'needs-review': 0, demonstrated: 0 },
  );
  const days = Array.from({ length: 7 }, (_, k) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - k));
    const key = localDayKey(d);
    return { key, label: d.toLocaleDateString('en-US', { weekday: 'short' }), minutes: Math.round(progress.activity[key]?.minutes ?? 0) };
  });
  const goal = settings.studyGoalMinutes;

  return (
    <Page title="Progress" intro="Completed means you finished a lesson. Demonstrated means you answered different examples correctly on the first try.">
      <div className="grid-2" style={{ marginBottom: 'var(--space-5)' }}>
        <section className="card">
          <h2 className="eyebrow">Lessons</h2>
          <p className="num" style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, margin: 0 }}>
            {completed} <span className="muted small">of {LESSONS.length} completed</span>
          </p>
          <div className="progress-bar" aria-hidden="true" style={{ marginTop: 8 }}>
            <span style={{ width: `${(completed / LESSONS.length) * 100}%` }} />
          </div>
        </section>
        <section className="card">
          <h2 className="eyebrow">Skills</h2>
          <dl className="kv">
            <dt>Demonstrated</dt>
            <dd className="mastery">{counts.demonstrated}</dd>
            <dt>Practiced</dt>
            <dd>{counts.practiced}</dd>
            <dt>Review due or scheduled</dt>
            <dd>{counts['needs-review']}</dd>
            <dt>Not started</dt>
            <dd>{counts['not-started']}</dd>
          </dl>
        </section>
        <section className="card">
          <h2 className="eyebrow">Learning XP</h2>
          <p className="num" style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, margin: 0 }}>
            {xp} <span className="muted small">· level {lvl.level}</span>
          </p>
          <div className="progress-bar mastery" aria-hidden="true" style={{ marginTop: 8 }}>
            <span style={{ width: `${(lvl.into / XP_PER_LEVEL) * 100}%` }} />
          </div>
          <p className="small muted" style={{ marginTop: 6, marginBottom: 0 }}>
            {lvl.toNext} XP to level {lvl.level + 1}
          </p>
        </section>
      </div>

      <section className="card" aria-labelledby="reviews-h">
        <h2 id="reviews-h">Review queue</h2>
        <p className="small muted">
          Rules-based, not AI: missing a question on the first try schedules that skill for review. A correct first try on a different example counts as one success; the second success, at least a day later,
          clears it.
        </p>
        {due.length || upcoming.length ? (
          <ul className="list">
            {due.map((r) => (
              <li key={r.skillId} className="spread">
                <span>{SKILLS.find((s) => s.id === r.skillId)?.name ?? r.skillId}</span>
                <span className="pill pill-warn">Due now</span>
              </li>
            ))}
            {upcoming.map((r) => (
              <li key={r.skillId} className="spread">
                <span>{SKILLS.find((s) => s.id === r.skillId)?.name ?? r.skillId}</span>
                <span className="pill">Next check {new Date(r.dueAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ marginBottom: 0 }}>Nothing scheduled right now.</p>
        )}
        {due.length ? (
          <Link to="/practice/review" className="btn btn-primary" style={{ marginTop: 12 }}>
            Review now
          </Link>
        ) : null}
      </section>

      <section className="card" aria-labelledby="activity-h">
        <h2 id="activity-h">Last 7 days</h2>
        <div className="week" role="list">
          {days.map((d) => (
            <div key={d.key} className="day" role="listitem" aria-label={`${d.label}: about ${d.minutes} minutes${goal && d.minutes >= goal ? ', goal met' : ''}`}>
              <span className={`dot ${goal && d.minutes >= goal ? 'met' : ''}`} aria-hidden>
                {d.minutes}
              </span>
              <span aria-hidden>{d.label}</span>
            </div>
          ))}
        </div>
        <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
          Estimated minutes of study. {goal ? `Highlighted days met your ${goal}-minute goal.` : 'Set an optional goal in Settings.'}
        </p>
      </section>

      <section className="card" aria-labelledby="skills-h">
        <h2 id="skills-h">Skills by unit</h2>
        <div className="stack">
          {UNITS.map((u) => (
            <div key={u.id}>
              <h3 className="small" style={{ marginBottom: 6 }}>
                Unit {u.number}: {u.title}
              </h3>
              <ul className="list">
                {SKILLS.filter((s) => s.unitId === u.id).map((s) => {
                  const st = STATUS[skillStatus(progress, s.id)];
                  return (
                    <li key={s.id} className="spread">
                      <span>{s.name}</span>
                      <span className={`pill ${st.cls}`}>{st.label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="card" aria-labelledby="ach-h">
        <h2 id="ach-h">Achievements</h2>
        <p className="small muted">Earned for understanding and reflection. Never for profit or number of trades.</p>
        <ul className="list grid-2">
          {ACHIEVEMENTS.map((a) => {
            const at = progress.achievements[a.id];
            return (
              <li key={a.id} className={`achievement ${at ? 'is-earned' : ''}`}>
                <span className="badge-icon" aria-hidden>
                  {at ? <Medal size={22} weight="fill" /> : <LockSimple size={20} />}
                </span>
                <span>
                  <strong>{a.title}</strong>
                  <span className="small muted" style={{ display: 'block' }}>
                    {at ? `Earned ${new Date(at).toLocaleDateString()}` : 'Not yet'} · {a.description}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card" aria-labelledby="xp-h">
        <h2 id="xp-h">How XP works</h2>
        <table>
          <tbody>
            {(
              [
                ['Complete a lesson', XP.lessonComplete],
                ['Pass a checkpoint', XP.checkpointPass],
                ['Demonstrate a skill (two different items right on the first try)', XP.skillDemonstrated],
                ['Fix a misconception (right after a miss)', XP.fixMisconception],
                ['Review success on a new example', XP.reviewSuccess],
                ['First correct answer on a practice item', XP.practiceFirstCorrect],
                ['Reflect on a simulated trade', XP.journalReflection],
              ] as const
            ).map(([k, v]) => (
              <tr key={k}>
                <th scope="row" style={{ fontWeight: 400 }}>
                  {k}
                </th>
                <td className="num">+{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>
          Each award can only be earned once. Simulated profit, trade count and time spent never give XP. {XP_PER_LEVEL} XP per level.
        </p>
      </section>
    </Page>
  );
}
