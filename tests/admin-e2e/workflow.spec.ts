import sharp from 'sharp'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
const user = {
  id: '00000000-0000-0000-0000-000000000020',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'owner@example.com',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-10-04T00:00:00Z',
}
function session() {
  const expires = Math.floor(Date.now() / 1000) + 3600
  const access_token =
    [
      { alg: 'HS256', typ: 'JWT' },
      { sub: user.id, exp: expires, role: 'authenticated' },
    ]
      .map((part) => Buffer.from(JSON.stringify(part)).toString('base64url'))
      .join('.') + '.test-signature'
  return {
    access_token,
    token_type: 'bearer',
    refresh_token: 'test-refresh',
    expires_in: 3600,
    expires_at: expires,
    user,
  }
}
async function mockApi(
  page: Page,
  save: (data: Record<string, unknown>) => Promise<void>,
  owner = true,
) {
  await page.routeWebSocket('wss://admin-test.supabase.co/**', (socket) =>
    socket.close(),
  )
  await page.route('https://admin-test.supabase.co/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = []
    if (path.endsWith('/auth/v1/token')) data = session()
    else if (path.endsWith('/auth/v1/user')) data = user
    else if (path.endsWith('/rpc/is_collection_owner')) data = owner
    else if (path.endsWith('/rpc/save_coin')) {
      await save(route.request().postDataJSON())
      await route.fulfill({ json: route.request().postDataJSON().p_coin.id })
      return
    } else if (path.endsWith('/rpc/search_coins'))
      data = { items: [], total: 0 }
    else if (path.endsWith('/rpc/get_filter_options'))
      data = {
        countries: [],
        periods: [],
        denominations: [],
        metals: [],
        grades: [],
      }
    else if (path.endsWith('/functions/v1/import-coin'))
      data = {
        fields: {
          name: 'Imported silver coin',
          issuing_authority: 'Greece',
          year: 1964,
        },
        source_url: 'https://example.com/coin',
        warnings: [],
      }
    else if (path.includes('/storage/v1/object/')) data = { Key: path }
    await route.fulfill({ json: data })
  })
}
async function login(page: Page) {
  await page.goto('/admin/login')
  await page.getByLabel('Email address').fill('owner@example.com')
  await page.getByLabel('Password', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
}
test('logs in, restores its session, reviews imports, uploads processed photos, publishes, and logs out', async ({
  page,
}, info) => {
  const saves: Record<string, unknown>[] = []
  await mockApi(page, async (data) => {
    saves.push(data)
  })
  await login(page)
  await expect(
    page.getByRole('heading', { name: 'Administration' }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Administration' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Add coin', exact: true }).click()
  await page.getByLabel('Coin name').fill('My specimen')
  await page.getByLabel('Reference URL').fill('https://example.com/coin')
  await page.getByRole('button', { name: 'Retrieve information' }).click()
  await expect(
    page.getByRole('heading', { name: 'Imported suggestions' }),
  ).toBeVisible()
  await expect(page.getByLabel('Coin name')).toHaveValue('My specimen')
  await page
    .locator('.admin-import > div')
    .filter({ hasText: 'Issuing authority' })
    .getByRole('button')
    .click()
  await page
    .locator('.admin-import > div')
    .filter({ hasText: 'Year' })
    .getByRole('button')
    .click()
  const png = await sharp({
    create: { width: 64, height: 64, channels: 3, background: '#b7a77a' },
  })
    .png()
    .toBuffer()
  for (const side of ['obverse', 'reverse'])
    await page.getByLabel(side, { exact: true }).setInputFiles({
      name: `${side}.png`,
      mimeType: 'image/png',
      buffer: png,
    })
  await expect(page.locator('.admin-photo-preview')).toHaveCount(2)
  await page.screenshot({
    path: info.outputPath('coin-editor.png'),
    fullPage: true,
  })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(await page.evaluate(() => innerWidth))
  await page.getByRole('button', { name: 'Add to My Coins Collection' }).click()
  await expect(
    page.getByRole('heading', { name: 'Administration' }),
  ).toBeVisible()
  expect(saves).toHaveLength(1)
  const coin = saves[0].p_coin as Record<string, unknown>
  expect(coin).toMatchObject({
    name: 'My specimen',
    issuing_authority: 'Greece',
    year: 1964,
    is_published: true,
  })
  const images = saves[0].p_images as Record<string, string>[]
  expect(images).toHaveLength(2)
  expect(
    images.every(
      (image) =>
        image.image_path.startsWith(`${coin.id}/`) &&
        image.image_path.endsWith('.webp') &&
        image.thumbnail_path.endsWith('-thumb.webp'),
    ),
  ).toBe(true)
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Administrator login' }),
  ).toBeVisible()
})
test('rejects a logged-in non-owner', async ({ page }) => {
  await mockApi(page, async () => undefined, false)
  await login(page)
  await expect(page.getByText('Administrator access required.')).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Add coin', exact: true }),
  ).toHaveCount(0)
})

test('reviews a temporary Numista lookup and retains only its reference', async ({
  page,
}, info) => {
  await mockApi(page, async () => undefined)
  await page.route(
    'https://admin-test.supabase.co/functions/v1/import-coin',
    (route) =>
      route.fulfill({
        json: {
          fields: {},
          source_url: 'https://en.numista.com/420',
          warnings: [],
          numista: {
            id: 420,
            title: 'Example coin (test fixture)',
            details: [
              { label: 'Issuing authority', value: 'Example issuer' },
              { label: 'Weight (g)', value: 1.2 },
            ],
          },
        },
      }),
  )
  await login(page)
  await page.getByRole('link', { name: 'Add coin', exact: true }).click()
  await page
    .getByLabel('Coin name')
    .fill('My independently documented specimen')
  await page.getByLabel('Reference URL').fill('https://en.numista.com/420')
  await page.getByRole('button', { name: 'Retrieve information' }).click()
  await expect(
    page.getByRole('heading', { name: 'Numista live lookup' }),
  ).toBeVisible()
  await expect(page.getByText('Source: Numista', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Use this value' }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Add Numista reference' }).click()
  await page.getByRole('button', { name: 'Add Numista reference' }).click()
  await expect(page.getByLabel('Catalogue', { exact: true })).toHaveValue(
    'Numista',
  )
  await expect(page.getByLabel('Reference number')).toHaveValue('N#420')
  await expect(page.getByLabel('Coin name')).toHaveValue(
    'My independently documented specimen',
  )
  await expect(page.getByLabel('Weight (g)')).toHaveValue('')
  await page.getByText('How to use Numista', { exact: true }).click()
  await page.screenshot({
    path: info.outputPath('numista-live-lookup.png'),
    fullPage: true,
  })
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0)
})
