import { useId, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ShieldCheck } from '@phosphor-icons/react';
import { APP_NAME } from '../config/app';
import { appStore } from '../storage/store';
import { usePageTitle } from '../components/Page';
import { SceneArt } from '../components/scenes';
import { LESSONS } from '../content';

export const STORAGE_NOTE = 'Saved in this browser. Export a backup to move your progress.';

export function Onboarding() {
  usePageTitle('Welcome');
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<'zero' | 'basics'>('zero');
  const [nickname, setNickname] = useState('');
  const [goal, setGoal] = useState<'5' | '10' | 'none'>('none');
  const nav = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nameId = useId();
  const levelName = useId();
  const goalName = useId();

  useEffect(() => {
    if (step > 0) headingRef.current?.focus();
  }, [step]);

  const finish = () => {
    appStore.update('settings', (s) => ({
      ...s,
      onboarded: true,
      nickname: nickname.trim().slice(0, 40),
      studyGoalMinutes: goal === 'none' ? null : (Number(goal) as 5 | 10),
      unlockAll: level === 'basics',
    }));
    nav(`/learn/${LESSONS[0]!.id}`);
  };

  return (
    <div className="onboarding">
      <p className="eyebrow" aria-live="polite">
        Step {step + 1} of 3
      </p>
      <div className="progress-bar" aria-hidden="true">
        <span style={{ width: `${((step + 1) / 3) * 100}%` }} />
      </div>

      {step === 0 ? (
        <section className="stack fade-in">
          <SceneArt id="welcome" label="A rising path of candles, from a finished step to the one you are on." />
          <h1 ref={headingRef} tabIndex={-1}>
            Learn how trading works, one small step at a time
          </h1>
          <div className="notice notice-info">
            <ShieldCheck size={24} aria-hidden style={{ flex: 'none' }} />
            <div className="notice-body">
              <p>
                <strong>Practice with virtual money. No real trades happen here.</strong>
              </p>
              <p className="small">No account, no deposits, no brokerage connection. {APP_NAME} is an education tool, not financial advice.</p>
            </div>
          </div>
          <fieldset>
            <legend>Where would you like to start?</legend>
            <div className="options">
              <label className="option">
                <input type="radio" name={levelName} checked={level === 'zero'} onChange={() => setLevel('zero')} />
                <span>
                  <strong>Start from zero</strong>
                  <span className="small muted" style={{ display: 'block' }}>
                    Begin with what a share is. Lessons open in order.
                  </span>
                </span>
              </label>
              <label className="option">
                <input type="radio" name={levelName} checked={level === 'basics'} onChange={() => setLevel('basics')} />
                <span>
                  <strong>I know some basics</strong>
                  <span className="small muted" style={{ display: 'block' }}>
                    Every lesson is open. You can still start at the beginning.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>
          <div className="btn-row">
            <button type="button" className="btn btn-primary btn-block" onClick={() => setStep(1)}>
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="stack fade-in">
          <h1 ref={headingRef} tabIndex={-1}>
            Make it yours <span className="muted" style={{ fontWeight: 400 }}>(optional)</span>
          </h1>
          <div className="field">
            <label htmlFor={nameId}>Nickname</label>
            <input id={nameId} className="input" value={nickname} maxLength={40} autoComplete="nickname" onChange={(e) => setNickname(e.target.value)} />
            <span className="hint">Only shown on this device.</span>
          </div>
          <fieldset>
            <legend>Daily study goal</legend>
            <div className="segmented">
              {(
                [
                  ['5', '5 minutes'],
                  ['10', '10 minutes'],
                  ['none', 'No goal'],
                ] as const
              ).map(([v, l]) => (
                <label key={v}>
                  <input type="radio" name={goalName} checked={goal === v} onChange={() => setGoal(v)} />
                  {l}
                </label>
              ))}
            </div>
            <p className="hint" style={{ marginTop: 8 }}>
              A gentle weekly target: meet it on 4 days in a week. Missing a day never resets anything.
            </p>
          </fieldset>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setStep(0)}>
              Back
            </button>
            <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(2)}>
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="stack fade-in">
          <h1 ref={headingRef} tabIndex={-1}>
            Your progress stays on this device
          </h1>
          <p>{STORAGE_NOTE}</p>
          <p className="muted small">There is no account and nothing is sent to a server. You can export or reset everything in Settings.</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setStep(1)}>
              Back
            </button>
            <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={finish}>
              Start the first lesson
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
