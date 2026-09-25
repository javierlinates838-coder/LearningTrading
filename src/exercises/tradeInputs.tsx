import { useId } from 'react';
import type { OrderSimExercise, RiskBuildExercise } from '../content/schema';
import { computeSizing } from '../domain/sizing';
import { formatMoney } from '../domain/money';
import type { LabOrderType } from '../engine/orderLab';
import { Stepper } from './chartInputs';
import type { InputProps } from './basicInputs';

const TYPE_LABEL: Record<LabOrderType, string> = { market: 'Market', limit: 'Limit', stop: 'Stop' };
const TYPE_HINT: Record<LabOrderType, string> = {
  market: 'Fills at the next available price. No price control.',
  limit: 'Fills only at your price or better. May not fill.',
  stop: 'Waits until price reaches your stop, then becomes a market order. Gaps can fill beyond it.',
};

type OrderR = { kind: 'order-sim'; orderType: LabOrderType; price?: number };
export function OrderSimInput({ ex, value, onChange, disabled }: InputProps<OrderSimExercise, OrderR>) {
  const name = useId();
  const q0 = ex.quotes[0]!;
  const needsPrice = value.orderType !== 'market';
  const price = value.price ?? ex.startPrice;
  return (
    <div className="stack">
      <div className="card">
        <p className="eyebrow">Order lab · practice quotes</p>
        <p style={{ marginBottom: 8 }}>
          Goal: <strong>{ex.goal}</strong>
        </p>
        <p className="small muted">
          {ex.side === 'buy' ? 'Buy' : 'Sell'} {ex.quantity} shares. Your order is submitted on the quote below and can first fill on the next one.
        </p>
        <div className="quote-strip">
          <div className="quote-cell">
            <div className="k">Bid (sells fill here)</div>
            <div className="v">{formatMoney(q0.bid)}</div>
          </div>
          <div className="quote-cell">
            <div className="k">Ask (buys fill here)</div>
            <div className="v">{formatMoney(q0.ask)}</div>
          </div>
          <div className="quote-cell">
            <div className="k">Spread</div>
            <div className="v">{formatMoney(q0.ask - q0.bid)}</div>
          </div>
        </div>
      </div>
      <fieldset>
        <legend>Order type</legend>
        <div className="options">
          {ex.allowed.map((t) => (
            <label key={t} className="option">
              <input type="radio" name={name} checked={value.orderType === t} disabled={disabled} onChange={() => onChange({ ...value, orderType: t, price: t === 'market' ? undefined : price })} />
              <span>
                <strong>{TYPE_LABEL[t]}</strong>
                <span className="small muted" style={{ display: 'block' }}>
                  {TYPE_HINT[t]}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {needsPrice ? (
        <Stepper
          label={value.orderType === 'limit' ? 'Limit price' : 'Stop price'}
          value={formatMoney(price)}
          disabled={disabled}
          onDec={() => onChange({ ...value, price: Math.max(1, price - ex.priceStep) })}
          onInc={() => onChange({ ...value, price: price + ex.priceStep })}
        />
      ) : null}
    </div>
  );
}

type RiskR = { kind: 'risk-build'; entry: number; stop: number; target: number; shares: number };
export function RiskBuildInput({ ex, value, onChange, disabled }: InputProps<RiskBuildExercise, RiskR>) {
  const adj = new Set(ex.adjustable);
  const s = computeSizing({ ...value, cash: ex.cash, feePerFill: ex.feePerFill, slippagePerShare: ex.slippagePerShare });
  const withCosts = ex.feePerFill > 0 || ex.slippagePerShare > 0;
  const risk = withCosts ? s.plannedRiskWithCosts : s.plannedRisk;
  const pct = risk !== null ? Math.min(100, Math.round((risk / ex.riskBudget) * 100)) : 0;
  const field = (f: 'entry' | 'stop' | 'target', label: string) =>
    adj.has(f) ? (
      <Stepper
        key={f}
        label={label}
        value={formatMoney(value[f])}
        disabled={disabled}
        onDec={() => onChange({ ...value, [f]: Math.max(1, value[f] - ex.priceStep) })}
        onInc={() => onChange({ ...value, [f]: value[f] + ex.priceStep })}
      />
    ) : (
      <div key={f} className="stepper-field">
        <span className="label">{label} (fixed)</span>
        <span className="stepper-value">{formatMoney(value[f])}</span>
      </div>
    );
  return (
    <div className="stack">
      <div className="stepper-group">
        {field('target', 'Target')}
        {field('entry', 'Entry')}
        {field('stop', 'Stop')}
        {adj.has('shares') ? (
          <div className="stepper-field">
            <Stepper
              label="Shares"
              value={String(value.shares)}
              disabled={disabled}
              onDec={() => onChange({ ...value, shares: Math.max(0, value.shares - 1) })}
              onInc={() => onChange({ ...value, shares: value.shares + 1 })}
            />
            <div className="btn-row" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn btn-sm" disabled={disabled} onClick={() => onChange({ ...value, shares: Math.max(0, value.shares - 10) })} aria-label="Ten fewer shares">
                −10
              </button>
              <button type="button" className="btn btn-sm" disabled={disabled} onClick={() => onChange({ ...value, shares: value.shares + 10 })} aria-label="Ten more shares">
                +10
              </button>
            </div>
          </div>
        ) : (
          <div className="stepper-field">
            <span className="label">Shares (fixed)</span>
            <span className="stepper-value">{value.shares}</span>
          </div>
        )}
      </div>
      <div className="card" aria-live="polite">
        <dl className="kv">
          <dt>Risk per share</dt>
          <dd>{s.riskPerShare !== null ? formatMoney(s.riskPerShare) : '—'}</dd>
          <dt>{withCosts ? 'Planned risk incl. fees & slippage' : 'Planned risk'}</dt>
          <dd>{risk !== null ? formatMoney(risk) : '—'}</dd>
          <dt>Risk budget</dt>
          <dd>{formatMoney(ex.riskBudget)}</dd>
          <dt>Potential reward{withCosts ? ' after costs' : ''}</dt>
          <dd>{(withCosts ? s.potentialRewardAfterCosts : s.potentialReward) !== null ? formatMoney((withCosts ? s.potentialRewardAfterCosts : s.potentialReward)!) : '—'}</dd>
          <dt>Reward-to-risk (before costs)</dt>
          <dd>{s.rewardToRisk !== null ? `${s.rewardToRisk.toFixed(2)} : 1` : '—'}</dd>
          <dt>Cash needed</dt>
          <dd>
            {formatMoney(s.cashNeeded)} of {formatMoney(ex.cash)}
          </dd>
        </dl>
        <div style={{ marginTop: 12 }}>
          <div className="spread small">
            <span>Budget used</span>
            <span className="num">{risk !== null ? `${Math.round((risk / ex.riskBudget) * 100)}%` : '—'}</span>
          </div>
          <div className="progress-bar" aria-hidden="true">
            <span style={{ width: `${pct}%`, background: risk !== null && risk > ex.riskBudget ? 'var(--color-down)' : undefined }} />
          </div>
          {risk !== null && risk > ex.riskBudget ? <p className="small down" style={{ marginTop: 6 }}>▲ Over budget by {formatMoney(risk - ex.riskBudget)}</p> : null}
        </div>
        {s.errors.length ? (
          <ul className="small warn" style={{ marginTop: 8, color: 'var(--color-warn)' }}>
            {s.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
        {withCosts ? (
          <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
            Costs: {formatMoney(ex.feePerFill)} fee per fill (2 fills) and {formatMoney(ex.slippagePerShare)} slippage per share on entry and on the stop exit.
          </p>
        ) : null}
      </div>
    </div>
  );
}
