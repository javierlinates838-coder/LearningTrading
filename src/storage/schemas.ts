import { z } from 'zod';
import { progressSchema, emptyProgress, type ProgressState } from '../engine/progress';
import { assumptionsSchema, DEFAULT_ASSUMPTIONS, simStateSchema, type SimState } from '../sim/engine';
import { journalSchema, type JournalState } from '../sim/journal';
import type { StorageKey } from './db';

export const settingsSchema = z.object({
  onboarded: z.boolean(),
  nickname: z.string().max(40),
  studyGoalMinutes: z.union([z.literal(5), z.literal(10), z.null()]),
  motion: z.enum(['system', 'reduce', 'full']),
  textScale: z.union([z.literal(100), z.literal(115), z.literal(130)]),
  /** Chosen at onboarding ("I know some basics"): every lesson is open, prerequisites become suggestions. */
  unlockAll: z.boolean(),
  simAssumptions: assumptionsSchema,
});
export type Settings = z.infer<typeof settingsSchema>;

export const defaultSettings = (): Settings => ({
  onboarded: false,
  nickname: '',
  studyGoalMinutes: null,
  motion: 'system',
  textScale: 100,
  unlockAll: false,
  simAssumptions: { ...DEFAULT_ASSUMPTIONS },
});

export interface AppData {
  settings: Settings;
  progress: ProgressState;
  sim: SimState | null;
  journal: JournalState;
}

export const CURRENT_SCHEMA: Record<StorageKey, number> = {
  settings: 1,
  progress: 1,
  sim: 1,
  journal: 1,
};

export const schemas = {
  settings: settingsSchema,
  progress: progressSchema,
  sim: simStateSchema.nullable(),
  journal: journalSchema,
} as const;

export const defaults: { [K in StorageKey]: () => AppData[K] } = {
  settings: defaultSettings,
  progress: emptyProgress,
  sim: () => null,
  journal: () => ({ entries: [] }),
};

type Migration = (data: unknown) => unknown;

/**
 * Migrations keyed by the version they upgrade FROM. Each migration must
 * produce data valid for the next version. Version 1 is the first released
 * schema, so there are no entries yet; the loader still runs this path and
 * tests exercise it with a fixture registry.
 */
export const MIGRATIONS: Record<StorageKey, Record<number, Migration>> = {
  settings: {},
  progress: {},
  sim: {},
  journal: {},
};

export type MigrationResult<T> =
  | { ok: true; data: T; migrated: boolean }
  | { ok: false; reason: 'newer-version' | 'invalid' | 'missing-migration'; detail: string };

export function migrateAndValidate<K extends StorageKey>(
  key: K,
  schemaVersion: number,
  raw: unknown,
  registry: Record<StorageKey, Record<number, Migration>> = MIGRATIONS,
  current: Record<StorageKey, number> = CURRENT_SCHEMA,
): MigrationResult<AppData[K]> {
  const target = current[key];
  if (schemaVersion > target) {
    return { ok: false, reason: 'newer-version', detail: `Saved ${key} uses version ${schemaVersion}; this app understands up to ${target}.` };
  }
  let data = raw;
  let v = schemaVersion;
  while (v < target) {
    const m = registry[key][v];
    if (!m) return { ok: false, reason: 'missing-migration', detail: `No migration for ${key} from version ${v}.` };
    data = m(data);
    v++;
  }
  const parsed = schemas[key].safeParse(data);
  if (!parsed.success) return { ok: false, reason: 'invalid', detail: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  return { ok: true, data: parsed.data as AppData[K], migrated: schemaVersion !== target };
}
