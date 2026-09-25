// Renders public/favicon.svg to the PNG icons the web app manifest needs.
// Uses the locally installed Playwright Chromium, so no image service is involved.
import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const out = new URL('../public/icons/', import.meta.url);
await mkdir(out, { recursive: true });

const targets = [
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'icon-512.png', size: 512, pad: 0 },
  // Maskable icons keep content inside the central 80% safe zone.
  { file: 'icon-maskable-512.png', size: 512, pad: 0.12 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0.06 },
];

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage();
for (const t of targets) {
  const inner = Math.round(t.size * (1 - t.pad * 2));
  const offset = Math.round((t.size - inner) / 2);
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<html><body style="margin:0;background:#151B25;width:${t.size}px;height:${t.size}px">` +
      `<div style="position:absolute;left:${offset}px;top:${offset}px;width:${inner}px;height:${inner}px">` +
      svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `) +
      `</div></body></html>`,
  );
  await page.screenshot({ path: new URL(t.file, out).pathname, omitBackground: false });
  console.log(`wrote public/icons/${t.file}`);
}
await browser.close();
