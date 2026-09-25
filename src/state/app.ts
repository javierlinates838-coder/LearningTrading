import { useSyncExternalStore } from 'react';
import { appStore, type AppState } from '../storage/store';
import type { Exercise } from '../content/schema';
import type { GradeResult } from '../engine/grading';
import {
  XP,
  completeLesson,
  grant,
  recordAttempt,
  recordLessonAnswer,
  type AttemptContext,
  type ProgressState,
} from '../engine/progress';
import { exerciseStepIds, lessonById } from '../content';
import { evaluateAchievements, type Achievement } from './achievements';
import { journalEntryFor, type JournalState, type Reflection } from '../sim/journal';
import type { SimState } from '../sim/engine';

export function useAppState(): AppState {
  return useSyncExternalStore(appStore.subscribe, appStore.getSnapshot, appStore.getSnapshot);
}

export const nowIso = () => new Date().toISOString();

export interface AnswerOutcome {
  xpGained: number;
  notes: string[];
  unlocked: Achievement[];
  newlyDemonstrated: string[];
}

export function submitAnswer(params: {
  exercise: Exercise;
  result: GradeResult;
  context: AttemptContext;
  firstTry: boolean;
  lessonId?: string;
  stepId?: string;
}): AnswerOutcome {
  const at = nowIso();
  let out: AnswerOutcome = { xpGained: 0, notes: [], unlocked: [], newlyDemonstrated: [] };
  appStore.update('progress', (prev) => {
    const r = recordAttempt(prev, {
      itemId: params.exercise.id,
      skills: params.exercise.skills,
      context: params.context,
      correct: params.result.correct,
      misconception: params.result.misconception,
      at,
      firstTry: params.firstTry,
    });
    let p = r.progress;
    if (params.lessonId && params.stepId) p = recordLessonAnswer(p, params.lessonId, params.stepId, params.result.correct);
    const a = evaluateAchievements(p, appStore.getSnapshot().journal, at);
    out = { xpGained: r.xpGained, notes: r.notes, unlocked: a.unlocked, newlyDemonstrated: r.newlyDemonstrated };
    return a.progress;
  });
  return out;
}

export function finishLesson(lessonId: string): { completed: boolean; xpGained: number; unlocked: Achievement[] } {
  const lesson = lessonById(lessonId);
  if (!lesson) return { completed: false, xpGained: 0, unlocked: [] };
  const at = nowIso();
  let out = { completed: false, xpGained: 0, unlocked: [] as Achievement[] };
  appStore.update('progress', (prev) => {
    const r = completeLesson(prev, { id: lesson.id, kind: lesson.kind, minutes: lesson.minutes, exerciseStepIds: exerciseStepIds(lesson) }, at);
    const a = evaluateAchievements(r.progress, appStore.getSnapshot().journal, at);
    out = { completed: r.completed, xpGained: r.xpGained, unlocked: a.unlocked };
    return r.completed ? a.progress : prev;
  });
  return out;
}

/**
 * A lesson whose saved step is the recap but whose completion write did not
 * land (tab closed within milliseconds) is completed on the next start.
 * completeLesson still requires every exercise to have been answered.
 */
export function reconcileLessons() {
  const { progress } = appStore.getSnapshot();
  for (const [id, ls] of Object.entries(progress.lessons)) {
    const lesson = lessonById(id);
    if (lesson && ls.status !== 'completed' && ls.stepIndex >= lesson.steps.length) finishLesson(id);
  }
}

export function updateProgress(fn: (p: ProgressState) => ProgressState) {
  appStore.update('progress', fn);
}

/** Add journal entries for any closed trades in this run that are not yet journaled. Idempotent. */
export function syncJournal(sim: SimState | null): string[] {
  if (!sim) return [];
  const { journal } = appStore.getSnapshot();
  const have = new Set(journal.entries.map((e) => e.id));
  const created = sim.trades
    .filter((t) => t.status === 'closed' && !have.has(`${sim.runId}:${t.id}`))
    .map((t) => journalEntryFor(sim, t.id, nowIso()))
    .filter((e): e is NonNullable<typeof e> => e !== null);
  if (created.length) appStore.update('journal', (j) => ({ entries: [...j.entries, ...created] }));
  return created.map((e) => e.id);
}

export function saveReflection(entryId: string, reflection: Omit<Reflection, 'savedAt'>): { xpGained: number; unlocked: Achievement[] } {
  const at = nowIso();
  appStore.update('journal', (j: JournalState) => ({
    entries: j.entries.map((e) => (e.id === entryId ? { ...e, reflection: { ...reflection, savedAt: at } } : e)),
  }));
  let out = { xpGained: 0, unlocked: [] as Achievement[] };
  appStore.update('progress', (prev) => {
    let p = prev;
    if (reflection.whatHappened.trim().length >= 10) p = grant(p, `reflection:${entryId}`, XP.journalReflection, 'Reflected on a simulated trade', at);
    const a = evaluateAchievements(p, appStore.getSnapshot().journal, at);
    const before = Object.values(prev.awards).reduce((s, x) => s + x.xp, 0);
    const after = Object.values(a.progress.awards).reduce((s, x) => s + x.xp, 0);
    out = { xpGained: after - before, unlocked: a.unlocked };
    return a.progress;
  });
  return out;
}
