import { expect, test } from '@playwright/test'
test('switches languages, keeps filters and selection across routes and reloads', async ({
  page,
}) => {
  await page.goto('/collection?country=Greece&sort=year_asc')
  const trigger = page.locator('.language-trigger')
  await trigger.click()
  await page.getByRole('button', { name: 'Deutsch', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(
    page.getByRole('heading', { name: 'Eine Welt, Münze für Münze.' }),
  ).toBeVisible()
  await expect(
    page.getByRole('combobox', { name: 'Münzen sortieren' }),
  ).toHaveValue('year_asc')
  await expect(page).toHaveURL(/country=Greece&sort=year_asc/)
  await expect(trigger.locator('img')).toHaveAttribute('src', '/flags/de.svg')
  await trigger.click()
  await page.getByRole('button', { name: 'Ελληνικά', exact: true }).click()
  await page
    .getByRole('navigation', { name: 'Κύρια πλοήγηση' })
    .getByRole('link', { name: 'Σχετικά', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Μια συλλογή ξεκινά με περιέργεια.' }),
  ).toBeVisible()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'el')
  await expect(page).toHaveTitle(
    'Σχετικά με τη συλλογή · Η συλλογή νομισμάτων μου',
  )
  await expect(trigger.locator('img')).toHaveAttribute('src', '/flags/gr.svg')
  await trigger.click()
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(
    page.getByRole('heading', { name: 'A collection starts with curiosity.' }),
  ).toBeVisible()
})
test('keyboard selector closes with Escape and fits the mobile header', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await expect(page.locator('main h1')).toBeVisible()
  const trigger = page.locator('.language-trigger')
  await trigger.focus()
  await expect(trigger).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('button', { name: 'English', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(trigger).toBeFocused()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(trigger).toBeFocused()
  const bounds = await trigger.boundingBox()
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375)
  await trigger.click()
  await page.getByRole('button', { name: 'Ελληνικά', exact: true }).click()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375)
})
