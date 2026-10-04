import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/admin-e2e',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:4181', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --port 4181 --strictPort',
    url: 'http://127.0.0.1:4181',
    reuseExistingServer: false,
    env: {
      VITE_DEMO_MODE: 'false',
      VITE_SUPABASE_URL: 'https://admin-test.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
})
