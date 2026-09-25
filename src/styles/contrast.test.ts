/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');
const tokens = Object.fromEntries([...css.matchAll(/--(color-[a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!]));

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const t = (name: string) => {
  const v = tokens[name];
  if (!v) throw new Error(`Missing token ${name}`);
  return v;
};

describe('color contrast (WCAG 2.2)', () => {
  const surfaces = ['color-ink', 'color-surface', 'color-surface-2', 'color-surface-3'];
  it.each(surfaces)('body and muted text meet 4.5:1 on %s', (bg) => {
    expect(contrast(t('color-text'), t(bg))).toBeGreaterThanOrEqual(7);
    expect(contrast(t('color-text-muted'), t(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['color-ink', 'color-surface', 'color-surface-2'])('faint text meets 4.5:1 on %s', (bg) => {
    expect(contrast(t('color-text-faint'), t(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['color-accent', 'color-mastery', 'color-up', 'color-down', 'color-warn', 'color-focus'])('%s meets 4.5:1 on every surface', (fg) => {
    for (const bg of surfaces) expect(contrast(t(fg), t(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps text readable on tinted feedback backgrounds', () => {
    for (const [fg, bg] of [
      ['color-text', 'color-up-soft'],
      ['color-text', 'color-down-soft'],
      ['color-text', 'color-warn-soft'],
      ['color-text', 'color-accent-soft'],
      ['color-text', 'color-mastery-soft'],
      ['color-up', 'color-up-soft'],
      ['color-down', 'color-down-soft'],
      ['color-mastery', 'color-mastery-soft'],
      ['color-accent', 'color-accent-soft'],
    ] as const)
      expect(contrast(t(fg), t(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  it('gives primary buttons readable text', () => {
    expect(contrast(t('color-accent-ink'), t('color-accent'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('color-accent-ink'), t('color-accent-strong'))).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps non-text UI boundaries at 3:1 (input and control boundaries)', () => {
    for (const bg of surfaces) expect(contrast(t('color-border-strong'), t(bg)), bg).toBeGreaterThanOrEqual(3);
    expect(contrast(t('color-focus'), t('color-ink'))).toBeGreaterThanOrEqual(3);
  });
});
