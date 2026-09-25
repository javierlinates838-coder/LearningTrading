import { useId, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from '@phosphor-icons/react';
import type { CategorizeExercise, ChoiceExercise, DecisionExercise, NumericExercise, SequenceExercise } from '../content/schema';
import { parseDollars, centsToDollarString } from '../domain/money';
import { seededShuffle } from '../engine/random';
import { InlineText, RichText } from '../components/RichText';

export interface InputProps<E, R> {
  ex: E;
  value: R;
  onChange: (r: R) => void;
  disabled: boolean;
}

type ChoiceR = { kind: 'choice'; optionId: string };
export function ChoiceInput({ ex, value, onChange, disabled, seed }: InputProps<ChoiceExercise, ChoiceR> & { seed: string }) {
  const name = useId();
  const options = useMemo(() => seededShuffle(ex.options, `${ex.id}:${seed}`), [ex, seed]);
  return (
    <fieldset>
      <legend className="visually-hidden">Choose one answer</legend>
      <div className="options">
        {options.map((o) => (
          <label key={o.id} className="option">
            <input type="radio" name={name} value={o.id} checked={value.optionId === o.id} disabled={disabled} onChange={() => onChange({ kind: 'choice', optionId: o.id })} />
            <span>
              <InlineText text={o.text} />
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

type NumericR = { kind: 'numeric'; value: number };

export function parseNumericInput(unit: NumericExercise['unit'], raw: string): number | null {
  const t = raw.trim().replace(/[−–]/g, '-');
  if (!t) return null;
  if (unit === 'usd') return parseDollars(t);
  const cleaned = t.replace(/[,\s%R]/gi, '').replace(/shares?$/i, '');
  if (!/^-?\d*(\.\d+)?$/.test(cleaned) || cleaned === '' || cleaned === '-') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  if (unit === 'shares' && !Number.isInteger(n)) return null;
  return n;
}

export function NumericInput({ ex, value, onChange, disabled }: InputProps<NumericExercise, NumericR>) {
  const id = useId();
  const [raw, setRaw] = useState(Number.isFinite(value.value) ? (ex.unit === 'usd' ? centsToDollarString(value.value) : String(value.value)) : '');
  const parsed = parseNumericInput(ex.unit, raw);
  const invalid = raw.trim() !== '' && parsed === null;
  const hint =
    ex.unit === 'usd' ? 'Dollars and cents, for example 24.00' : ex.unit === 'shares' ? 'A whole number of shares' : ex.unit === 'ratio' ? 'A number such as 1.5 or −0.5' : 'A number';
  return (
    <div className="field" style={{ maxWidth: 360 }}>
      <label htmlFor={id}>{ex.inputLabel}</label>
      <div className="input-affix">
        {ex.unit === 'usd' ? <span className="affix" aria-hidden>$</span> : null}
        <input
          id={id}
          className="input"
          inputMode={ex.unit === 'shares' ? 'numeric' : 'decimal'}
          autoComplete="off"
          value={raw}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={`${id}-hint`}
          onChange={(e) => {
            setRaw(e.target.value);
            const p = parseNumericInput(ex.unit, e.target.value);
            onChange({ kind: 'numeric', value: p ?? Number.NaN });
          }}
        />
        {ex.unit === 'shares' ? <span className="affix">shares</span> : ex.unit === 'ratio' && ex.inputLabel.includes('R') ? <span className="affix">R</span> : null}
      </div>
      <span id={`${id}-hint`} className={invalid ? 'error-text' : 'hint'}>
        {invalid ? `That doesn’t look like a valid answer. ${hint}.` : hint}
      </span>
    </div>
  );
}

type DecisionR = { kind: 'decision'; actionId: string; reasonId: string };
export function DecisionInput({ ex, value, onChange, disabled, seed }: InputProps<DecisionExercise, DecisionR> & { seed: string }) {
  const a = useId();
  const r = useId();
  const reasons = useMemo(() => seededShuffle(ex.reasons, `${ex.id}:${seed}`), [ex, seed]);
  return (
    <div className="stack">
      <div className="card">
        <p className="eyebrow">Situation</p>
        <RichText text={ex.situation} />
      </div>
      <fieldset>
        <legend>1. What would you do?</legend>
        <div className="segmented">
          {ex.actions.map((act) => (
            <label key={act.id}>
              <input type="radio" name={a} checked={value.actionId === act.id} disabled={disabled} onChange={() => onChange({ ...value, actionId: act.id })} />
              {act.text}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>2. Which reason best explains your choice?</legend>
        <div className="options">
          {reasons.map((re) => (
            <label key={re.id} className="option">
              <input type="radio" name={r} checked={value.reasonId === re.id} disabled={disabled} onChange={() => onChange({ ...value, reasonId: re.id })} />
              <span>
                <InlineText text={re.text} />
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

type SequenceR = { kind: 'sequence'; order: string[] };
export function initialSequence(ex: SequenceExercise, seed: string): string[] {
  const ids = ex.items.map((i) => i.id);
  let order = seededShuffle(ids, `${ex.id}:${seed}`);
  if (order.join() === ex.correctOrder.join()) order = [...order.slice(1), order[0]!];
  return order;
}
export function SequenceInput({ ex, value, onChange, disabled }: InputProps<SequenceExercise, SequenceR>) {
  const [moved, setMoved] = useState('');
  const move = (idx: number, delta: number) => {
    const next = [...value.order];
    const j = idx + delta;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    onChange({ kind: 'sequence', order: next });
    const item = ex.items.find((i) => i.id === next[j]);
    setMoved(`${item?.text ?? 'Item'} moved to position ${j + 1} of ${next.length}.`);
  };
  return (
    <div>
      <ol className="seq-list" aria-label="Current order">
        {value.order.map((id, idx) => {
          const item = ex.items.find((i) => i.id === id)!;
          return (
            <li key={id} className="seq-item">
              <span className="n" aria-hidden>
                {idx + 1}
              </span>
              <span>{item.text}</span>
              <span className="moves">
                <button type="button" className="icon-btn" disabled={disabled || idx === 0} onClick={() => move(idx, -1)} aria-label={`Move “${item.text}” up`}>
                  <ArrowUp size={20} aria-hidden />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  disabled={disabled || idx === value.order.length - 1}
                  onClick={() => move(idx, 1)}
                  aria-label={`Move “${item.text}” down`}
                >
                  <ArrowDown size={20} aria-hidden />
                </button>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="visually-hidden" aria-live="polite">
        {moved}
      </p>
    </div>
  );
}

type CategorizeR = { kind: 'categorize'; assignments: Record<string, string> };
export function CategorizeInput({ ex, value, onChange, disabled, seed }: InputProps<CategorizeExercise, CategorizeR> & { seed: string }) {
  const base = useId();
  const items = useMemo(() => seededShuffle(ex.items, `${ex.id}:${seed}`), [ex, seed]);
  return (
    <div className="stack-sm">
      {items.map((item, k) => (
        <fieldset key={item.id} className="cat-item">
          <legend style={{ fontWeight: 500, marginBottom: 0 }}>
            <span className="visually-hidden">Item {k + 1}: </span>
            {item.text}
          </legend>
          <div className="segmented">
            {ex.categories.map((c) => (
              <label key={c.id}>
                <input
                  type="radio"
                  name={`${base}-${item.id}`}
                  checked={value.assignments[item.id] === c.id}
                  disabled={disabled}
                  onChange={() => onChange({ kind: 'categorize', assignments: { ...value.assignments, [item.id]: c.id } })}
                />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
