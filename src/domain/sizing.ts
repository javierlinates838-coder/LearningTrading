import type { Cents } from './money';

export interface SizingInput {
  entry: Cents;
  stop: Cents;
  target: Cents;
  shares: number;
  cash: Cents;
  /** Fee per fill (charged on entry and exit). */
  feePerFill?: Cents;
  /** Adverse slippage allowance per share applied to market-style fills (entry and stop exit). */
  slippagePerShare?: Cents;
}

export interface SizingResult {
  valid: boolean;
  errors: string[];
  riskPerShare: Cents | null;
  rewardPerShare: Cents | null;
  exposure: Cents;
  plannedRisk: Cents | null;
  potentialReward: Cents | null;
  /** Reward-to-risk before costs, or null when undefined. */
  rewardToRisk: number | null;
  /** Estimated risk including two fees and slippage on entry and stop exit. */
  plannedRiskWithCosts: Cents | null;
  potentialRewardAfterCosts: Cents | null;
  /** Cash needed to open including the entry fee and entry slippage allowance. */
  cashNeeded: Cents;
  affordable: boolean;
}

/**
 * Transparent long-only position arithmetic.
 * Planned risk per share = entry - stop. Planned dollar risk = shares × risk per share.
 * Potential reward = shares × (target - entry). Reward-to-risk = reward ÷ risk.
 */
export function computeSizing(input: SizingInput): SizingResult {
  const { entry, stop, target, shares, cash } = input;
  const fee = input.feePerFill ?? 0;
  const slip = input.slippagePerShare ?? 0;
  const errors: string[] = [];

  if (!Number.isInteger(shares) || shares < 0) errors.push('Shares must be a whole number of zero or more.');
  if (entry <= 0) errors.push('Entry price must be above $0.');
  if (stop >= entry) errors.push('For a long trade, the stop must be below the entry.');
  if (stop <= 0) errors.push('Stop price must be above $0.');
  if (target <= entry) errors.push('For a long trade, the target must be above the entry.');

  const priceRelationsOk = stop < entry && target > entry && stop > 0;
  const riskPerShare = priceRelationsOk ? entry - stop : null;
  const rewardPerShare = priceRelationsOk ? target - entry : null;
  const exposure = entry * Math.max(0, Math.trunc(shares));
  const plannedRisk = riskPerShare === null ? null : riskPerShare * shares;
  const potentialReward = rewardPerShare === null ? null : rewardPerShare * shares;
  const rewardToRisk = plannedRisk && potentialReward !== null && plannedRisk > 0 ? potentialReward / plannedRisk : null;

  const costs = shares > 0 ? fee * 2 : 0;
  const plannedRiskWithCosts = plannedRisk === null ? null : plannedRisk + costs + slip * shares * 2;
  const potentialRewardAfterCosts = potentialReward === null ? null : potentialReward - costs - slip * shares;
  const cashNeeded = shares > 0 ? (entry + slip) * shares + fee : 0;
  const affordable = cashNeeded <= cash;
  if (!affordable) errors.push('Not enough virtual cash for this many shares.');

  return {
    valid: errors.length === 0,
    errors,
    riskPerShare,
    rewardPerShare,
    exposure,
    plannedRisk,
    potentialReward,
    rewardToRisk,
    plannedRiskWithCosts,
    potentialRewardAfterCosts,
    cashNeeded,
    affordable,
  };
}

/**
 * Largest whole-share quantity whose planned risk stays within the budget and
 * whose cost is affordable. Costs are included only when provided.
 */
export function maxSharesForRisk(params: {
  entry: Cents;
  stop: Cents;
  riskBudget: Cents;
  cash: Cents;
  feePerFill?: Cents;
  slippagePerShare?: Cents;
}): number {
  const { entry, stop, riskBudget, cash } = params;
  const fee = params.feePerFill ?? 0;
  const slip = params.slippagePerShare ?? 0;
  if (stop >= entry || entry <= 0) return 0;
  const perShareRisk = entry - stop + slip * 2;
  const budgetAfterFees = riskBudget - (fee > 0 ? fee * 2 : 0);
  if (budgetAfterFees <= 0) return 0;
  const byRisk = Math.floor(budgetAfterFees / perShareRisk);
  const byCash = Math.floor((cash - fee) / (entry + slip));
  return Math.max(0, Math.min(byRisk, byCash));
}
