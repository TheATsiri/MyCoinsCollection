import { expect, test } from '@playwright/test'
test('production administration routes and translations are available', async ({
  page,
}) => {
  await page.goto('/admin/coins/new')
  await expect(page).toHaveURL(/admin\/login/)
  await expect(
    page.getByRole('heading', { name: 'Administrator login' }),
  ).toBeVisible()
  await expect(page.getByLabel('Email address')).toBeVisible()
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
  await page.screenshot({
    path: 'test-results/production-admin-login.png',
    fullPage: true,
  })
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
})
