import { useId, useMemo, useState } from 'react';
import { CaretDoubleDown, CaretDoubleUp, CaretDown, CaretLeft, CaretRight, CaretUp, Minus, Plus } from '@phosphor-icons/react';
import type { CandleBuildExercise, CandlePickExercise, LabelPartsExercise, Ohlc, ZoneExercise } from '../content/schema';
import { CandleChart, describeOhlc } from '../components/CandleChart';
import { CandleFigure } from '../components/CandleFigure';
import { adjustOhlc, candleAnatomy } from '../domain/candles';
import { formatMoney } from '../domain/money';
import { seededShuffle } from '../engine/random';
import type { InputProps } from './basicInputs';

type PickR = { kind: 'candle-pick'; index: number };
export function CandlePickInput({ ex, value, onChange, disabled }: InputProps<CandlePickExercise, PickR>) {
  const n = ex.candles.length;
  const sel = value.index >= 0 ? value.index : null;
  const set = (i: number) => !disabled && onChange({ kind: 'candle-pick', index: Math.max(0, Math.min(n - 1, i)) });
  const current = sel !== null ? ex.candles[sel] : undefined;
  return (
    <div>
      <CandleChart candles={ex.candles} label="Chart for this question" selectable={!disabled} selected={sel} onSelect={set} showVolume={ex.candles.some((c) => c.volume !== undefined)} />
      <div className="chart-controls">
        <button type="button" className="btn btn-sm" onClick={() => set((sel ?? 0) - 1)} disabled={disabled || sel === 0} aria-label="Previous candle">
          <CaretLeft size={18} aria-hidden /> Prev
        </button>
        <button type="button" className="btn btn-sm" onClick={() => set(sel === null ? 0 : sel + 1)} disabled={disabled || sel === n - 1} aria-label="Next candle">
          Next <CaretRight size={18} aria-hidden />
        </button>
        <div className="chart-readout" aria-hidden="true" style={{ flex: 1, minWidth: 200 }}>
          {current && sel !== null ? (
            <span>
              <strong>Candle {sel + 1}</strong> · {describeOhlc(current)}
            </span>
          ) : (
            <span className="muted">Tap a candle, or use Prev / Next.</span>
          )}
        </div>
      </div>
    </div>
  );
}

type ZoneR = { kind: 'zone'; center: number };
export function ZoneInput({ ex, value, onChange, disabled }: InputProps<ZoneExercise, ZoneR>) {
  const range = useMemo(() => {
    const lo = Math.min(...ex.candles.map((c) => c.low));
    const hi = Math.max(...ex.candles.map((c) => c.high));
    const pad = Math.round((hi - lo) * 0.15) + ex.zoneHeight;
    return { min: lo - pad, max: hi + pad };
  }, [ex]);
  const snap = (p: number) => ex.start + Math.round((p - ex.start) / ex.step) * ex.step;
  const clamp = (p: number) => Math.max(range.min + ex.zoneHeight / 2, Math.min(range.max - ex.zoneHeight / 2, p));
  const set = (p: number) => !disabled && onChange({ kind: 'zone', center: snap(clamp(p)) });
  const half = Math.round(ex.zoneHeight / 2);
  const low = value.center - half;
  const high = value.center + half;
  return (
    <div>
      <CandleChart
        candles={ex.candles}
        label="Chart for placing a zone. Use the buttons below to move the zone."
        zones={[{ low, high, label: 'Your zone', tone: 'mastery' }]}
        priceRange={range}
        onPriceTap={disabled ? undefined : set}
      />
      <div className="chart-controls">
        <button type="button" className="btn btn-sm" disabled={disabled} onClick={() => set(value.center + ex.step * 5)} aria-label="Move zone up a lot">
          <CaretDoubleUp size={18} aria-hidden />
        </button>
        <button type="button" className="btn btn-sm" disabled={disabled} onClick={() => set(value.center + ex.step)} aria-label="Move zone up">
          <CaretUp size={18} aria-hidden /> Up
        </button>
        <button type="button" className="btn btn-sm" disabled={disabled} onClick={() => set(value.center - ex.step)} aria-label="Move zone down">
          <CaretDown size={18} aria-hidden /> Down
        </button>
        <button type="button" className="btn btn-sm" disabled={disabled} onClick={() => set(value.center - ex.step * 5)} aria-label="Move zone down a lot">
          <CaretDoubleDown size={18} aria-hidden />
        </button>
        <output className="chart-readout" aria-live="polite">
          Zone: {formatMoney(low)} – {formatMoney(high)}
        </output>
      </div>
      <p className="hint">Tap the chart to move the zone there, or use the buttons.</p>
    </div>
  );
}

function Stepper({ label, value, onDec, onInc, disabled }: { label: string; value: string; onDec: () => void; onInc: () => void; disabled: boolean }) {
  const id = useId();
  return (
    <div className="stepper-field" role="group" aria-labelledby={id}>
      <span className="label" id={id}>
        {label}
      </span>
      <div className="stepper">
        <button type="button" className="btn" onClick={onDec} disabled={disabled} aria-label={`Lower ${label}`}>
          <Minus size={18} aria-hidden />
        </button>
        <output className="stepper-value" aria-live="polite" aria-label={`${label}: ${value}`}>
          {value}
        </output>
        <button type="button" className="btn" onClick={onInc} disabled={disabled} aria-label={`Raise ${label}`}>
          <Plus size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}
export { Stepper };

type BuildR = { kind: 'candle-build'; ohlc: Ohlc };
export function CandleBuildInput({ ex, value, onChange, disabled }: InputProps<CandleBuildExercise, BuildR>) {
  const c = value.ohlc;
  const a = candleAnatomy(c);
  const bump = (field: keyof Ohlc, d: number) => onChange({ kind: 'candle-build', ohlc: adjustOhlc(c, field, c[field] + d * ex.step) });
  const range = {
    min: Math.min(ex.start.low, c.low) - ex.step * 6,
    max: Math.max(ex.start.high, c.high) + ex.step * 6,
  };
  return (
    <div className="stack">
      <CandleFigure ohlc={c} showLabels range={range} label={`Your candle. ${describeOhlc({ ...c, i: 0 })}`} />
      <p className="small muted" style={{ textAlign: 'center' }}>
        Body {formatMoney(a.body)} · Upper wick {formatMoney(a.upperWick)} · Lower wick {formatMoney(a.lowerWick)} · Range {formatMoney(a.range)}
      </p>
      <div className="stepper-group">
        {(['open', 'high', 'low', 'close'] as const).map((f) => (
          <Stepper key={f} label={f[0]!.toUpperCase() + f.slice(1)} value={formatMoney(c[f])} disabled={disabled} onDec={() => bump(f, -1)} onInc={() => bump(f, 1)} />
        ))}
      </div>
      <p className="hint">Each tap moves a price by {formatMoney(ex.step)}. The high and low adjust automatically so the candle stays possible.</p>
    </div>
  );
}

type LabelR = { kind: 'label-parts'; assignments: Record<string, string> };
export function LabelPartsInput({ ex, value, onChange, disabled, seed }: InputProps<LabelPartsExercise, LabelR> & { seed: string }) {
  const [active, setActive] = useState<string | null>(null);
  const labels = useMemo(() => seededShuffle(ex.labels, `${ex.id}:${seed}`), [ex, seed]);
  const base = useId();
  const assign = (markerId: string, labelId: string) => onChange({ kind: 'label-parts', assignments: { ...value.assignments, [markerId]: labelId } });
  const textFor = (id: string | undefined) => ex.labels.find((l) => l.id === id)?.text;
  return (
    <div className="stack">
      <div>
        <p className="small" id={`${base}-chips`} style={{ fontWeight: 600 }}>
          Tap a label, then tap a numbered marker. Or use the menus below.
        </p>
        <div className="chip-row" role="group" aria-labelledby={`${base}-chips`}>
          {labels.map((l) => (
            <button key={l.id} type="button" className="chip" aria-pressed={active === l.id} disabled={disabled} onClick={() => setActive(active === l.id ? null : l.id)}>
              {l.text}
            </button>
          ))}
        </div>
      </div>
      <CandleFigure
        ohlc={ex.candle}
        label="Candle with numbered markers"
        markers={ex.markers.map((m, i) => ({
          id: m.id,
          number: i + 1,
          anchor: m.anchor,
          text: textFor(value.assignments[m.id]),
          onClick: () => {
            if (disabled || !active) return;
            assign(m.id, active);
            setActive(null);
          },
        }))}
      />
      <div className="marker-list">
        {ex.markers.map((m, i) => (
          <div key={m.id} className="marker-row">
            <span className="marker-badge" aria-hidden>
              {i + 1}
            </span>
            <div className="field">
              <label htmlFor={`${base}-${m.id}`} className="visually-hidden">
                Label for marker {i + 1}
              </label>
              <select id={`${base}-${m.id}`} className="input" disabled={disabled} value={value.assignments[m.id] ?? ''} onChange={(e) => assign(m.id, e.target.value)}>
                <option value="">Choose a label for marker {i + 1}</option>
                {labels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.text}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
