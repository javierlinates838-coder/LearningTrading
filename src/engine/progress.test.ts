import { describe, expect, it } from 'vitest';
import {
  XP,
  completeLesson,
  dueReviews,
  emptyProgress,
  grant,
  levelFor,
  localDayKey,
  recordAttempt,
  recordLessonAnswer,
  skillStatus,
  startLesson,
  totalXp,
  upcomingReviews,
  weeklyGoalProgress,
  type ProgressState,
} from './progress';

const T0 = '2026-09-21T10:00:00.000Z';
const at = (minutes: number) => new Date(new Date(T0).getTime() + minutes * 60_000).toISOString();
const days = (n: number) => at(n * 24 * 60);

function attempt(p: ProgressState, itemId: string, correct: boolean, when: string, firstTry = true, context: 'lesson' | 'practice' | 'review' = 'lesson') {
  return recordAttempt(p, { itemId, skills: ['spread'], context, correct, at: when, firstTry });
}

describe('XP and completion', () => {
  it('grants each completion id only once', () => {
    let p = grant(emptyProgress(), 'lesson:a', 20, 'x', T0);
    p = grant(p, 'lesson:a', 20, 'x', T0);
    expect(totalXp(p)).toBe(20);
  });

  it('completes a lesson only when every exercise step is correct, and awards XP once', () => {
    let p = startLesson(emptyProgress(), 'u1-shares', 1, T0);
    const lesson = { id: 'u1-shares', kind: 'lesson' as const, minutes: 3, exerciseStepIds: ['a', 'b'] };
    p = recordLessonAnswer(p, 'u1-shares', 'a', true);
    expect(completeLesson(p, lesson, T0).completed).toBe(false);
    p = recordLessonAnswer(p, 'u1-shares', 'b', false);
    p = recordLessonAnswer(p, 'u1-shares', 'b', true);
    const first = completeLesson(p, lesson, T0);
    expect(first.completed).toBe(true);
    expect(first.xpGained).toBe(XP.lessonComplete);
    const again = completeLesson(first.progress, lesson, at(5));
    expect(again.xpGained).toBe(0);
    expect(totalXp(again.progress)).toBe(XP.lessonComplete);
  });

  it('awards checkpoint XP under a separate id', () => {
    let p = startLesson(emptyProgress(), 'u1-checkpoint', 1, T0);
    p = recordLessonAnswer(p, 'u1-checkpoint', 'x', true);
    const r = completeLesson(p, { id: 'u1-checkpoint', kind: 'checkpoint', minutes: 3, exerciseStepIds: ['x'] }, T0);
    expect(r.xpGained).toBe(XP.checkpointPass);
  });

  it('keeps the resume step and restarts when the lesson version changes', () => {
    let p = startLesson(emptyProgress(), 'l', 1, T0);
    p = { ...p, lessons: { ...p.lessons, l: { ...p.lessons.l!, stepIndex: 3 } } };
    expect(startLesson(p, 'l', 1, at(1)).lessons.l!.stepIndex).toBe(3);
    expect(startLesson(p, 'l', 2, at(1)).lessons.l!.stepIndex).toBe(0);
  });

  it('never grants XP for repeated practice of the same item', () => {
    let p = emptyProgress();
    p = attempt(p, 'i1', true, T0, true, 'practice').progress;
    const second = attempt(p, 'i1', true, at(1), true, 'practice');
    expect(second.xpGained).toBe(0);
  });

  it('computes levels', () => {
    expect(levelFor(0)).toEqual({ level: 1, into: 0, toNext: 100 });
    expect(levelFor(250)).toEqual({ level: 3, into: 50, toNext: 50 });
  });
});

describe('mastery and the review queue', () => {
  it('requires two different items correct on the first try to demonstrate a skill', () => {
    let p = attempt(emptyProgress(), 'i1', true, T0).progress;
    expect(skillStatus(p, 'spread')).toBe('practiced');
    p = attempt(p, 'i1', true, at(1)).progress;
    expect(skillStatus(p, 'spread')).toBe('practiced');
    const r = attempt(p, 'i2', true, at(2));
    expect(skillStatus(r.progress, 'spread')).toBe('demonstrated');
    expect(r.newlyDemonstrated).toEqual(['spread']);
    expect(r.xpGained).toBe(XP.skillDemonstrated);
  });

  it('puts a first-try miss into review and does not count a retry of the same item', () => {
    let p = attempt(emptyProgress(), 'i1', false, T0).progress;
    expect(skillStatus(p, 'spread')).toBe('needs-review');
    expect(dueReviews(p, T0)).toHaveLength(1);
    const retry = attempt(p, 'i1', true, at(1), false);
    p = retry.progress;
    expect(retry.xpGained).toBe(XP.fixMisconception);
    expect(p.review.spread!.successes).toBe(0);
    // A later first-try on the same missed item is not a changed example.
    p = attempt(p, 'i1', true, at(2)).progress;
    expect(p.review.spread!.successes).toBe(0);
  });

  it('clears a review after two successes on changed examples spaced a day apart', () => {
    let p = attempt(emptyProgress(), 'i1', false, T0).progress;
    const s1 = attempt(p, 'i2', true, at(5));
    p = s1.progress;
    expect(s1.xpGained).toBe(XP.reviewSuccess);
    expect(p.review.spread!.successes).toBe(1);
    expect(dueReviews(p, at(10))).toHaveLength(0);
    expect(upcomingReviews(p, at(10))).toHaveLength(1);

    // Answering early does not advance the review.
    p = attempt(p, 'i3', true, at(60)).progress;
    expect(p.review.spread!.successes).toBe(1);

    const s2 = attempt(p, 'i4', true, days(1.1));
    p = s2.progress;
    expect(p.review.spread).toBeUndefined();
    expect(p.reviewsCleared).toBe(1);
    expect(skillStatus(p, 'spread')).toBe('demonstrated');
  });

  it('restarts the cycle on a miss during review', () => {
    let p = attempt(emptyProgress(), 'i1', false, T0).progress;
    p = attempt(p, 'i2', true, at(5)).progress;
    p = attempt(p, 'i3', false, days(1.1)).progress;
    expect(p.review.spread!.successes).toBe(0);
    expect(p.review.spread!.missedItemId).toBe('i3');
  });

  it('caps the attempt log', () => {
    let p = emptyProgress();
    for (let k = 0; k < 520; k++) p = attempt(p, `i${k % 3}`, true, at(k), false).progress;
    expect(p.attemptLog).toHaveLength(500);
  });
});

describe('weekly goal', () => {
  it('counts days in the current week that met the goal', () => {
    const p = emptyProgress();
    const mon = new Date(2026, 8, 21, 12);
    const tue = new Date(2026, 8, 22, 12);
    const lastSun = new Date(2026, 8, 20, 12);
    p.activity[localDayKey(mon)] = { minutes: 6, actions: 3 };
    p.activity[localDayKey(tue)] = { minutes: 3, actions: 1 };
    p.activity[localDayKey(lastSun)] = { minutes: 30, actions: 9 };
    const w = weeklyGoalProgress(p, 5, new Date(2026, 8, 24, 9));
    expect(w).toEqual({ daysMet: 1, minutes: 9, targetDays: 4 });
  });
});
