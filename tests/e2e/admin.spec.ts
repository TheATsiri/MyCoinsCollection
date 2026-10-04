import { expect, test } from '@playwright/test'
test('administration is clearly unavailable in demo mode and preserves languages', async ({
  page,
}) => {
  await page.goto('/admin/coins/new')
  await expect(page).toHaveURL(/admin\/login/)
  await expect(
    page.getByRole('heading', { name: 'Administrator login' }),
  ).toBeVisible()
  await expect(
    page.getByText('Administration requires a connected Supabase project.'),
  ).toBeVisible()
  await page.locator('.language-trigger').click()
  await page.getByRole('button', { name: 'Deutsch', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Administrator-Anmeldung' }),
  ).toBeVisible()
  await page.locator('.language-trigger').click()
  await page.getByRole('button', { name: 'Ελληνικά', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Σύνδεση διαχειριστή' }),
  ).toBeVisible()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth))
})
