import { expect, test, type Page } from '@playwright/test';
import { completeFirstLesson, onboard } from './helpers';

// Opt-in: SCREENSHOT_DIR=/some/dir npx playwright test e2e/screenshots.spec.ts
const dir = process.env.SCREENSHOT_DIR;
test.skip(!dir, 'Set SCREENSHOT_DIR to capture screenshots.');

const widths = [
  { w: 360, h: 780 },
  { w: 390, h: 844 },
  { w: 768, h: 1024 },
  { w: 1440, h: 900 },
];

// Viewport captures: full-page captures misplace sticky and fixed bars.
async function shot(page: Page, name: string, scrollTo?: string) {
  await expect(page.locator('main h1').first()).toBeAttached();
  await expect(page.getByText('Loading…')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  if (scrollTo) await page.locator(scrollTo).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/${name}.png`, animations: 'disabled' });
}

async function seedTrade(page: Page) {
  await page.goto('/simulator');
  await page.getByRole('button', { name: 'Start this run' }).first().click();
  await page.getByLabel('Shares').fill('5');
  const bid = await page.locator('.quote-cell').filter({ hasText: 'Bid' }).locator('.v').innerText();
  await page.getByLabel('Protective stop (recommended)').fill((Number(bid.replace(/[$,]/g, '')) - 1).toFixed(2));
  await page.getByRole('button', { name: 'Place buy order' }).click();
  await page.getByRole('button', { name: 'Next quote' }).click();
  await expect(page.getByText(/Bought 5 shares/).first()).toBeVisible();
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Next quote' }).click();
}

for (const { w, h } of widths) {
  test(`screens at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await shot(page, `${w}-01-onboarding`);
    await onboard(page);
    await page.getByRole('button', { name: /^Continue/ }).click();
    await page.getByLabel('Value of your 2 shares, in dollars').fill('4');
    await page.getByRole('button', { name: 'Check answer' }).click();
    await shot(page, `${w}-02-lesson-wrong-answer`, '.feedback');
    await page.goto('/learn/u1-shares');
    await page.getByRole('button', { name: /^Previous/ }).click();
    await completeFirstLesson(page);
    await shot(page, `${w}-03-lesson-recap`);
    await page.goto('/');
    await shot(page, `${w}-04-learn`);
    await seedTrade(page);
    await shot(page, `${w}-05-simulator`);
    await page.getByRole('button', { name: 'Sell all at market' }).click();
    await page.getByRole('button', { name: 'Next quote' }).click();
    await page.getByRole('link', { name: 'Review and reflect' }).click();
    await shot(page, `${w}-06-journal-entry`);
    await shot(page, `${w}-06b-journal-reflection`, '#refl-h');
    await page.goto('/progress');
    await shot(page, `${w}-07-progress`);
    await page.goto('/practice');
    await shot(page, `${w}-08-practice`);
    await page.goto('/settings');
    await shot(page, `${w}-09-settings`);
  });
}

test('enlarged text at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await onboard(page);
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Larger' }).check();
  await page.goto('/learn/u1-shares');
  await shot(page, `390-text130-01-lesson`);
  await seedTrade(page);
  await shot(page, `390-text130-02-simulator`);
  await page.goto('/');
  await shot(page, `390-text130-03-learn`);
});
