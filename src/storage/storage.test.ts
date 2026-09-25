import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { indexedDbBackend, memoryBackend, openIndexedDb, StorageError, type StorageBackend } from './db';
import { AppStore } from './store';
import { CURRENT_SCHEMA, defaultSettings, migrateAndValidate, MIGRATIONS } from './schemas';
import { applyImport, buildExport, parseImport } from './backup';
import { emptyProgress, grant, startLesson } from '../engine/progress';
import { createSim } from '../sim/engine';

let factory: IDBFactory;
beforeEach(() => {
  factory = new IDBFactory();
});

async function backend(): Promise<StorageBackend> {
  return indexedDbBackend(await openIndexedDb(factory));
}

describe('IndexedDB backend', () => {
  it('saves and reloads data across store instances', async () => {
    const a = new AppStore();
    await a.init(await backend());
    a.update('settings', (s) => ({ ...s, onboarded: true, nickname: 'Sam' }));
    a.update('progress', (p) => grant(startLesson(p, 'u1-shares', 1, 'now'), 'lesson:u1-shares', 20, 'x', 'now'));
    await a.flush();

    const b = new AppStore();
    await b.init(await backend());
    expect(b.getSnapshot().settings.nickname).toBe('Sam');
    expect(b.getSnapshot().progress.awards['lesson:u1-shares']?.xp).toBe(20);
    expect(b.getSnapshot().storageMode).toBe('indexeddb');
  });

  it('rejects a stale write instead of overwriting another tab', async () => {
    const be = await backend();
    await be.put('settings', defaultSettings(), 1, 0, 'tab-a');
    await expect(be.put('settings', defaultSettings(), 1, 0, 'tab-b')).rejects.toMatchObject({ code: 'conflict' });
    expect((await be.get('settings'))?.writer).toBe('tab-a');
  });

  it('pauses saving and reports a conflict when another tab wrote first', async () => {
    const tabA = new AppStore();
    const tabB = new AppStore();
    await tabA.init(await backend());
    await tabB.init(await backend());
    tabA.update('settings', (s) => ({ ...s, nickname: 'A' }));
    await tabA.flush();
    tabB.update('settings', (s) => ({ ...s, nickname: 'B' }));
    await tabB.flush();
    expect(tabB.getSnapshot().issues.some((i) => i.kind === 'conflict')).toBe(true);
    const fresh = new AppStore();
    await fresh.init(await backend());
    expect(fresh.getSnapshot().settings.nickname).toBe('A');
  });

  it('quarantines a corrupt record instead of deleting it', async () => {
    const be = await backend();
    await be.put('progress', { lessons: 'not an object' }, 1, 0, 'tab-x');
    const s = new AppStore();
    await s.init(be);
    expect(s.getSnapshot().issues.some((i) => i.kind === 'corrupt' && i.key === 'progress')).toBe(true);
    expect(s.getSnapshot().progress).toEqual(emptyProgress());
    const keys = await be.keys();
    const q = keys.find((k) => k.startsWith('quarantine:progress:'));
    expect(q).toBeDefined();
    expect(((await be.get(q!))?.data as { data: unknown }).data).toEqual({ lessons: 'not an object' });
  });

  it('leaves data from a newer app version untouched and does not write over it', async () => {
    const be = await backend();
    await be.put('journal', { entries: [], futureField: true }, 99, 0, 'future');
    const s = new AppStore();
    await s.init(be);
    expect(s.getSnapshot().issues.some((i) => i.kind === 'newer-version')).toBe(true);
    s.update('journal', () => ({ entries: [] }));
    await s.flush();
    const rec = await be.get('journal');
    expect(rec?.schemaVersion).toBe(99);
    expect(rec?.writer).toBe('future');
  });

  it('reports quota errors without losing the in-memory change', async () => {
    const failing: StorageBackend = {
      ...memoryBackend(),
      put: () => Promise.reject(new StorageError('quota', 'full')),
    };
    const s = new AppStore();
    await s.init(failing);
    s.update('settings', (x) => ({ ...x, nickname: 'Kept' }));
    await s.flush();
    expect(s.getSnapshot().settings.nickname).toBe('Kept');
    expect(s.getSnapshot().issues.some((i) => i.kind === 'quota')).toBe(true);
  });

  it('reports blocked storage as unavailable', async () => {
    const blocked = {
      open: () => {
        throw new Error('The operation is insecure.');
      },
    } as unknown as IDBFactory;
    await expect(openIndexedDb(blocked)).rejects.toMatchObject({ code: 'unavailable' });
  });
});

describe('migrations', () => {
  it('runs registered migrations in order and validates the result', () => {
    const registry = { ...MIGRATIONS, settings: { 1: (d: unknown) => ({ ...(d as object), textScale: 100 }) } };
    const current = { ...CURRENT_SCHEMA, settings: 2 };
    const old = { onboarded: true, nickname: '', studyGoalMinutes: 5, motion: 'system', unlockAll: false, simAssumptions: { feePerFill: 50, slippagePerShare: 1 } };
    const r = migrateAndValidate('settings', 1, old, registry, current);
    expect(r).toMatchObject({ ok: true, migrated: true, data: { textScale: 100 } });
  });

  it('reports a missing migration instead of guessing', () => {
    const r = migrateAndValidate('settings', 1, {}, MIGRATIONS, { ...CURRENT_SCHEMA, settings: 3 });
    expect(r).toMatchObject({ ok: false, reason: 'missing-migration' });
  });
});

describe('backup export and import', () => {
  const base = () => ({
    settings: { ...defaultSettings(), onboarded: true, nickname: 'Here' },
    progress: emptyProgress(),
    sim: null,
    journal: { entries: [] },
  });

  it('round-trips an export', () => {
    const data = { ...base(), sim: createSim('steady-climb') };
    data.progress = grant(data.progress, 'lesson:u1-shares', 20, 'x', 'now');
    const parsed = parseImport(buildExport(data));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data).toEqual(data);
      expect(parsed.summary.xpAwards).toBe(1);
      expect(parsed.summary.hasSimulator).toBe(true);
    }
  });

  it('rejects invalid files with a clear message', () => {
    expect(parseImport('not json')).toMatchObject({ ok: false });
    expect(parseImport('{"hello":1}')).toMatchObject({ ok: false });
    const bad = JSON.parse(buildExport(base()));
    bad.data.progress = { lessons: 7 };
    expect(parseImport(JSON.stringify(bad))).toMatchObject({ ok: false });
  });

  it('merges progress without losing either side, and keeps local settings', () => {
    const local = base();
    local.progress = grant(local.progress, 'lesson:a', 20, 'x', 't1');
    const incoming = { ...base(), settings: { ...defaultSettings(), nickname: 'There' } };
    incoming.progress = grant(incoming.progress, 'lesson:b', 20, 'x', 't2');
    const merged = applyImport(local, incoming, 'merge');
    expect(Object.keys(merged.progress.awards).sort()).toEqual(['lesson:a', 'lesson:b']);
    expect(merged.settings.nickname).toBe('Here');
    const replaced = applyImport(local, incoming, 'replace');
    expect(Object.keys(replaced.progress.awards)).toEqual(['lesson:b']);
    expect(replaced.settings.nickname).toBe('There');
  });

  it('keeps simulator reset separate from learning progress', async () => {
    const s = new AppStore();
    await s.init(await backend());
    s.update('progress', (p) => grant(p, 'lesson:x', 20, 'x', 'now'));
    s.update('sim', () => createSim('steady-climb'));
    s.update('sim', () => null);
    await s.flush();
    const r = new AppStore();
    await r.init(await backend());
    expect(r.getSnapshot().sim).toBeNull();
    expect(r.getSnapshot().progress.awards['lesson:x']).toBeDefined();
  });
});
