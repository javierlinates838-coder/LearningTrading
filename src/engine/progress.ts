import { z } from 'zod';

export const XP = {
  lessonComplete: 20,
  checkpointPass: 30,
  fixMisconception: 5,
  skillDemonstrated: 15,
  reviewSuccess: 5,
  practiceFirstCorrect: 3,
  journalReflection: 10,
} as const;

export const XP_PER_LEVEL = 100;

/** Review spacing after each successful review, in days. Two successes clear the skill. */
export const REVIEW_INTERVAL_DAYS = [1] as const;
export const REVIEW_SUCCESSES_TO_CLEAR = 2;
/** Distinct items that must be answered correctly on the first try to demonstrate a skill. */
export const ITEMS_TO_DEMONSTRATE = 2;

export type AttemptContext = 'lesson' | 'checkpoint' | 'practice' | 'review';

const lessonStateSchema = z.object({
  status: z.enum(['in-progress', 'completed']),
  lessonVersion: z.number().int(),
  stepIndex: z.number().int().nonnegative(),
  /** Per exercise step: attempts so far and whether it is now answered correctly. */
  answers: z.record(z.string(), z.object({ attempts: z.number().int(), correct: z.boolean() })),
  startedAt: z.string(),
  completedAt: z.string().optional(),
});

const itemStateSchema = z.object({
  attempts: z.number().int(),
  firstTryCorrect: z.boolean(),
  everCorrect: z.boolean(),
  everMissed: z.boolean(),
  lastCorrect: z.boolean(),
  lastAt: z.string(),
});

const reviewStateSchema = z.object({
  cycleId: z.string(),
  successes: z.number().int().nonnegative(),
  dueAt: z.string(),
  missedItemId: z.string(),
});

export const progressSchema = z.object({
  lessons: z.record(z.string(), lessonStateSchema),
  items: z.record(z.string(), itemStateSchema),
  /** Distinct item ids answered correctly on the first try, per skill. */
  skillCorrect: z.record(z.string(), z.array(z.string())),
  skillAttempted: z.record(z.string(), z.boolean()),
  review: z.record(z.string(), reviewStateSchema),
  reviewsCleared: z.number().int().nonnegative(),
  awards: z.record(z.string(), z.object({ xp: z.number().int(), reason: z.string(), at: z.string() })),
  achievements: z.record(z.string(), z.string()),
  activity: z.record(z.string(), z.object({ minutes: z.number(), actions: z.number().int() })),
  lastLessonId: z.string().optional(),
  attemptLog: z.array(
    z.object({
      itemId: z.string(),
      context: z.enum(['lesson', 'checkpoint', 'practice', 'review']),
      correct: z.boolean(),
      misconception: z.string().optional(),
      at: z.string(),
    }),
  ),
});

export type ProgressState = z.infer<typeof progressSchema>;
export type LessonState = z.infer<typeof lessonStateSchema>;
export type ReviewState = z.infer<typeof reviewStateSchema>;

export const ATTEMPT_LOG_LIMIT = 500;

export function emptyProgress(): ProgressState {
  return {
    lessons: {},
    items: {},
    skillCorrect: {},
    skillAttempted: {},
    review: {},
    reviewsCleared: 0,
    awards: {},
    achievements: {},
    activity: {},
    attemptLog: [],
  };
}

export function totalXp(p: ProgressState): number {
  return Object.values(p.awards).reduce((sum, a) => sum + a.xp, 0);
}

export function levelFor(xp: number) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const into = xp % XP_PER_LEVEL;
  return { level, into, toNext: XP_PER_LEVEL - into };
}

/** Idempotent award: the same completion id can only ever be granted once. */
export function grant(p: ProgressState, completionId: string, xp: number, reason: string, at: string): ProgressState {
  if (p.awards[completionId]) return p;
  return { ...p, awards: { ...p.awards, [completionId]: { xp, reason, at } } };
}

function addActivity(p: ProgressState, at: string, minutes: number): ProgressState {
  const k = localDayKey(new Date(at));
  const cur = p.activity[k] ?? { minutes: 0, actions: 0 };
  return { ...p, activity: { ...p.activity, [k]: { minutes: cur.minutes + minutes, actions: cur.actions + 1 } } };
}

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();
}

export type SkillStatus = 'not-started' | 'practiced' | 'needs-review' | 'demonstrated';

export function skillStatus(p: ProgressState, skillId: string): SkillStatus {
  if (p.review[skillId]) return 'needs-review';
  if ((p.skillCorrect[skillId]?.length ?? 0) >= ITEMS_TO_DEMONSTRATE) return 'demonstrated';
  if (p.skillAttempted[skillId]) return 'practiced';
  return 'not-started';
}

export interface AttemptInput {
  itemId: string;
  skills: string[];
  context: AttemptContext;
  correct: boolean;
  misconception?: string;
  at: string;
  /** True for the first submission of this item in the current presentation (not a retry). */
  firstTry: boolean;
}

export interface AttemptOutcome {
  progress: ProgressState;
  xpGained: number;
  notes: string[];
  newlyDemonstrated: string[];
}

/**
 * Record one graded submission.
 *
 * Review rule: a first-try miss on an item puts each of its skills in the
 * review queue (due immediately). A correct first-try answer on a *different*
 * item for that skill, once the review is due, counts as one review success.
 * After the first success the next review is due one day later; the second
 * success clears it. A miss during review restarts the cycle.
 *
 * Demonstrated: at least two different items for the skill answered correctly
 * on the first try, with no review pending.
 */
export function recordAttempt(prev: ProgressState, input: AttemptInput): AttemptOutcome {
  const xpBefore = totalXp(prev);
  const statusBefore = Object.fromEntries(input.skills.map((s) => [s, skillStatus(prev, s)]));
  const notes: string[] = [];
  let p: ProgressState = { ...prev };

  const item = p.items[input.itemId];
  const firstTryInThisSitting = input.firstTry;

  p.items = {
    ...p.items,
    [input.itemId]: {
      attempts: (item?.attempts ?? 0) + 1,
      firstTryCorrect: item ? item.firstTryCorrect : input.correct,
      everCorrect: (item?.everCorrect ?? false) || input.correct,
      everMissed: (item?.everMissed ?? false) || !input.correct,
      lastCorrect: input.correct,
      lastAt: input.at,
    },
  };
  p.attemptLog = [
    ...p.attemptLog,
    { itemId: input.itemId, context: input.context, correct: input.correct, misconception: input.misconception, at: input.at },
  ].slice(-ATTEMPT_LOG_LIMIT);

  const skillAttempted = { ...p.skillAttempted };
  const skillCorrect = { ...p.skillCorrect };
  const review = { ...p.review };

  for (const skill of input.skills) {
    skillAttempted[skill] = true;
    const existing = review[skill];
    if (!input.correct && firstTryInThisSitting) {
      review[skill] = { cycleId: input.at, successes: 0, dueAt: input.at, missedItemId: input.itemId };
      continue;
    }
    if (!input.correct && existing) {
      review[skill] = { ...existing, successes: 0, dueAt: input.at };
      continue;
    }
    if (input.correct && firstTryInThisSitting) {
      const list = skillCorrect[skill] ?? [];
      if (!list.includes(input.itemId) && existing?.missedItemId !== input.itemId) skillCorrect[skill] = [...list, input.itemId];
      if (existing && existing.missedItemId !== input.itemId && existing.dueAt <= input.at) {
        const successes = existing.successes + 1;
        p = grant(p, `review:${skill}:${existing.cycleId}:${successes}`, XP.reviewSuccess, 'Review answered on a new example', input.at);
        if (successes >= REVIEW_SUCCESSES_TO_CLEAR) {
          delete review[skill];
          p = { ...p, reviewsCleared: p.reviewsCleared + 1 };
          notes.push('Review cleared for this skill.');
        } else {
          const interval = REVIEW_INTERVAL_DAYS[Math.min(successes - 1, REVIEW_INTERVAL_DAYS.length - 1)] ?? 1;
          review[skill] = { ...existing, successes, dueAt: addDays(input.at, interval) };
          notes.push('Nice. This skill comes back once more for a spaced check.');
        }
      }
    }
  }

  p = { ...p, skillAttempted, skillCorrect, review };

  if (input.correct && item && item.everMissed && !item.everCorrect) {
    p = grant(p, `fix:${input.itemId}`, XP.fixMisconception, 'Corrected a misconception', input.at);
  }
  if (input.correct && input.context === 'practice') {
    p = grant(p, `practice:${input.itemId}`, XP.practiceFirstCorrect, 'Practice item solved', input.at);
  }

  const newlyDemonstrated: string[] = [];
  for (const skill of input.skills) {
    if (statusBefore[skill] !== 'demonstrated' && skillStatus(p, skill) === 'demonstrated') {
      newlyDemonstrated.push(skill);
      p = grant(p, `skill:${skill}`, XP.skillDemonstrated, 'Skill demonstrated on a new example', input.at);
    }
  }

  p = addActivity(p, input.at, 1);
  return { progress: p, xpGained: totalXp(p) - xpBefore, notes, newlyDemonstrated };
}

export function startLesson(p: ProgressState, lessonId: string, lessonVersion: number, at: string): ProgressState {
  const existing = p.lessons[lessonId];
  if (existing && existing.lessonVersion === lessonVersion) return { ...p, lastLessonId: lessonId };
  return {
    ...p,
    lastLessonId: lessonId,
    lessons: {
      ...p.lessons,
      [lessonId]: {
        status: existing?.status === 'completed' ? 'completed' : 'in-progress',
        lessonVersion,
        stepIndex: 0,
        answers: {},
        startedAt: existing?.startedAt ?? at,
        completedAt: existing?.completedAt,
      },
    },
  };
}

export function setLessonStep(p: ProgressState, lessonId: string, stepIndex: number): ProgressState {
  const ls = p.lessons[lessonId];
  if (!ls) return p;
  return { ...p, lastLessonId: lessonId, lessons: { ...p.lessons, [lessonId]: { ...ls, stepIndex } } };
}

export function recordLessonAnswer(p: ProgressState, lessonId: string, stepId: string, correct: boolean): ProgressState {
  const ls = p.lessons[lessonId];
  if (!ls) return p;
  const prev = ls.answers[stepId];
  return {
    ...p,
    lessons: {
      ...p.lessons,
      [lessonId]: { ...ls, answers: { ...ls.answers, [stepId]: { attempts: (prev?.attempts ?? 0) + 1, correct: (prev?.correct ?? false) || correct } } },
    },
  };
}

/** A lesson completes only when every exercise step has been answered correctly (retries allowed). */
export function completeLesson(
  p: ProgressState,
  lesson: { id: string; kind: 'lesson' | 'checkpoint'; minutes: number; exerciseStepIds: string[] },
  at: string,
): { progress: ProgressState; completed: boolean; xpGained: number } {
  const ls = p.lessons[lesson.id];
  if (!ls) return { progress: p, completed: false, xpGained: 0 };
  const allCorrect = lesson.exerciseStepIds.every((sid) => ls.answers[sid]?.correct);
  if (!allCorrect) return { progress: p, completed: false, xpGained: 0 };
  const before = totalXp(p);
  let next: ProgressState = {
    ...p,
    lessons: { ...p.lessons, [lesson.id]: { ...ls, status: 'completed', completedAt: ls.completedAt ?? at } },
  };
  next =
    lesson.kind === 'checkpoint'
      ? grant(next, `checkpoint:${lesson.id}`, XP.checkpointPass, 'Unit checkpoint passed', at)
      : grant(next, `lesson:${lesson.id}`, XP.lessonComplete, 'Lesson completed', at);
  if (!p.lessons[lesson.id]?.completedAt) next = addActivity(next, at, lesson.minutes);
  return { progress: next, completed: true, xpGained: totalXp(next) - before };
}

export function dueReviews(p: ProgressState, now: string): Array<{ skillId: string } & ReviewState> {
  return Object.entries(p.review)
    .filter(([, r]) => r.dueAt <= now)
    .map(([skillId, r]) => ({ skillId, ...r }))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export function upcomingReviews(p: ProgressState, now: string) {
  return Object.entries(p.review)
    .filter(([, r]) => r.dueAt > now)
    .map(([skillId, r]) => ({ skillId, ...r }));
}

/** Days in the ISO week (Mon–Sun) containing `now` on which the study goal was met. */
export function weeklyGoalProgress(p: ProgressState, goalMinutes: number, now: Date) {
  const day = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - day);
  let daysMet = 0;
  let minutes = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const k = localDayKey(d);
    const a = p.activity[k];
    if (a) {
      minutes += a.minutes;
      if (a.minutes >= goalMinutes) daysMet++;
    }
  }
  return { daysMet, minutes, targetDays: 4 };
}

export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
