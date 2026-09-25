import { expect, test } from '@playwright/test';
import { completeFirstLesson, onboard } from './helpers';

test('fresh learner: onboarding, first lesson, XP and a tappable glossary term', async ({ page }) => {
  await onboard(page, { nickname: 'Sam' });
  await expect(page.getByRole('progressbar', { name: 'Lesson progress' })).toHaveAttribute('aria-valuenow', '1');

  const term = page.getByRole('button', { name: 'share', exact: true }).first();
  await term.click();
  await expect(term).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('note').filter({ hasText: 'One unit of ownership' })).toBeVisible();

  await completeFirstLesson(page);
  await expect(page.getByText(/\+20 XP for completing this lesson/)).toBeVisible();
  await expect(page.getByText('Achievement earned: First step')).toBeVisible();
  await expect(page.getByText('Sources and further reading')).toBeVisible();

  await page.getByRole('link', { name: 'Back to Learn' }).last().click();
  await expect(page.getByText('Up next', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Buying, selling and profit or loss' })).toBeVisible();
});

test('returning learner: the current step is restored after a reload', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: /^Continue/ }).click();
  await page.getByLabel('Value of your 2 shares, in dollars').fill('24');
  await page.getByRole('button', { name: 'Check answer' }).click();
  await page.getByRole('button', { name: /^Continue/ }).click();
  await expect(page.getByRole('progressbar', { name: 'Lesson progress' })).toHaveAttribute('aria-valuenow', '3');

  await page.goto('/');
  await expect(page.getByText('Continue where you left off')).toBeVisible();
  await page.reload();
  await page.getByRole('link', { name: /Continue lesson/ }).click();
  await expect(page.getByRole('heading', { name: 'Value is not the same as gain' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Lesson progress' })).toHaveAttribute('aria-valuenow', '3');
});

test('wrong-answer recovery: the misconception is named and a retry works', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: /^Continue/ }).click();
  const cont = page.getByRole('button', { name: /^Continue/ });
  await expect(cont).toBeDisabled();

  await page.getByLabel('Value of your 2 shares, in dollars').fill('4');
  await page.getByRole('button', { name: 'Check answer' }).click();
  const fb = page.locator('.feedback.is-wrong');
  await expect(fb).toBeVisible();
  await expect(fb).toContainText('the gain');
  await expect(fb).toBeFocused();
  await expect(cont).toBeDisabled();

  await page.getByLabel('Value of your 2 shares, in dollars').fill('24');
  await expect(fb).toBeHidden();
  await page.getByRole('button', { name: /Check/ }).click();
  await expect(page.locator('.feedback.is-correct')).toBeVisible();
  await expect(page.locator('.feedback.is-correct')).toContainText('XP for learning');
  await expect(cont).toBeEnabled();

  await page.goto('/progress');
  await expect(page.getByText('Fix a misconception', { exact: false }).first()).toBeVisible();
  await page.goto('/practice');
  await expect(page.getByRole('link', { name: 'Start review' })).toBeVisible();
});

test('completed simulated trade: buy with a stop, sell, journal entry and reflection', async ({ page }) => {
  await onboard(page);
  await page.goto('/simulator');
  await expect(page.getByText('Synthetic training scenario').first()).toBeVisible();
  await page.getByRole('button', { name: 'Start this run' }).first().click();

  await expect(page.getByText('$1,000.00').first()).toBeVisible();
  await page.getByLabel('Shares').fill('5');
  const bid = await page.locator('.quote-cell').filter({ hasText: 'Bid' }).locator('.v').innerText();
  const stop = (Number(bid.replace(/[$,]/g, '')) - 1).toFixed(2);
  await page.getByLabel('Protective stop (recommended)').fill(stop);
  await page.getByRole('button', { name: 'Place buy order' }).click();
  await expect(page.getByText(/checked on the next quote|Waiting|next quote/i).first()).toBeVisible();

  await page.getByRole('button', { name: 'Next quote' }).click();
  await expect(page.getByText(/Bought 5 shares/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Next quote' }).click();

  await page.getByRole('button', { name: 'Sell all at market' }).click();
  await page.getByRole('button', { name: 'Next quote' }).click();
  await expect(page.getByText('Trade closed. A journal entry was created automatically.')).toBeVisible();
  await page.getByRole('link', { name: 'Review and reflect' }).click();

  await expect(page.getByText(/R multiple|R =|\bR\b/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Save reflection' }).click();
  await expect(page.getByRole('alert')).toContainText('10 characters');
  await page.getByLabel('What happened, and why?').fill('I followed my plan and sold early to practice exiting.');
  await page.getByRole('button', { name: 'Save reflection' }).click();
  await expect(page.getByText(/\+10 XP/)).toBeVisible();

  await page.goto('/journal');
  await expect(page.getByText(/1 trade|Based on 1/).first()).toBeVisible();

  await page.goto('/settings');
  await page.getByRole('button', { name: 'Reset simulator' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset simulator' }).click();
  await page.goto('/journal');
  await expect(page.getByText(/1 trade|Based on 1/).first()).toBeVisible();
  await page.goto('/progress');
  await expect(page.getByText(/XP/).first()).toBeVisible();
});

test('offline return: the installed app shell loads without a network', async ({ page, context }) => {
  await onboard(page);
  await completeFirstLesson(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);

  await context.setOffline(true);
  await expect(page.getByText('You’re offline.')).toBeVisible();
  await expect(page.getByText(/keep working, and progress still saves/)).toBeVisible();

  // Full document loads with the network cut are served by the service worker.
  // (Playwright's emulation leaves navigator.onLine true on those documents, so
  // the banner is asserted above on a live page instead.)
  await page.goto('/progress');
  await expect(page.getByRole('heading', { level: 1, name: 'Progress' })).toBeVisible();
  await expect(page.getByText('First step').first()).toBeVisible();
  await page.goto('/learn/u1-shares');
  await expect(page.getByText('reviewing a completed lesson')).toBeVisible();
  await context.setOffline(false);
});

test('unknown routes show a helpful 404', async ({ page }) => {
  await onboard(page);
  await page.goto('/does-not-exist');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/find|not found/i);
});
