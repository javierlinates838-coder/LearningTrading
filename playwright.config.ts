import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const remoteUrl = process.env.E2E_BASE_URL;
const chromePath = process.env.CHROME_PATH ?? (existsSync('/usr/local/bin/google-chrome') ? '/usr/local/bin/google-chrome' : undefined);

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: remoteUrl ?? 'http://localhost:4173',
    trace: 'retain-on-failure',
    launchOptions: chromePath ? { executablePath: chromePath } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } }],
  webServer: remoteUrl
    ? undefined
    : {
        command: 'npm run preview',
        url: 'http://localhost:4173',
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
