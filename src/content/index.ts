import { unitSchema, type Exercise, type ExerciseKind, type Lesson, type Unit } from './schema';
import { unit01 } from './units/unit01';
import { unit02 } from './units/unit02';
import { unit03 } from './units/unit03';
import { unit04 } from './units/unit04';
import { unit05 } from './units/unit05';
import { unit06 } from './units/unit06';
import { unit07 } from './units/unit07';
import { unit08 } from './units/unit08';
import { unit09 } from './units/unit09';
import { unit10 } from './units/unit10';

const RAW_UNITS: Unit[] = [unit01, unit02, unit03, unit04, unit05, unit06, unit07, unit08, unit09, unit10];

/** Parsed once at startup so malformed authored content fails loudly in development and tests. */
export const UNITS: Unit[] = RAW_UNITS.map((u) => unitSchema.parse(u));

export const LESSONS: Lesson[] = UNITS.flatMap((u) => u.lessons);

const lessonIndex = new Map(LESSONS.map((l) => [l.id, l]));
export const lessonById = (id: string): Lesson | undefined => lessonIndex.get(id);

export const unitById = (id: string): Unit | undefined => UNITS.find((u) => u.id === id);

export interface ExerciseRef {
  exercise: Exercise;
  lessonId: string;
  stepId: string;
  unitId: string;
}

export const EXERCISES: ExerciseRef[] = LESSONS.flatMap((l) =>
  l.steps.flatMap((s) => (s.kind === 'exercise' ? [{ exercise: s.exercise, lessonId: l.id, stepId: s.id, unitId: l.unitId }] : [])),
);

const exerciseIndex = new Map(EXERCISES.map((e) => [e.exercise.id, e]));
export const exerciseById = (id: string): ExerciseRef | undefined => exerciseIndex.get(id);

export function exercisesFor(filter: { kinds?: ExerciseKind[]; skills?: string[] }): ExerciseRef[] {
  return EXERCISES.filter(
    (e) =>
      (!filter.kinds || filter.kinds.includes(e.exercise.kind)) &&
      (!filter.skills || e.exercise.skills.some((s) => filter.skills!.includes(s))),
  );
}

export function exerciseStepIds(lesson: Lesson): string[] {
  return lesson.steps.filter((s) => s.kind === 'exercise').map((s) => s.id);
}

export function nextLesson(completed: (id: string) => boolean): Lesson | undefined {
  return LESSONS.find((l) => !completed(l.id));
}

export function isUnlocked(lesson: Lesson, completed: (id: string) => boolean): boolean {
  return lesson.prerequisites.every(completed);
}

/** Glossary and source references in authored text use [[term-id]] or [[term-id|shown text]]. */
export const TERM_PATTERN = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g;

export function termRefs(text: string): string[] {
  return [...text.matchAll(TERM_PATTERN)].map((m) => m[1]!);
}

export function plainText(text: string, termLabel: (id: string) => string): string {
  return text.replace(TERM_PATTERN, (_all, id: string, shown?: string) => shown ?? termLabel(id));
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}$]/u.test(w)).length;
}
