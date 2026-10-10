import { test, expect } from '@playwright/test'
test('reviews empty state fits the viewport and follows the language selection', async ({
  page,
}) => {
  await page.goto('/coins/european-connections')
  const reviews = page.getByRole('region', { name: 'Ratings & reviews' })
  await reviews.scrollIntoViewIfNeeded()
  await expect(
    reviews.getByText('No ratings yet. Be the first to rate this coin!'),
  ).toBeVisible()
  await expect(
    reviews.getByText('Reviews are unavailable in the demonstration.'),
  ).toBeVisible()
  await expect(reviews.locator('form')).toHaveCount(0)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.getByLabel('Change language').click()
  await page.getByRole('button', { name: 'Deutsch', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Bewertungen & Rezensionen' }),
  ).toBeVisible()
  await page.getByLabel('Sprache ändern').click()
  await page.getByRole('button', { name: 'Ελληνικά', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Αξιολογήσεις και κριτικές' }),
  ).toBeVisible()
})
