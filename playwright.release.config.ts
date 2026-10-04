import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/release',
  use: {
    baseURL: 'https://mycoinscollection.pages.dev',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
