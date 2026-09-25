import { useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { DownloadSimple, UploadSimple } from '@phosphor-icons/react';
import { APP_NAME } from '../config/app';
import { Page } from '../components/Page';
import { Dialog } from '../components/Dialog';
import { useAppState } from '../state/app';
import { appStore } from '../storage/store';
import { defaults, defaultSettings, type Settings as SettingsData } from '../storage/schemas';
import { applyImport, buildExport, parseImport, type ImportSummary } from '../storage/backup';
import type { AppData } from '../storage/schemas';
import { DEFAULT_ASSUMPTIONS } from '../sim/engine';
import { formatMoney } from '../domain/money';
import { STORAGE_NOTE } from './Onboarding';

type Confirm = 'sim' | 'learning' | 'everything' | null;

function setSettings(patch: Partial<SettingsData>) {
  appStore.update('settings', (s) => ({ ...s, ...patch }));
}

function Segmented<T extends string | number>({ legend, value, options, onChange, hint }: { legend: string; value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; hint?: string }) {
  const name = useId();
  return (
    <fieldset>
      <legend>{legend}</legend>
      <div className="segmented">
        {options.map(([v, l]) => (
          <label key={String(v)}>
            <input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} />
            {l}
          </label>
        ))}
      </div>
      {hint ? (
        <p className="hint" style={{ marginTop: 8 }}>
          {hint}
        </p>
      ) : null}
    </fieldset>
  );
}

export function Settings() {
  const state = useAppState();
  const { settings } = state;
  const nameId = useId();
  const feeId = useId();
  const slipId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ data: AppData; summary: ImportSummary } | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const nav = useNavigate();

  const current = (): AppData => ({ settings: state.settings, progress: state.progress, sim: state.sim, journal: state.journal });

  const exportBackup = () => {
    const blob = new Blob([buildExport(current())], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${APP_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Backup file created. Check your downloads.');
  };

  const onFile = async (file: File | undefined) => {
    setImportError(null);
    if (!file) return;
    const text = await file.text().catch(() => null);
    if (fileRef.current) fileRef.current.value = '';
    if (text === null) {
      setImportError('That file could not be read.');
      return;
    }
    const parsed = parseImport(text);
    if (!parsed.ok) {
      setImportError(parsed.error);
      return;
    }
    setMode('merge');
    setPending({ data: parsed.data, summary: parsed.summary });
  };

  const confirmImport = () => {
    if (!pending) return;
    appStore.replace(applyImport(current(), pending.data, mode));
    setPending(null);
    setMessage('Importing…');
    void appStore.flush().then(() => {
      const failed = appStore.getSnapshot().issues.some((i) => i.kind === 'quota' || i.kind === 'write-failed' || i.kind === 'conflict');
      if (failed) setMessage('The backup is loaded in this tab but could not be fully saved. See the storage notice above, and keep your backup file.');
      else setMessage(mode === 'merge' ? 'Backup merged. Nothing you had on this device was removed.' : 'Backup restored. This device now matches the backup.');
    });
  };

  const doReset = () => {
    if (confirm === 'sim') {
      appStore.replace({ sim: null });
      setMessage('Simulator reset. Your lessons, XP and journal are unchanged.');
    } else if (confirm === 'learning') {
      appStore.replace({ progress: defaults.progress() });
      setMessage('Learning progress reset. Your journal and settings are unchanged.');
    } else if (confirm === 'everything') {
      appStore.replace({ settings: defaultSettings(), progress: defaults.progress(), sim: null, journal: defaults.journal() });
      void appStore.flush().then(() => nav('/'));
    }
    setConfirm(null);
  };

  const a = settings.simAssumptions;
  const setAssumption = (k: 'feePerFill' | 'slippagePerShare', raw: string, max: number) => {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return;
    setSettings({ simAssumptions: { ...a, [k]: Math.min(max, Math.max(0, n)) } });
  };

  const confirmCopy: Record<Exclude<Confirm, null>, { title: string; body: string; action: string }> = {
    sim: { title: 'Reset the simulator?', body: 'The current run ends and the balance returns to the starting amount. Journal entries and learning progress stay.', action: 'Reset simulator' },
    learning: { title: 'Reset learning progress?', body: 'Lessons, XP, skills, reviews and achievements return to the start. Your journal and settings stay. Consider exporting a backup first.', action: 'Reset learning' },
    everything: { title: 'Erase everything?', body: 'All progress, journal entries, the simulator and settings on this browser are removed. This cannot be undone unless you have a backup.', action: 'Erase everything' },
  };

  return (
    <Page title="Settings">
      {message ? (
        <div className="notice notice-info" role="status" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="notice-body">
            <p>{message}</p>
          </div>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setMessage(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <section className="card stack" aria-labelledby="set-display">
        <h2 id="set-display">Display and study</h2>
        <Segmented
          legend="Motion"
          value={settings.motion}
          onChange={(v) => setSettings({ motion: v })}
          options={[
            ['system', 'Match device'],
            ['reduce', 'Reduce'],
            ['full', 'Standard'],
          ]}
          hint="Reduce turns off transitions and animated scrolling."
        />
        <Segmented
          legend="Text size"
          value={settings.textScale}
          onChange={(v) => setSettings({ textScale: v })}
          options={[
            [100, 'Default'],
            [115, 'Large'],
            [130, 'Larger'],
          ]}
        />
        <Segmented
          legend="Daily study goal"
          value={settings.studyGoalMinutes === null ? 'none' : String(settings.studyGoalMinutes)}
          onChange={(v) => setSettings({ studyGoalMinutes: v === 'none' ? null : (Number(v) as 5 | 10) })}
          options={[
            ['5', '5 minutes'],
            ['10', '10 minutes'],
            ['none', 'No goal'],
          ]}
          hint="The weekly goal is met on any 4 days. Missing a day never resets anything."
        />
        <div className="field">
          <label htmlFor={nameId}>Nickname (optional)</label>
          <input id={nameId} className="input" value={settings.nickname} maxLength={40} autoComplete="nickname" onChange={(e) => setSettings({ nickname: e.target.value.slice(0, 40) })} />
        </div>
        <label className="option">
          <input type="checkbox" checked={settings.unlockAll} onChange={(e) => setSettings({ unlockAll: e.target.checked })} />
          <span>
            <strong>Open every lesson</strong>
            <span className="small muted" style={{ display: 'block' }}>
              For learners who know some basics. Lessons still suggest what to study first.
            </span>
          </span>
        </label>
      </section>

      <section className="card stack" aria-labelledby="set-sim" style={{ marginTop: 'var(--space-5)' }}>
        <h2 id="set-sim">Simulation assumptions</h2>
        <p className="small muted">
          These apply to new simulator runs. They are training values, not any broker’s real prices. Real costs, order handling and account rules vary; check your broker’s own disclosures.
        </p>
        <div className="grid-2">
          <div className="field">
            <label htmlFor={feeId}>Fee per fill (cents)</label>
            <input id={feeId} className="input num" type="number" inputMode="numeric" min={0} max={1000} step={1} value={a.feePerFill} onChange={(e) => setAssumption('feePerFill', e.target.value, 1000)} />
            <span className="hint">Currently {formatMoney(a.feePerFill)} each time an order fills.</span>
          </div>
          <div className="field">
            <label htmlFor={slipId}>Slippage per share (cents)</label>
            <input id={slipId} className="input num" type="number" inputMode="numeric" min={0} max={100} step={1} value={a.slippagePerShare} onChange={(e) => setAssumption('slippagePerShare', e.target.value, 100)} />
            <span className="hint">Applied to market orders and triggered stops.</span>
          </div>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-sm" onClick={() => setSettings({ simAssumptions: { ...DEFAULT_ASSUMPTIONS } })}>
            Restore defaults
          </button>
        </div>
      </section>

      <section id="data" className="card stack" aria-labelledby="set-data" style={{ marginTop: 'var(--space-5)' }}>
        <h2 id="set-data">Your data</h2>
        <p>
          <strong>{STORAGE_NOTE}</strong>
        </p>
        <p className="small muted">
          {state.storageMode === 'indexeddb'
            ? `Storage: this browser’s local database.${state.lastSavedAt ? ` Last saved ${new Date(state.lastSavedAt).toLocaleString()}.` : ''}`
            : 'Storage: temporary memory only. This browser is not allowing saved data, so export a backup before closing the tab.'}
        </p>
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={exportBackup}>
            <DownloadSimple size={20} aria-hidden /> Export backup
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            <UploadSimple size={20} aria-hidden /> Import backup
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="visually-hidden" tabIndex={-1} aria-hidden="true" onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>
        {importError ? (
          <p className="error-text" role="alert">
            {importError}
          </p>
        ) : null}
      </section>

      <section className="card stack" aria-labelledby="set-reset" style={{ marginTop: 'var(--space-5)' }}>
        <h2 id="set-reset">Reset</h2>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => setConfirm('sim')}>
            Reset simulator
          </button>
          <button type="button" className="btn" onClick={() => setConfirm('learning')}>
            Reset learning progress
          </button>
          <button type="button" className="btn btn-danger" onClick={() => setConfirm('everything')}>
            Erase everything
          </button>
        </div>
        <p className="hint">Resetting the simulator never erases learning progress.</p>
      </section>

      <section className="card stack" aria-labelledby="set-about" style={{ marginTop: 'var(--space-5)' }}>
        <h2 id="set-about">Privacy and about</h2>
        <p>
          {APP_NAME} has no accounts, no analytics and no tracking. Nothing you do here is sent to a server. It never connects to a brokerage and never places real trades.
        </p>
        <p>
          {APP_NAME} is for education only. It is not financial, investment, legal or tax advice. Prices in the simulator are synthetic and do not predict real markets.
        </p>
        <p>
          <Link to="/sources">Sources and further reading</Link> · <Link to="/glossary">Glossary</Link>
        </p>
      </section>

      <Dialog
        open={pending !== null}
        title="Import this backup?"
        onClose={() => setPending(null)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={confirmImport}>
              {mode === 'merge' ? 'Merge backup' : 'Replace with backup'}
            </button>
          </>
        }
      >
        {pending ? (
          <>
            <dl className="kv">
              <dt>Created</dt>
              <dd>{new Date(pending.summary.exportedAt).toLocaleString()}</dd>
              <dt>Lessons completed</dt>
              <dd className="num">{pending.summary.lessonsCompleted}</dd>
              <dt>Journal entries</dt>
              <dd className="num">{pending.summary.journalEntries}</dd>
            </dl>
            <Segmented
              legend="How should it be imported?"
              value={mode}
              onChange={setMode}
              options={[
                ['merge', 'Merge'],
                ['replace', 'Replace'],
              ]}
              hint={
                mode === 'merge'
                  ? 'Merge keeps everything on this device and adds what the backup has. Settings and the current simulator run stay as they are.'
                  : 'Replace makes this device match the backup exactly. Progress not in the backup is removed.'
              }
            />
          </>
        ) : null}
      </Dialog>

      <Dialog
        open={confirm !== null}
        title={confirm ? confirmCopy[confirm].title : ''}
        onClose={() => setConfirm(null)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={doReset}>
              {confirm ? confirmCopy[confirm].action : ''}
            </button>
          </>
        }
      >
        <p>{confirm ? confirmCopy[confirm].body : ''}</p>
      </Dialog>
    </Page>
  );
}
