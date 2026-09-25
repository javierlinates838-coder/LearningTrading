import { z } from 'zod';
import { APP_NAME } from '../config/app';
import { ATTEMPT_LOG_LIMIT, type ProgressState } from '../engine/progress';
import type { JournalState } from '../sim/journal';
import { CURRENT_SCHEMA, migrateAndValidate, type AppData } from './schemas';

export const EXPORT_FORMAT = 'marketquest-backup';
export const EXPORT_VERSION = 1;

const envelopeSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  exportVersion: z.literal(EXPORT_VERSION),
  exportedAt: z.string(),
  app: z.string(),
  schema: z.object({ settings: z.number(), progress: z.number(), sim: z.number(), journal: z.number() }),
  data: z.object({ settings: z.unknown(), progress: z.unknown(), sim: z.unknown(), journal: z.unknown() }),
});

export function buildExport(data: AppData, now = new Date().toISOString()): string {
  return JSON.stringify(
    {
      format: EXPORT_FORMAT,
      exportVersion: EXPORT_VERSION,
      exportedAt: now,
      app: APP_NAME,
      schema: CURRENT_SCHEMA,
      data,
    },
    null,
    2,
  );
}

export interface ImportSummary {
  lessonsCompleted: number;
  xpAwards: number;
  journalEntries: number;
  exportedAt: string;
  hasSimulator: boolean;
}

export type ParsedImport = { ok: true; data: AppData; summary: ImportSummary } | { ok: false; error: string };

export const MAX_IMPORT_BYTES = 5_000_000;

export function parseImport(text: string): ParsedImport {
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, error: 'That file is too large to be a backup from this app.' };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  const env = envelopeSchema.safeParse(json);
  if (!env.success) return { ok: false, error: 'That file is not a backup created by this app.' };
  const out: Partial<AppData> = {};
  for (const key of ['settings', 'progress', 'sim', 'journal'] as const) {
    const r = migrateAndValidate(key, env.data.schema[key], env.data.data[key]);
    if (!r.ok) return { ok: false, error: `The backup's ${key} section could not be read (${r.reason}). Nothing was changed.` };
    (out as Record<string, unknown>)[key] = r.data;
  }
  const data = out as AppData;
  return {
    ok: true,
    data,
    summary: {
      lessonsCompleted: Object.values(data.progress.lessons).filter((l) => l.status === 'completed').length,
      xpAwards: Object.keys(data.progress.awards).length,
      journalEntries: data.journal.entries.length,
      exportedAt: env.data.exportedAt,
      hasSimulator: data.sim !== null,
    },
  };
}

/**
 * Merge policy: learning progress and journal entries are combined; nothing
 * already earned on this device is lost. Settings and the current simulator
 * session on this device are kept as they are.
 */
export function mergeProgress(a: ProgressState, b: ProgressState): ProgressState {
  const lessons = { ...a.lessons };
  for (const [id, lb] of Object.entries(b.lessons)) {
    const la = lessons[id];
    if (!la) lessons[id] = lb;
    else if (la.status !== 'completed' && lb.status === 'completed') lessons[id] = lb;
    else if (la.status === lb.status && lb.stepIndex > la.stepIndex && la.lessonVersion === lb.lessonVersion) lessons[id] = lb;
  }
  const items = { ...a.items };
  for (const [id, ib] of Object.entries(b.items)) {
    const ia = items[id];
    items[id] = ia
      ? {
          attempts: Math.max(ia.attempts, ib.attempts),
          firstTryCorrect: ia.firstTryCorrect && ib.firstTryCorrect,
          everCorrect: ia.everCorrect || ib.everCorrect,
          everMissed: ia.everMissed || ib.everMissed,
          lastCorrect: ia.lastAt >= ib.lastAt ? ia.lastCorrect : ib.lastCorrect,
          lastAt: ia.lastAt >= ib.lastAt ? ia.lastAt : ib.lastAt,
        }
      : ib;
  }
  const skillCorrect: Record<string, string[]> = { ...a.skillCorrect };
  for (const [k, v] of Object.entries(b.skillCorrect)) skillCorrect[k] = [...new Set([...(skillCorrect[k] ?? []), ...v])];
  const skillAttempted = { ...a.skillAttempted, ...Object.fromEntries(Object.entries(b.skillAttempted).filter(([, v]) => v)) };
  const review = { ...b.review, ...a.review };
  const activity = { ...a.activity };
  for (const [d, v] of Object.entries(b.activity)) {
    const cur = activity[d];
    activity[d] = cur ? { minutes: Math.max(cur.minutes, v.minutes), actions: Math.max(cur.actions, v.actions) } : v;
  }
  const seen = new Set<string>();
  const attemptLog = [...a.attemptLog, ...b.attemptLog]
    .filter((x) => {
      const k = `${x.itemId}@${x.at}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((x, y) => x.at.localeCompare(y.at))
    .slice(-ATTEMPT_LOG_LIMIT);
  return {
    lessons,
    items,
    skillCorrect,
    skillAttempted,
    review,
    reviewsCleared: Math.max(a.reviewsCleared, b.reviewsCleared),
    awards: { ...b.awards, ...a.awards },
    achievements: { ...b.achievements, ...a.achievements },
    activity,
    lastLessonId: a.lastLessonId ?? b.lastLessonId,
    attemptLog,
  };
}

export function mergeJournal(a: JournalState, b: JournalState): JournalState {
  const byId = new Map(a.entries.map((e) => [e.id, e]));
  for (const e of b.entries) {
    const cur = byId.get(e.id);
    if (!cur) byId.set(e.id, e);
    else if (!cur.reflection && e.reflection) byId.set(e.id, e);
    else if (cur.reflection && e.reflection && e.reflection.savedAt > cur.reflection.savedAt) byId.set(e.id, e);
  }
  return { entries: [...byId.values()].sort((x, y) => x.createdAt.localeCompare(y.createdAt)) };
}

export function applyImport(current: AppData, incoming: AppData, mode: 'merge' | 'replace'): AppData {
  if (mode === 'replace') return incoming;
  return {
    settings: current.settings,
    sim: current.sim,
    progress: mergeProgress(current.progress, incoming.progress),
    journal: mergeJournal(current.journal, incoming.journal),
  };
}
