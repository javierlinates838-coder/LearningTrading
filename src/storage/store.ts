import {
  indexedDbBackend,
  memoryBackend,
  openIndexedDb,
  STORAGE_KEYS,
  StorageError,
  type StorageBackend,
  type StorageKey,
} from './db';
import { CURRENT_SCHEMA, defaults, migrateAndValidate, type AppData } from './schemas';

export interface StorageIssue {
  id: string;
  kind: 'unavailable' | 'quota' | 'conflict' | 'corrupt' | 'newer-version' | 'write-failed' | 'other-tab';
  message: string;
  key?: StorageKey;
}

export interface AppState extends AppData {
  ready: boolean;
  storageMode: 'indexeddb' | 'memory';
  issues: StorageIssue[];
  lastSavedAt: string | null;
}

type Listener = () => void;

const TAB_ID = `tab-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Application store with write-through persistence. Each slice is written in
 * its own atomic transaction immediately after a meaningful change. Writes use
 * compare-and-set on a revision number so that a second tab can never silently
 * overwrite newer data; instead the user is told and asked to reload.
 */
export class AppStore {
  private state: AppState;
  private listeners = new Set<Listener>();
  private backend: StorageBackend = memoryBackend();
  private revs: Record<StorageKey, number> = { settings: 0, progress: 0, sim: 0, journal: 0 };
  private queues: Record<StorageKey, Promise<void>> = {
    settings: Promise.resolve(),
    progress: Promise.resolve(),
    sim: Promise.resolve(),
    journal: Promise.resolve(),
  };
  private blockedKeys = new Set<StorageKey>();
  private channel: BroadcastChannel | null = null;

  constructor() {
    this.state = {
      ready: false,
      storageMode: 'memory',
      issues: [],
      lastSavedAt: null,
      settings: defaults.settings(),
      progress: defaults.progress(),
      sim: defaults.sim(),
      journal: defaults.journal(),
    };
  }

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  getSnapshot = () => this.state;

  private emit() {
    for (const l of this.listeners) l();
  }

  private setState(patch: Partial<AppState>) {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  private addIssue(issue: StorageIssue) {
    if (this.state.issues.some((i) => i.id === issue.id)) return;
    this.setState({ issues: [...this.state.issues, issue] });
  }

  dismissIssue(id: string) {
    this.setState({ issues: this.state.issues.filter((i) => i.id !== id) });
  }

  async init(backend?: StorageBackend) {
    if (backend) this.backend = backend;
    else {
      try {
        this.backend = indexedDbBackend(await openIndexedDb());
      } catch (e) {
        this.backend = memoryBackend();
        const err = e as StorageError;
        this.addIssue({
          id: 'storage-unavailable',
          kind: 'unavailable',
          message:
            err.code === 'blocked'
              ? 'Saving is paused because another tab is using an older version of this app. Close other tabs and reload.'
              : 'This browser is not allowing saved data (private mode or blocked storage). You can keep learning, but progress will be lost when you close the tab. Export a backup from Settings to keep it.',
        });
      }
    }

    const loaded: Partial<AppData> = {};
    for (const key of STORAGE_KEYS) {
      try {
        const rec = await this.backend.get(key);
        if (!rec) {
          (loaded as Record<string, unknown>)[key] = defaults[key]();
          continue;
        }
        const result = migrateAndValidate(key, rec.schemaVersion, rec.data);
        if (result.ok) {
          (loaded as Record<string, unknown>)[key] = result.data;
          this.revs[key] = rec.rev;
          if (result.migrated) this.persist(key, result.data);
        } else if (result.reason === 'newer-version') {
          this.blockedKeys.add(key);
          this.revs[key] = rec.rev;
          (loaded as Record<string, unknown>)[key] = defaults[key]();
          this.addIssue({
            id: `newer-${key}`,
            kind: 'newer-version',
            key,
            message: 'Some saved data was written by a newer version of this app. It has been left untouched. Reload to get the latest version.',
          });
        } else {
          await this.backend.putRaw(`quarantine:${key}:${Date.now()}`, rec).catch(() => undefined);
          this.revs[key] = rec.rev;
          (loaded as Record<string, unknown>)[key] = defaults[key]();
          this.addIssue({
            id: `corrupt-${key}`,
            kind: 'corrupt',
            key,
            message: `Part of your saved ${label(key)} could not be read. A copy was set aside instead of being deleted, and a fresh ${label(key)} was started.`,
          });
        }
      } catch {
        (loaded as Record<string, unknown>)[key] = defaults[key]();
        this.addIssue({ id: `read-${key}`, kind: 'write-failed', key, message: `Saved ${label(key)} could not be loaded right now.` });
      }
    }

    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('marketquest-sync');
      this.channel.onmessage = (ev: MessageEvent<{ tab: string; key: StorageKey }>) => {
        if (ev.data?.tab === TAB_ID) return;
        this.addIssue({
          id: 'other-tab',
          kind: 'other-tab',
          message: 'Your progress was updated in another tab. Reload this tab before continuing so nothing is overwritten.',
        });
      };
    }

    this.setState({ ...(loaded as AppData), ready: true, storageMode: this.backend.kind });
  }

  update<K extends StorageKey>(key: K, updater: (prev: AppData[K]) => AppData[K]) {
    const next = updater(this.state[key]);
    if (next === this.state[key]) return;
    this.setState({ [key]: next } as Partial<AppState>);
    this.persist(key, next);
  }

  /** Resolves once all queued writes have settled. */
  flush(): Promise<void> {
    return Promise.all(Object.values(this.queues)).then(() => undefined);
  }

  private persist<K extends StorageKey>(key: K, data: AppData[K]) {
    if (this.blockedKeys.has(key)) return;
    this.queues[key] = this.queues[key].then(async () => {
      try {
        const rec = await this.backend.put(key, data, CURRENT_SCHEMA[key], this.revs[key], TAB_ID);
        this.revs[key] = rec.rev;
        this.channel?.postMessage({ tab: TAB_ID, key });
        this.setState({ lastSavedAt: rec.updatedAt, issues: this.state.issues.filter((i) => i.id !== `write-${key}` && i.id !== 'quota') });
      } catch (e) {
        const err = e instanceof StorageError ? e : new StorageError('unknown', String(e));
        if (err.code === 'conflict') {
          this.blockedKeys.add(key);
          this.addIssue({
            id: 'conflict',
            kind: 'conflict',
            key,
            message: 'Another tab saved newer progress. Saving here is paused so neither copy is overwritten. Reload to continue with the latest progress.',
          });
        } else if (err.code === 'quota') {
          this.addIssue({ id: 'quota', kind: 'quota', key, message: 'Browser storage is full, so the last change was not saved. Export a backup from Settings, then free up space.' });
        } else {
          this.addIssue({ id: `write-${key}`, kind: 'write-failed', key, message: `The last change to your ${label(key)} could not be saved. It will be retried with your next action.` });
        }
      }
    });
  }

  /** Replace several slices at once (import, resets). */
  replace(patch: Partial<AppData>) {
    this.setState(patch as Partial<AppState>);
    for (const key of Object.keys(patch) as StorageKey[]) this.persist(key, this.state[key]);
  }
}

function label(key: StorageKey): string {
  return { settings: 'settings', progress: 'learning progress', sim: 'simulator session', journal: 'trade journal' }[key];
}

export const appStore = new AppStore();
