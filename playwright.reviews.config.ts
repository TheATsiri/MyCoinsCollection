import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/review-e2e',
  fullyParallel: true,
  retries: 0,
  use: { baseURL: 'http://127.0.0.1:4175', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
    env: {
      VITE_DEMO_MODE: 'false',
      VITE_SUPABASE_URL: 'https://reviews-test.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-only',
      VITE_TURNSTILE_SITE_KEY: 'test-only',
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
})
