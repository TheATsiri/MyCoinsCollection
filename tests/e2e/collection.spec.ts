import { test, expect } from '@playwright/test'
test('browse, search, sort and restore a shareable filter', async ({
  page,
}) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: /Small objects/ }),
  ).toBeVisible()
  await page
    .getByRole('link', { name: 'Explore the collection', exact: true })
    .click()
  await expect(page.locator('.coin-card')).toHaveCount(12)
  await page.getByRole('searchbox').fill('European')
  await expect(page.locator('.coin-card')).toHaveCount(1)
  await page.getByLabel('Sort coins').selectOption('year_asc')
  await page.reload()
  await expect(page.getByRole('searchbox')).toHaveValue('European')
  await expect(page.getByLabel('Sort coins')).toHaveValue('year_asc')
  await page.getByRole('link', { name: 'European connections' }).click()
  await expect(
    page.getByRole('heading', { name: 'European connections' }),
  ).toBeVisible()
  await expect(page.getByText(/Demonstration record/)).toBeVisible()
})
test('image viewer traps focus, navigates and restores focus on Escape', async ({
  page,
}) => {
  await page.goto('/coins/european-connections')
  const trigger = page.getByRole('button', {
    name: 'Enlarge obverse photograph',
  })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(dialog.getByText('reverse · 2 / 2')).toBeVisible()
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Tab')
    expect(
      await page.evaluate(
        () => document.activeElement?.closest('dialog') !== null,
      ),
    ).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
})
test('empty search, invalid years, unknown routes and mobile filters', async ({
  page,
  isMobile,
}) => {
  await page.goto('/collection?q=does-not-exist')
  await expect(
    page.getByRole('heading', { name: 'No discoveries just yet' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  if (isMobile)
    await page.getByRole('button', { name: 'Filters', exact: true }).click()
  await page.getByLabel('Countries / authorities').selectOption('Germany')
  await expect(page.locator('.coin-card')).toHaveCount(1)
  await page.getByLabel('From year').fill('2020')
  await expect(page).toHaveURL(/yearFrom=2020/)
  await page.getByLabel('To year').fill('2000')
  await expect(page.getByRole('alert')).toContainText('starting year')
  await page.goto('/unknown-page')
  await expect(
    page.getByRole('heading', { name: 'This page could not be found.' }),
  ).toBeVisible()
})
test('pages fit their viewport and every sample image loads', async ({
  page,
}) => {
  for (const route of [
    '/',
    '/collection',
    '/coins/european-connections',
    '/about',
  ]) {
    await page.goto(route)
    await page.locator('footer').scrollIntoViewIfNeeded()
    await page.waitForFunction(() =>
      Array.from(document.images).every((i) => i.complete),
    )
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    expect(
      await page.evaluate(() =>
        Array.from(document.images).every((i) => i.naturalWidth > 0),
      ),
    ).toBe(true)
  }
})
