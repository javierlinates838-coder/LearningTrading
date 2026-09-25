/**
 * All money in the app is stored as integer cents. Floating-point dollars
 * only appear at the display edge (formatting) and at the input edge (parsing).
 */
export type Cents = number;

export function assertCents(value: number, label = 'amount'): Cents {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer number of cents, got ${value}`);
  }
  return value;
}

/** Parse a user-entered dollar string such as "12.5" or "$1,000.25" into cents. */
export function parseDollars(input: string): Cents | null {
  const cleaned = input.replace(/[$,\s]/g, '');
  if (!/^-?\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const negative = cleaned.startsWith('-');
  const [whole = '0', frac = ''] = cleaned.replace('-', '').split('.');
  const cents = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
  return negative ? -cents : cents;
}

export function dollarsToCents(dollars: number): Cents {
  return Math.round(dollars * 100);
}

export function centsToDollarString(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatMoney(cents: Cents, opts: { signed?: boolean } = {}): string {
  const text = usd.format(cents / 100);
  if (opts.signed && cents > 0) return `+${text}`;
  return text;
}

/** Signed money with a text direction word so meaning never depends on color. */
export function describeChange(cents: Cents): { text: string; direction: 'up' | 'down' | 'flat'; word: string } {
  if (cents > 0) return { text: formatMoney(cents, { signed: true }), direction: 'up', word: 'gain' };
  if (cents < 0) return { text: formatMoney(cents), direction: 'down', word: 'loss' };
  return { text: formatMoney(0), direction: 'flat', word: 'no change' };
}

export function multiplyCents(cents: Cents, quantity: number): Cents {
  assertCents(cents);
  if (!Number.isInteger(quantity)) throw new Error('Quantity must be a whole number of shares');
  return cents * quantity;
}
