export type LabOrderType = 'market' | 'limit' | 'stop';
export type LabSide = 'buy' | 'sell';

export interface LabQuote {
  bid: number;
  ask: number;
}

export interface LabStep {
  index: number;
  quote: LabQuote;
  status: 'waiting' | 'triggered' | 'filled';
  text: string;
}

export interface LabOutcome {
  filled: boolean;
  fillIndex: number | null;
  fillPrice: number | null;
  triggeredIndex: number | null;
  steps: LabStep[];
  summary: string;
}

const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

/**
 * Deterministic single-order walk through a quote sequence. The order is
 * submitted while quote 0 is on screen and can first execute on quote 1,
 * so it never fills on a quote the learner saw before submitting.
 *
 * Buys execute against the ask, sells against the bid. A limit fills only at
 * its price or better. A stop triggers when the executable side reaches the
 * stop price and then fills at that same quote, which can be worse than the
 * stop price when the quote gaps through it.
 */
export function runLabOrder(params: {
  side: LabSide;
  type: LabOrderType;
  price?: number;
  quotes: LabQuote[];
}): LabOutcome {
  const { side, type, price, quotes } = params;
  const steps: LabStep[] = [];
  let triggeredIndex: number | null = null;

  for (let i = 1; i < quotes.length; i++) {
    const q = quotes[i]!;
    const executable = side === 'buy' ? q.ask : q.bid;
    const sideName = side === 'buy' ? 'ask' : 'bid';

    if (type === 'market') {
      steps.push({ index: i, quote: q, status: 'filled', text: `Market order filled at the ${sideName}, ${fmt(executable)}.` });
      return done(steps, i, executable, null, `Filled at ${fmt(executable)}. A market order takes the next available ${sideName}.`);
    }

    if (price === undefined) throw new Error('limit and stop orders need a price');

    if (type === 'limit') {
      const ok = side === 'buy' ? executable <= price : executable >= price;
      if (ok) {
        steps.push({ index: i, quote: q, status: 'filled', text: `The ${sideName} (${fmt(executable)}) reached your limit ${fmt(price)}. Filled at ${fmt(executable)}.` });
        return done(steps, i, executable, null, `Filled at ${fmt(executable)}, which is at or better than your ${fmt(price)} limit.`);
      }
      steps.push({
        index: i,
        quote: q,
        status: 'waiting',
        text: `The ${sideName} is ${fmt(executable)}. ${side === 'buy' ? 'Above' : 'Below'} your ${fmt(price)} limit, so the order waits.`,
      });
      continue;
    }

    const triggered = side === 'buy' ? executable >= price : executable <= price;
    if (triggered) {
      triggeredIndex = i;
      const worse = side === 'buy' ? executable > price : executable < price;
      steps.push({
        index: i,
        quote: q,
        status: 'filled',
        text: worse
          ? `The ${sideName} jumped to ${fmt(executable)}, past your ${fmt(price)} stop. The stop became a market order and filled at ${fmt(executable)}.`
          : `The ${sideName} reached your ${fmt(price)} stop. It became a market order and filled at ${fmt(executable)}.`,
      });
      return done(
        steps,
        i,
        executable,
        triggeredIndex,
        worse
          ? `Filled at ${fmt(executable)}, worse than the ${fmt(price)} stop price, because the quote gapped past it.`
          : `Filled at ${fmt(executable)} after the stop triggered.`,
      );
    }
    steps.push({ index: i, quote: q, status: 'waiting', text: `The ${sideName} is ${fmt(executable)}. Your ${fmt(price)} stop has not been reached.` });
  }

  return {
    filled: false,
    fillIndex: null,
    fillPrice: null,
    triggeredIndex,
    steps,
    summary: 'Not filled. The price never reached your order, so it is still waiting and nothing was bought or sold.',
  };
}

function done(steps: LabStep[], i: number, price: number, trig: number | null, summary: string): LabOutcome {
  return { filled: true, fillIndex: i, fillPrice: price, triggeredIndex: trig, steps, summary };
}
