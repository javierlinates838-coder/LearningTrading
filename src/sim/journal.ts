import { z } from 'zod';
import { ledgerEntrySchema, planSchema, tradeNet, type SimState } from './engine';
import { getInstrument, getScenario } from './scenarios';

export const reflectionSchema = z.object({
  followedPlan: z.enum(['yes', 'partly', 'no']),
  decisionQuality: z.enum(['sound', 'mixed', 'poor']),
  whatHappened: z.string().max(1000),
  nextTime: z.string().max(1000),
  tags: z.array(z.string()).max(12),
  savedAt: z.string(),
});
export type Reflection = z.infer<typeof reflectionSchema>;

export const journalEntrySchema = z.object({
  id: z.string(),
  runId: z.string(),
  tradeId: z.string(),
  scenarioId: z.string(),
  scenarioVersion: z.number().int(),
  scenarioTitle: z.string(),
  symbol: z.string(),
  plan: planSchema,
  qty: z.number().int().positive(),
  entrySeq: z.number().int(),
  entryPrice: z.number().int(),
  exitSeq: z.number().int(),
  exitPrice: z.number().int(),
  exitReason: z.enum(['stop', 'target', 'manual', 'scenario-end']),
  initialStop: z.number().int().nullable(),
  initialRisk: z.number().int().nullable(),
  stopWidened: z.boolean(),
  stopRemoved: z.boolean(),
  ledger: z.array(ledgerEntrySchema).min(3),
  createdAt: z.string(),
  reflection: reflectionSchema.optional(),
});
export type JournalEntry = z.infer<typeof journalEntrySchema>;

export const journalSchema = z.object({ entries: z.array(journalEntrySchema) });
export type JournalState = z.infer<typeof journalSchema>;

export const REFLECTION_TAGS = [
  'followed-plan',
  'no-stop',
  'moved-stop',
  'chased',
  'waited-well',
  'exited-early',
  'gap',
  'sized-well',
  'oversized',
  'good-process-bad-outcome',
  'lucky-outcome',
] as const;

export const TAG_LABELS: Record<(typeof REFLECTION_TAGS)[number], string> = {
  'followed-plan': 'Followed plan',
  'no-stop': 'No stop set',
  'moved-stop': 'Moved stop away',
  chased: 'Chased price',
  'waited-well': 'Waited for setup',
  'exited-early': 'Exited early',
  gap: 'Gap affected fill',
  'sized-well': 'Sized within budget',
  oversized: 'Oversized',
  'good-process-bad-outcome': 'Good process, bad outcome',
  'lucky-outcome': 'Lucky outcome',
};

/** Build a journal entry for a closed trade. The entry carries its own ledger lines. */
export function journalEntryFor(state: SimState, tradeId: string, now: string): JournalEntry | null {
  const t = state.trades.find((x) => x.id === tradeId);
  if (!t || t.status !== 'closed' || t.exitSeq === undefined || t.exitPrice === undefined || !t.exitReason) return null;
  const plan = state.plans.find((p) => p.id === t.planId);
  if (!plan) return null;
  const scenario = getScenario(t.scenarioId);
  const instrument = scenario ? getInstrument(scenario.instrumentId) : undefined;
  const stops = t.stopHistory.map((h) => h.price);
  const prices = stops.filter((p): p is number => p !== null);
  let widened = false;
  for (let i = 1; i < prices.length; i++) if (prices[i]! < prices[i - 1]!) widened = true;
  const removed = stops.length > 0 && stops[stops.length - 1] === null && t.exitReason !== 'stop';
  return {
    id: `${state.runId}:${t.id}`,
    runId: state.runId,
    tradeId: t.id,
    scenarioId: t.scenarioId,
    scenarioVersion: t.scenarioVersion,
    scenarioTitle: scenario?.title ?? t.scenarioId,
    symbol: instrument?.symbol ?? '—',
    plan,
    qty: t.qty,
    entrySeq: t.entrySeq,
    entryPrice: t.entryPrice,
    exitSeq: t.exitSeq,
    exitPrice: t.exitPrice,
    exitReason: t.exitReason,
    initialStop: t.initialStop,
    initialRisk: t.initialRisk,
    stopWidened: widened,
    stopRemoved: removed,
    ledger: state.ledger.filter((l) => l.tradeId === t.id),
    createdAt: now,
  };
}

export function entryNet(e: JournalEntry): number {
  return e.ledger.reduce((s, l) => s + l.cash, 0);
}

export function entryCosts(e: JournalEntry): number {
  return -e.ledger.filter((l) => l.kind === 'fee').reduce((s, l) => s + l.cash, 0);
}

/** R multiple: net realized result ÷ frozen initial price risk. Null when undefined. */
export function entryR(e: JournalEntry): number | null {
  if (e.initialRisk === null || e.initialRisk <= 0) return null;
  return entryNet(e) / e.initialRisk;
}

export interface AdherenceCheck {
  label: string;
  ok: boolean;
}

export function adherenceChecks(e: JournalEntry): AdherenceCheck[] {
  return [
    { label: 'Set a protective stop before entering', ok: e.plan.stop !== undefined },
    { label: 'Kept the stop at or tighter than planned', ok: !e.stopWidened && !e.stopRemoved },
    { label: 'Traded the planned size', ok: e.qty === e.plan.qty },
    { label: 'Wrote down a reason before entering', ok: e.plan.rationale.length > 0 || e.plan.note.trim().length > 0 },
  ];
}

export function followedPlanAutomatically(e: JournalEntry): boolean {
  return adherenceChecks(e).every((c) => c.ok);
}

export interface JournalStats {
  count: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number | null;
  averageWin: number | null;
  averageLoss: number | null;
  totalNet: number;
  totalCosts: number;
  averageR: number | null;
  rSample: number;
  planFollowed: number;
  reflected: number;
}

export const SMALL_SAMPLE = 30;

export function journalStats(entries: JournalEntry[]): JournalStats {
  const nets = entries.map(entryNet);
  const wins = nets.filter((n) => n > 0);
  const losses = nets.filter((n) => n < 0);
  const rs = entries.map(entryR).filter((r): r is number => r !== null);
  return {
    count: entries.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: nets.filter((n) => n === 0).length,
    winRate: entries.length ? wins.length / entries.length : null,
    averageWin: wins.length ? Math.round(wins.reduce((a, b) => a + b, 0) / wins.length) : null,
    averageLoss: losses.length ? Math.round(losses.reduce((a, b) => a + b, 0) / losses.length) : null,
    totalNet: nets.reduce((a, b) => a + b, 0),
    totalCosts: entries.reduce((s, e) => s + entryCosts(e), 0),
    averageR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
    rSample: rs.length,
    planFollowed: entries.filter(followedPlanAutomatically).length,
    reflected: entries.filter((e) => e.reflection).length,
  };
}

/** Sanity check used by tests: a run's journal nets equal the change in its ledger cash. */
export function reconcile(state: SimState, entries: JournalEntry[]): { ledgerChange: number; journalNet: number } {
  const closedIds = new Set(state.trades.filter((t) => t.status === 'closed').map((t) => t.id));
  const ledgerChange = [...closedIds].reduce((s, id) => s + tradeNet(state.ledger, id), 0);
  const journalNet = entries.filter((e) => e.runId === state.runId).reduce((s, e) => s + entryNet(e), 0);
  return { ledgerChange, journalNet };
}
