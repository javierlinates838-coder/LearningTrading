import { Link } from 'react-router';
import { Check, Flag, LockSimple, Play, Circle } from '@phosphor-icons/react';
import { UNITS, lessonById } from '../content';
import type { Lesson } from '../content/schema';
import type { ProgressState } from '../engine/progress';

export type LessonStatus = 'done' | 'current' | 'in-progress' | 'available' | 'locked';

export function lessonStatus(lesson: Lesson, p: ProgressState, unlockAll: boolean, currentId: string | undefined): LessonStatus {
  const ls = p.lessons[lesson.id];
  if (ls?.status === 'completed') return 'done';
  if (lesson.id === currentId) return 'current';
  if (ls?.status === 'in-progress') return 'in-progress';
  const unlocked = unlockAll || lesson.prerequisites.every((id) => p.lessons[id]?.status === 'completed');
  return unlocked ? 'available' : 'locked';
}

const STATUS_TEXT: Record<LessonStatus, string> = {
  done: 'Completed',
  current: 'Up next',
  'in-progress': 'In progress',
  available: 'Available',
  locked: 'Locked',
};

/** Connected lesson pathway: one continuous line per unit, nodes show state with icon and text, not color alone. */
export function Pathway({ progress, unlockAll, currentId }: { progress: ProgressState; unlockAll: boolean; currentId: string | undefined }) {
  return (
    <ol className="pathway" aria-label="Course pathway">
      {UNITS.map((u) => {
        const done = u.lessons.filter((l) => progress.lessons[l.id]?.status === 'completed').length;
        return (
          <li key={u.id} className="unit-block">
            <div className="spread" style={{ marginBottom: 8 }}>
              <h2 id={`unit-${u.id}`} style={{ marginBottom: 0 }}>
                <span className="muted" style={{ fontWeight: 500 }}>
                  Unit {u.number} ·{' '}
                </span>
                {u.title}
              </h2>
              <span className={`pill ${done === u.lessons.length ? 'pill-mastery' : ''}`}>
                {done} of {u.lessons.length} done
              </span>
            </div>
            <p className="small muted">{u.summary}</p>
            <ol className="path" aria-labelledby={`unit-${u.id}`}>
              {u.lessons.map((l) => {
                const st = lessonStatus(l, progress, unlockAll, currentId);
                const missing = l.prerequisites.filter((id) => progress.lessons[id]?.status !== 'completed').map((id) => lessonById(id)?.title ?? id);
                const Icon = st === 'done' ? Check : st === 'locked' ? LockSimple : st === 'current' ? Play : l.kind === 'checkpoint' ? Flag : Circle;
                return (
                  <li key={l.id} className={`path-item is-${st} ${l.kind === 'checkpoint' ? 'is-checkpoint' : ''}`}>
                    <span className="path-node" aria-hidden="true">
                      <span>
                        <Icon size={18} weight={st === 'done' || st === 'current' ? 'bold' : 'regular'} />
                      </span>
                    </span>
                    {st === 'locked' ? (
                      <div className="path-link" aria-disabled="true">
                        <span className="title">{l.title}</span>
                        <span className="meta">
                          Locked · finish “{missing[0]}” first
                        </span>
                      </div>
                    ) : (
                      <Link to={`/learn/${l.id}`} className="path-link" aria-current={st === 'current' ? 'step' : undefined}>
                        <span className="title">
                          {l.kind === 'checkpoint' ? 'Checkpoint: ' : ''}
                          {l.title}
                        </span>
                        <span className="meta">
                          {STATUS_TEXT[st]} · about {l.minutes} min
                          {unlockAll && missing.length && st !== 'done' ? ' · suggested after earlier lessons' : ''}
                        </span>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </li>
        );
      })}
    </ol>
  );
}
