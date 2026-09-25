import { expect, type Page } from '@playwright/test';

export async function onboard(page: Page, opts: { nickname?: string } = {}) {
  await page.goto('/');
  await expect(page.getByText('Practice with virtual money. No real trades happen here.')).toBeVisible();
  await expect(page.getByRole('radio', { name: /Start from zero/ })).toBeChecked();
  await page.getByRole('button', { name: 'Continue' }).click();
  if (opts.nickname) await page.getByLabel('Nickname').fill(opts.nickname);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Saved in this browser. Export a backup to move your progress.')).toBeVisible();
  await page.getByRole('button', { name: 'Start the first lesson' }).click();
  await expect(page).toHaveURL(/\/learn\/u1-shares$/);
}

/** Completes lesson u1-shares answering everything correctly on the first try. */
export async function completeFirstLesson(page: Page) {
  const cont = page.getByRole('button', { name: /^Continue/ });
  await cont.click();
  await page.getByLabel('Value of your 2 shares, in dollars').fill('24');
  await page.getByRole('button', { name: /^Check (answer|again)/ }).click();
  await expect(page.locator('.feedback.is-correct')).toBeVisible();
  await cont.click();
  await cont.click();
  await page.getByRole('radio', { name: /\$4 unrealized gain/ }).check();
  await page.getByRole('button', { name: /^Check (answer|again)/ }).click();
  await expect(page.locator('.feedback.is-correct')).toBeVisible();
  await cont.click();
  await expect(page.getByRole('heading', { name: 'Lesson recap' })).toBeVisible();
}
